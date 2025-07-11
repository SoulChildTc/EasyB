# EasyB

> 一键搞定多浏览器书签同步，轻松又快速。

![EasyB Logo](images/easyb-icon.svg)

## 项目简介
EasyB 是一款极简高效的浏览器扩展，支持在多浏览器间一键同步书签，基于 GitHub Gist 云端存储，安全可靠，界面美观，操作简单。

## 主要功能
- 🚀 一键上传/下载本地书签到云端
- ☁️ 支持多浏览器间书签同步
- 🔄 书签差异对比与自动同步
- 📝 操作日志与同步状态提示
- 🔒 数据存储基于 GitHub Gist，安全可控
- 🌈 极简现代 UI，支持深色模式

## 安装方法
1. 下载代码 https://github.com/SoulChildTc/EasyB/archive/refs/heads/main.zip
2. 解压后在 Chrome 地址栏打开 chrome://extensions/
3. 开启页面右侧的 开发者模式
4. 点击页面左侧的 加载已解压的扩展程序
5. 选择解压后的文件夹

## 使用说明
1. **首次使用**：
   - 在“设置”面板填写你的 GitHub Token（需 gist 权限），可选填写 Gist ID（留空将自动创建）。
2. **同步书签**：
   - 点击“上传书签”将本地书签同步到云端。
   - 点击“下载书签”将云端书签同步到本地。
3. **自动同步**：
   - 可在首页开启“自动同步”，书签变更时自动触发。
4. **对比与日志**：
   - “对比”面板可查看本地与云端书签差异。
   - “日志”面板可查看操作历史。

### 如何获取 GitHub Token 用于 EasyB 云同步

1. 登录你的 GitHub 账号
2. 点击右上角头像，选择 **Settings（设置）**
3. 在左侧菜单栏，滚动到底部，点击 **Developer settings（开发者设置）**
4. 在左侧菜单中，选择 **Personal access tokens（个人访问令牌）**
5. 点击 **Tokens (classic)**
6. 点击 **Generate new token（生成新令牌）** → **Generate new token (classic)**
7. 在 **Note（备注）** 字段中，输入一个描述性名称，如 “EasyB Sync”
8. 选择令牌的有效期（建议选择较长时间或不过期）
9. 在权限列表中，只需勾选 **gist** 权限
10. 滚动到底部，点击 **Generate token（生成令牌）** 按钮
11. **重要：生成的令牌只会显示一次，请立即复制并保存在安全的地方**
12. 将此令牌粘贴到 EasyB 的云同步设置中的 **GitHub Token** 字段

## 常见问题
- **Q: GitHub Token 如何获取？**
  - A: 见上文详细步骤。
- **Q: 数据安全吗？**
  - A: 所有书签数据仅存储在你的 GitHub Gist，EasyB 不会上传到其他服务器。
- **Q: 支持哪些浏览器？**
  - A: 支持 Chrome、Edge、Brave、国产 Chromium 内核浏览器等。

## 参与贡献
欢迎提交 Issue、PR 或建议！

1. Fork 本仓库
2. 新建分支并提交修改
3. 发起 Pull Request

## 开源协议

[MIT License](LICENSE)

---

> 让书签同步变得更简单，EasyB 让你的收藏无忧！

---

## AI 参与声明

本项目部分代码、文档和图标设计由 AI 辅助生成和优化，感谢 AI 技术为开发带来的高效与灵感。
