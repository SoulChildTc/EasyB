import gistApi from './gist.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 获取 DOM 元素
  const uploadBtn = document.getElementById('uploadBookmarks');
  const downloadBtn = document.getElementById('downloadBookmarks');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const tokenInput = document.getElementById('tokenInput');
  const gistInput = document.getElementById('gistInput');
  const settingsError = document.getElementById('settingsError');
  const settingsSuccess = document.getElementById('settingsSuccess');
  const syncError = document.getElementById('syncError');
  const syncSuccess = document.getElementById('syncSuccess');
  const clearLogsBtn = document.getElementById('clearLogs');
  const logContainer = document.getElementById('logContainer');
  const syncStatus = document.getElementById('syncStatus');
  const compareBtn = document.getElementById('compareBookmarks');
  const diffContent = document.getElementById('diffContent');
  const diffError = document.getElementById('diffError');
  const autoSyncToggle = document.getElementById('autoSyncToggle');

  // 初始化设置
  let settings = await chrome.storage.local.get(['githubToken', 'gistId', 'lastSyncTime', 'autoSync']);
  if (settings.githubToken) {
    tokenInput.value = settings.githubToken;
    gistInput.value = settings.gistId || '';
    updateSyncStatus(true);
  } else {
    updateSyncStatus(false);
  }

  // 初始化自动同步开关状态
  autoSyncToggle.checked = settings.autoSync === true;

  // 监听自动同步开关变化
  autoSyncToggle.addEventListener('change', async () => {
    const autoSync = autoSyncToggle.checked;
    await chrome.storage.local.set({ autoSync });
    settings.autoSync = autoSync;
    
    // 通知后台脚本更新自动同步状态
    chrome.runtime.sendMessage({ action: 'updateAutoSync', autoSync });
    
    // 更新同步状态显示
    updateSyncStatus(!!settings.githubToken);
    
    // 显示临时成功提示
    syncSuccess.textContent = autoSync ? '自动同步已开启' : '自动同步已关闭';
    syncSuccess.style.display = 'block';
    setTimeout(() => syncSuccess.style.display = 'none', 2000);
  });

  // 更新统计信息
  async function updateStats() {
    try {
      // 获取本地书签数量
      const localBookmarks = await chrome.bookmarks.getTree();
      const localCount = countBookmarks(localBookmarks[0]);
      document.getElementById('localBookmarkCount').textContent = localCount;

      // 获取云端书签数量
      document.getElementById('cloudBookmarkCount').textContent = '-';
      if (settings.githubToken && settings.gistId) {
        try {
          const cloudBookmarks = await gistApi.downloadBookmarks(settings.githubToken, settings.gistId);
          if (cloudBookmarks && cloudBookmarks[0]) {
            const cloudCount = countBookmarks(cloudBookmarks[0]);
            document.getElementById('cloudBookmarkCount').textContent = cloudCount;
          }
        } catch (error) {
          console.error('获取云端书签失败:', error);
        }
      }

      // 更新上次同步时间
      const lastSync = settings.lastSyncTime ? new Date(settings.lastSyncTime) : null;
      document.getElementById('lastSyncTime').textContent = lastSync ? 
        formatLastSyncTime(lastSync) : 
        '从未同步';
    } catch (error) {
      console.error('更新统计信息失败:', error);
      // 设置默认值
      document.getElementById('localBookmarkCount').textContent = '-';
      document.getElementById('cloudBookmarkCount').textContent = '-';
      document.getElementById('lastSyncTime').textContent = '从未同步';
    }
  }

  // 计算书签数量
  function countBookmarks(node) {
    let count = 0;
    if (node.children) {
      for (const child of node.children) {
        count += countBookmarks(child);
      }
    } else if (node.url) {
      count++;
    }
    return count;
  }

  // 格式化上次同步时间
  function formatLastSyncTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} 天前`;
    } else if (hours > 0) {
      return `${hours} 小时前`;
    } else if (minutes > 0) {
      return `${minutes} 分钟前`;
    } else {
      return '刚刚';
    }
  }

  // 标签页切换
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.panel');

  navItems.forEach(navItem => {
    navItem.addEventListener('click', () => {
      const targetPanel = navItem.getAttribute('data-panel');
      
      // 更新标签页状态
      navItems.forEach(t => t.classList.remove('active'));
      navItem.classList.add('active');
      
      // 更新面板显示
      panels.forEach(panel => {
        if (panel.id === `${targetPanel}Panel`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
    });
  });

  // 如果未配置，自动切换到设置标签页
  if (!settings.githubToken) {
    const settingsNavItem = document.querySelector('.nav-item[data-panel="settings"]');
    if (settingsNavItem) {
      settingsNavItem.click();
    }
  }

  // 保存设置
  saveSettingsBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const gistId = gistInput.value.trim();

    if (!token) {
      settingsError.textContent = '请输入 GitHub Token';
      settingsError.style.display = 'block';
      return;
    }

    try {
      // 验证 token
      const isValid = await gistApi.validateToken(token);
      if (!isValid) {
        throw new Error('无效的 GitHub Token');
      }

      // 保存设置
      await chrome.storage.local.set({ githubToken: token, gistId });
      settings = { githubToken: token, gistId };
      
      settingsSuccess.textContent = '设置已保存';
      settingsSuccess.style.display = 'block';
      settingsError.style.display = 'none';
      updateSyncStatus(true);
      
      setTimeout(() => {
        settingsSuccess.style.display = 'none';
        // 保存成功后切换回首页
        const homeNavItem = document.querySelector('.nav-item[data-panel="sync"]');
        if (homeNavItem) {
          homeNavItem.click();
        }
      }, 2000);

      // 更新统计信息
      await updateStats();
    } catch (error) {
      settingsError.textContent = error.message;
      settingsError.style.display = 'block';
      settingsSuccess.style.display = 'none';
      updateSyncStatus(false);
    }
  });

  // 上传书签
  uploadBtn.addEventListener('click', async () => {
    if (!settings.githubToken) {
      syncError.textContent = '请先配置 GitHub Token';
      syncError.style.display = 'block';
      return;
    }

    try {
      syncError.style.display = 'none';
      syncSuccess.style.display = 'none';
      uploadBtn.disabled = true;
      
      const bookmarks = await chrome.bookmarks.getTree();
      await gistApi.uploadBookmarks(bookmarks, settings.githubToken, settings.gistId);
      
      // 更新上次同步时间
      const now = new Date().getTime();
      await chrome.storage.local.set({ lastSyncTime: now });
      settings.lastSyncTime = now;
      
      syncSuccess.textContent = '书签上传成功';
      syncSuccess.style.display = 'block';
      setTimeout(() => syncSuccess.style.display = 'none', 3000);

      // 更新统计信息
      await updateStats();
    } catch (error) {
      syncError.textContent = `上传失败: ${error.message}`;
      syncError.style.display = 'block';
    } finally {
      uploadBtn.disabled = false;
    }
  });

  // 下载书签
  downloadBtn.addEventListener('click', async () => {
    if (!settings.githubToken) {
      syncError.textContent = '请先配置 GitHub Token';
      syncError.style.display = 'block';
      return;
    }

    try {
      syncError.style.display = 'none';
      syncSuccess.style.display = 'none';
      downloadBtn.disabled = true;

      const bookmarks = await gistApi.downloadBookmarks(settings.githubToken, settings.gistId);
      if (!bookmarks) {
        throw new Error('未找到云端书签数据');
      }

      // 删除所有现有书签
      const existingBookmarks = await chrome.bookmarks.getTree();
      for (const node of existingBookmarks[0].children) {
        await chrome.bookmarks.removeTree(node.id);
      }

      // 导入下载的书签
      await importBookmarks(bookmarks[0].children);
      
      // 更新上次同步时间
      const now = new Date().getTime();
      await chrome.storage.local.set({ lastSyncTime: now });
      settings.lastSyncTime = now;
      
      syncSuccess.textContent = '书签下载成功';
      syncSuccess.style.display = 'block';
      setTimeout(() => syncSuccess.style.display = 'none', 3000);

      // 更新统计信息
      await updateStats();
    } catch (error) {
      syncError.textContent = `下载失败: ${error.message}`;
      syncError.style.display = 'block';
    } finally {
      downloadBtn.disabled = false;
    }
  });

  // 对比书签
  compareBtn.addEventListener('click', async () => {
    if (!settings.githubToken || !settings.gistId) {
      diffError.textContent = '请先配置 GitHub Token 和完成一次同步';
      diffError.style.display = 'block';
      return;
    }

    try {
      diffError.style.display = 'none';
      compareBtn.disabled = true;
      diffContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
          <p class="empty-text">正在对比书签...</p>
        </div>
      `;

      // 获取本地和云端书签
      const [localBookmarks, cloudBookmarks] = await Promise.all([
        chrome.bookmarks.getTree(),
        gistApi.downloadBookmarks(settings.githubToken, settings.gistId)
      ]);

      // 比较书签
      const diff = gistApi.compareBookmarks(localBookmarks, cloudBookmarks);
      console.log('对比结果:', diff);
      
      // 更新差异计数
      document.getElementById('addedCount').textContent = `新增: ${diff.added.length}`;
      document.getElementById('deletedCount').textContent = `删除: ${diff.deleted.length}`;
      document.getElementById('modifiedCount').textContent = `修改: ${diff.modified.length}`;
      document.getElementById('movedCount').textContent = `移动: ${diff.moved ? diff.moved.length : 0}`;

      // 显示差异
      if (diff.added.length === 0 && diff.deleted.length === 0 && diff.modified.length === 0 && (!diff.moved || diff.moved.length === 0)) {
        diffContent.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p class="empty-text">本地书签与云端完全一致</p>
          </div>
        `;
        return;
      }

      let html = '';

      // 添加的书签
      diff.added.forEach(bookmark => {
        html += createDiffItem('added', '+', bookmark.title, bookmark.path, {
          local: bookmark.url
        });
      });

      // 删除的书签
      diff.deleted.forEach(bookmark => {
        html += createDiffItem('deleted', '-', bookmark.title, bookmark.path, {
          cloud: bookmark.url
        });
      });

      // 修改的书签
      diff.modified.forEach(({ local, cloud, changes }) => {
        html += createDiffItem('modified', 'M', local.title, local.path, {
          local: local.url,
          cloud: cloud.url
        }, { local, cloud, changes });
      });

      // 移动的书签
      if (diff.moved && diff.moved.length > 0) {
        diff.moved.forEach(({ bookmark, oldPath, newPath }) => {
          html += createDiffItem('moved', '↔', bookmark.title, newPath, {
            bookmark: bookmark.url
          }, { oldPath, newPath });
        });
      }

      diffContent.innerHTML = html;

      // 添加点击展开/收起事件
      document.querySelectorAll('.diff-item-header').forEach(header => {
        header.addEventListener('click', () => {
          const item = header.parentElement;
          item.classList.toggle('expanded');
        });
      });

    } catch (error) {
      diffError.textContent = `对比失败: ${error.message}`;
      diffError.style.display = 'block';
      diffContent.innerHTML = '';
      console.error('对比失败:', error);
    } finally {
      compareBtn.disabled = false;
    }
  });

  // 创建差异项目的 HTML
  function createDiffItem(type, badge, title, path, urls, details = {}) {
    const typeText = {
      'added': '新增',
      'deleted': '删除',
      'modified': '修改',
      'moved': '移动'
    }[type];

    // 构建变更内容
    let changesHtml = '';
    if (type === 'modified' && details.local && details.cloud && details.changes) {
      const changes = [];
      if (details.changes.title) {
        changes.push(`
          <div class="diff-change-row">
            <div class="diff-change-label">标题</div>
            <div class="diff-change-content">
              <span class="diff-old">${details.cloud.title}</span>
              <span class="diff-arrow">→</span>
              <span class="diff-new">${details.local.title}</span>
            </div>
          </div>`);
      }
      if (details.changes.url) {
        changes.push(`
          <div class="diff-change-row">
            <div class="diff-change-label">URL</div>
            <div class="diff-change-content">
              <span class="diff-old">${details.cloud.url}</span>
              <span class="diff-arrow">→</span>
              <span class="diff-new">${details.local.url}</span>
            </div>
          </div>`);
      }
      if (details.changes.moved) {
        changes.push(`
          <div class="diff-change-row">
            <div class="diff-change-label">位置</div>
            <div class="diff-change-content">
              <span class="diff-old">${details.changes.oldPath || '根目录'}</span>
              <span class="diff-arrow">→</span>
              <span class="diff-new">${details.changes.newPath || '根目录'}</span>
            </div>
          </div>`);
      }
      if (changes.length > 0) {
        changesHtml = `<div class="diff-changes">${changes.join('')}</div>`;
      }
    } else if (type === 'moved' && details.oldPath && details.newPath) {
      changesHtml = `
        <div class="diff-changes">
          <div class="diff-change-row">
            <div class="diff-change-label">位置</div>
            <div class="diff-change-content">
              <span class="diff-old">${details.oldPath || '根目录'}</span>
              <span class="diff-arrow">→</span>
              <span class="diff-new">${details.newPath || '根目录'}</span>
            </div>
          </div>
        </div>`;
    }

    // 构建 URL 显示
    const url = urls.local || urls.cloud || urls.bookmark;
    const urlHtml = `<!--div class="diff-url">${url}</div-->`;

    return `
      <div class="diff-item">
        <div class="diff-header">
          <div class="diff-badge ${type}">${badge}</div>
          <div class="diff-main">
            <div class="diff-title">${title}</div>
            <div class="diff-path">${path || '根目录'}</div>
            ${changesHtml}
            ${urlHtml}
          </div>
        </div>
      </div>
    `;
  }

  // 清除日志
  clearLogsBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove('logs');
    updateLogs([]);
  });

  // 更新日志显示
  function updateLogs(logs) {
    if (logs.length === 0) {
      logContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p class="empty-text">暂无操作日志</p>
        </div>
      `;
      return;
    }

    logContainer.innerHTML = '';
    logs.forEach(log => {
      const logItem = document.createElement('div');
      logItem.className = 'log-item';
      
      const time = new Date(log.time).toLocaleString();
      const typeText = {
        'add': '添加',
        'delete': '删除',
        'change': '修改'
      }[log.type];
      
      logItem.innerHTML = `
        <div class="log-time">${time}</div>
        <span class="log-badge ${log.type}">${typeText}</span>
        <a href="${log.url}" target="_blank" class="log-link log-title">${log.title}</a>
      `;
      
      logContainer.appendChild(logItem);
    });
  }

  // 更新同步状态显示
  function updateSyncStatus(isActive) {
    const statusDot = syncStatus.querySelector('.status-dot') || document.createElement('span');
    const autoSyncEnabled = settings.autoSync === true;
    
    // 状态点的类名取决于是否有效配置和是否开启自动同步
    statusDot.className = `status-dot ${isActive ? (autoSyncEnabled ? 'active' : 'semi-active') : 'inactive'}`;
    
    // 整体状态类名
    syncStatus.className = `app-status ${isActive ? (autoSyncEnabled ? 'active' : 'semi-active') : 'inactive'}`;
    
    // 清除内容并添加新内容
    syncStatus.textContent = '';
    syncStatus.appendChild(statusDot);
    
    // 根据状态显示不同文本
    let statusText;
    if (!isActive) {
      statusText = '同步未配置';
    } else {
      statusText = autoSyncEnabled ? '自动同步已开启' : '自动同步已关闭';
    }
    
    syncStatus.appendChild(document.createTextNode(statusText));
  }

  // 导入书签的辅助函数
  async function importBookmarks(nodes, parentId = null) {
    for (const node of nodes) {
      if (node.children) {
        // 创建文件夹
        const folder = await chrome.bookmarks.create({
          parentId: parentId,
          title: node.title
        });
        await importBookmarks(node.children, folder.id);
      } else {
        // 创建书签
        await chrome.bookmarks.create({
          parentId: parentId,
          title: node.title,
          url: node.url
        });
      }
    }
  }

  // 初始化时加载日志和统计信息
  const logs = (await chrome.storage.local.get('logs')).logs || [];
  updateLogs(logs);
  await updateStats();
}); 