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

  // 将书签树转换为扁平结构
  flattenBookmarks(bookmarkNodes, path = '') {
    const bookmarks = [];
    const self = this;
    
    function traverse(node, currentPath) {
      if (node.url) {
        bookmarks.push({
          id: node.id,
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

  // 比较本地和云端书签
  compareBookmarks(localBookmarks, cloudBookmarks) {
    const flatLocal = this.flattenBookmarks(localBookmarks);
    const flatCloud = this.flattenBookmarks(cloudBookmarks);

    const added = [];
    const deleted = [];
    const modified = [];
    const moved = [];

    // 创建映射：ID -> 书签
    const localMap = new Map();
    flatLocal.forEach(bookmark => {
      localMap.set(bookmark.id, bookmark);
    });

    const cloudMap = new Map();
    flatCloud.forEach(bookmark => {
      cloudMap.set(bookmark.id, bookmark);
    });

    // 1. 查找新增和修改的书签
    flatLocal.forEach(local => {
      const cloud = cloudMap.get(local.id);
      if (!cloud) {
        // ID 不存在于云端，认为是新增的
        added.push(local);
      } else {
        // 检查是否有修改
        const isModified = cloud.url !== local.url || cloud.title !== local.title;
        // 检查是否移动了位置
        const isMoved = cloud.path !== local.path;
        
        if (isModified && isMoved) {
          // 既修改了内容又移动了位置
          modified.push({
            local,
            cloud,
            changes: {
              title: cloud.title !== local.title,
              url: cloud.url !== local.url,
              moved: true,
              oldPath: cloud.path,
              newPath: local.path
            }
          });
        } else if (isModified) {
          // 仅修改了内容
          modified.push({
            local,
            cloud,
            changes: {
              title: cloud.title !== local.title,
              url: cloud.url !== local.url,
              moved: false
            }
          });
        } else if (isMoved) {
          // 仅移动了位置
          moved.push({
            bookmark: local,
            oldPath: cloud.path,
            newPath: local.path
          });
        }
      }
    });

    // 2. 查找删除的书签
    flatCloud.forEach(cloud => {
      console.log('cloud', cloud);
      if (!localMap.has(cloud.id)) {
        // ID 不存在于本地，认为是删除的
        deleted.push(cloud);
      }
    });

    // 3. 检查文件夹结构变化（通过路径分析）
    const localFolders = new Set(flatLocal.map(item => item.path.split('/').slice(0, -1).join('/')).filter(Boolean));
    const cloudFolders = new Set(flatCloud.map(item => item.path.split('/').slice(0, -1).join('/')).filter(Boolean));
    
    const addedFolders = [...localFolders].filter(folder => !cloudFolders.has(folder));
    const removedFolders = [...cloudFolders].filter(folder => !localFolders.has(folder));

    const structureChanges = {
      addedFolders,
      removedFolders
    };

    console.log('对比结果:', { 
      added, 
      deleted, 
      modified,
      moved,
      structureChanges 
    });
    
    return {
      added,
      deleted,
      modified,
      moved,
      structureChanges
    };
  },

 
};

export default gistApi; 