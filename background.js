const STALE_DAYS = 7;

async function addLog(type, data) {
  const log = {
    type,
    title: data.title,
    url: data.url,
    time: Date.now()
  };

  const { logs = [] } = await chrome.storage.local.get('logs');
  const newLogs = [log, ...logs].slice(0, 100);
  await chrome.storage.local.set({ logs: newLogs });
}

chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  await addLog('add', bookmark);
});

chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  await addLog('delete', removeInfo.node);
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  await addLog('change', changeInfo);
});

async function checkSyncStale() {
  const { githubToken, gistId, lastSyncTime, notifiedStale } = await chrome.storage.local.get(['githubToken', 'gistId', 'lastSyncTime', 'notifiedStale']);
  if (!githubToken || !gistId || !lastSyncTime) return;
  if (notifiedStale) return;

  const days = (Date.now() - lastSyncTime) / 86400000;
  if (days >= STALE_DAYS) {
    await chrome.storage.local.set({ notifiedStale: true });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'EasyB',
      message: `已经 ${Math.floor(days)} 天没有同步书签了，是否去同步？`,
      buttons: [{ title: '去同步' }],
      requireInteraction: true
    });
  }
}

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.action.openPopup();
  }
});

const existingAlarm = await chrome.alarms.get('checkSyncStale');
if (!existingAlarm) {
  chrome.alarms.create('checkSyncStale', { periodInMinutes: 360 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkSyncStale') {
    checkSyncStale();
  }
});
