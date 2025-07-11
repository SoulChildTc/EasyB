// GitHub Gist API 相关功能
const gistApi = {
  // 验证 GitHub Token
  async validateToken(token) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  // 上传书签到 Gist
  async uploadBookmarks(bookmarks, token, gistId) {
    // 保留完整的书签树结构，包括 ID
    const content = JSON.stringify(bookmarks, null, 2);
    const description = 'EasyB 书签同步数据';
    const filename = 'bookmarks.json';

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
          throw new Error('更新 Gist 失败');
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
          throw new Error('创建 Gist 失败');
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
      const filename = Object.keys(data.files).find(name => name === 'bookmarks.json');
      
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

    const makeKey = b => `${b.path}/${b.title}|${b.url}`;
    const localMap = new Map(flatLocal.map(b => [makeKey(b), b]));
    const cloudMap = new Map(flatCloud.map(b => [makeKey(b), b]));

    // 新增
    const added = flatLocal.filter(local => !cloudMap.has(makeKey(local)));
    // 删除
    const deleted = flatCloud.filter(cloud => !localMap.has(makeKey(cloud)));
    // 移动
    const moved = [];
    flatLocal.forEach(local => {
      const cloud = flatCloud.find(c => c.url === local.url && c.title === local.title && c.path !== local.path);
      if (cloud) {
        moved.push({
          bookmark: local,
          oldPath: cloud.path,
          newPath: local.path
        });
      }
    });

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