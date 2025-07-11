// GitHub Gist API 相关功能
const gistApi = {
  // 验证 GitHub Token
  async validateToken(token) {
    try {
      // 增加超时控制
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5秒超时
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      // 如果是超时导致的 abort，给出特殊提示
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络或稍后重试');
      }
      return false;
    }
  },

  // 上传书签到 Gist
  async uploadBookmarks(bookmarks, token, gistId) {
    // 保留完整的书签树结构，包括 ID
    const content = JSON.stringify(bookmarks, null, 2);
    const description = 'EasyB 书签同步数据';
    const filename = 'easyb.json';

    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    try {
      if (gistId) {
        // 更新现有 Gist
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            description,
            files: {
              [filename]: {
                content
              }
            }
          })
        });

        if (!response.ok) {
          let errorMsg = '未知错误';
          try {
            const data = await response.json();
            if (data && data.message) errorMsg = data.message;
          } catch {}
          throw new Error(errorMsg);
        }
      } else {
        // 创建新的 Gist
        const response = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            description,
            public: false,
            files: {
              [filename]: {
                content
              }
            }
          })
        });

        if (!response.ok) {
          let errorMsg = '未知错误';
          try {
            const data = await response.json();
            if (data && data.message) errorMsg = data.message;
          } catch {}
          throw new Error(errorMsg);
        }

        const data = await response.json();
        // 保存新创建的 Gist ID
        await chrome.storage.local.set({ gistId: data.id });
      }
    } catch (error) {
      console.error('上传书签失败:', error);
      throw error;
    }
  },

  // 从 Gist 下载书签
  async downloadBookmarks(token, gistId) {
    if (!gistId) {
      throw new Error('未配置 Gist ID');
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('获取 Gist 失败');
      }

      const data = await response.json();
      const filename = Object.keys(data.files).find(name => name === 'easyb.json');
      
      if (!filename) {
        throw new Error('未找到书签数据文件');
      }

      return JSON.parse(data.files[filename].content);
    } catch (error) {
      console.error('下载书签失败:', error);
      throw error;
    }
  },

  // 将书签树转换为扁平结构，key 用于唯一标识
  flattenBookmarks(bookmarkNodes, path = '') {
    const bookmarks = [];
    function traverse(node, currentPath) {
      if (node.url) {
        const key = `${currentPath}/${node.title}|${node.url}`;
        bookmarks.push({
          key,
          title: node.title,
          url: node.url,
          path: currentPath,
          dateAdded: node.dateAdded
        });
      } else if (node.children) {
        const newPath = currentPath ? `${currentPath}/${node.title}` : node.title;
        node.children.forEach(child => traverse(child, newPath));
      }
    }
    bookmarkNodes.forEach(node => traverse(node, path));
    return bookmarks;
  },

  // 比较本地和云端书签，只判断新增、删除、移动
  compareBookmarks(localBookmarks, cloudBookmarks) {
    const flatLocal = this.flattenBookmarks(localBookmarks);
    const flatCloud = this.flattenBookmarks(cloudBookmarks);

    // 先找出所有“移动”的书签（url 和 title 相同，但 path 不同）
    const moved = [];
    const movedKeysLocal = new Set();
    const movedKeysCloud = new Set();

    flatLocal.forEach(local => {
      const cloud = flatCloud.find(
        c => c.url === local.url && c.title === local.title && c.path !== local.path
      );
      if (cloud) {
        moved.push({
          bookmark: local,
          oldPath: cloud.path,
          newPath: local.path
        });
        movedKeysLocal.add(`${local.path}/${local.title}|${local.url}`);
        movedKeysCloud.add(`${cloud.path}/${cloud.title}|${cloud.url}`);
      }
    });

    // 新增：本地有、云端没有，且不是“移动”过来的
    const cloudMap = new Map(flatCloud.map(b => [`${b.path}/${b.title}|${b.url}`, b]));
    const added = flatLocal.filter(local =>
      !cloudMap.has(`${local.path}/${local.title}|${local.url}`) &&
      !movedKeysLocal.has(`${local.path}/${local.title}|${local.url}`)
    );

    // 删除：云端有、本地没有，且不是“移动”过去的
    const localMap = new Map(flatLocal.map(b => [`${b.path}/${b.title}|${b.url}`, b]));
    const deleted = flatCloud.filter(cloud =>
      !localMap.has(`${cloud.path}/${cloud.title}|${cloud.url}`) &&
      !movedKeysCloud.has(`${cloud.path}/${cloud.title}|${cloud.url}`)
    );

    // 文件夹结构变化（可选保留）
    const localFolders = new Set(flatLocal.map(item => item.path.split('/').slice(0, -1).join('/')).filter(Boolean));
    const cloudFolders = new Set(flatCloud.map(item => item.path.split('/').slice(0, -1).join('/')).filter(Boolean));
    const addedFolders = [...localFolders].filter(folder => !cloudFolders.has(folder));
    const removedFolders = [...cloudFolders].filter(folder => !localFolders.has(folder));
    const structureChanges = { addedFolders, removedFolders };

    return {
      added,
      deleted,
      moved,
      structureChanges
    };
  },

 
};

export default gistApi; 