import gistApi from './gist.js';

// 初始化变量
let isAutoSyncEnabled = false;
let syncTimeout = null;  // 新增：同步防抖定时器
const SYNC_DELAY = 60 * 1000; // 1分钟

// 初始化时加载自动同步设置
async function initAutoSync() {
  const { autoSync } = await chrome.storage.local.get('autoSync');
  isAutoSyncEnabled = autoSync === true;
  console.log('自动同步状态:', isAutoSyncEnabled ? '已开启' : '已关闭');
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateAutoSync') {
    isAutoSyncEnabled = message.autoSync;
    console.log('自动同步状态已更新:', isAutoSyncEnabled ? '已开启' : '已关闭');
  }
  sendResponse({ success: true });
  return true;
});

// 工具函数：添加日志
async function addLog(type, data) {
  const log = {
    type,
    title: data.title,
    url: data.url,
    time: Date.now()
  };

  const { logs = [] } = await chrome.storage.local.get('logs');
  const newLogs = [log, ...logs].slice(0, 100); // 最多保留 100 条日志
  await chrome.storage.local.set({ logs: newLogs });
}

// 书签事件触发同步的防抖函数
function scheduleSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncBookmarks();
    syncTimeout = null;
  }, SYNC_DELAY);
}

// 监听书签变化
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  await addLog('add', bookmark);
  if (isAutoSyncEnabled) {
    scheduleSync();
  }
});

chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  await addLog('delete', removeInfo);
  if (isAutoSyncEnabled) {
    scheduleSync();
  }
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  await addLog('change', changeInfo);
  if (isAutoSyncEnabled) {
    scheduleSync();
  }
});

// 同步书签到 Gist
async function syncBookmarks() {
  try {
    const { githubToken, gistId } = await chrome.storage.local.get(['githubToken', 'gistId']);
    if (!githubToken) return;

    console.log('开始自动同步书签...');
    const bookmarks = await chrome.bookmarks.getTree();
    await gistApi.uploadBookmarks(bookmarks, githubToken, gistId);
    
    // 更新上次同步时间
    const now = new Date().getTime();
    await chrome.storage.local.set({ lastSyncTime: now });
    
    console.log('自动同步完成');
  } catch (error) {
    console.error('自动同步失败:', error);
  }
}

// 初始化
initAutoSync();

// // 设置定期同步（每小时）
// chrome.alarms.create('syncBookmarks', { periodInMinutes: 60 });
// chrome.alarms.onAlarm.addListener((alarm) => {
//   if (alarm.name === 'syncBookmarks') {
//     syncBookmarks();
//   }
// }); 