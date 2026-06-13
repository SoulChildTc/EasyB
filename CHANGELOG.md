# Changelog

## [1.3] - 2026-06-13

### Fixed
- alarm 每次 SW 重启被重置，导致 checkSyncStale 可能永不触发
- 超过 7 天未同步时每 6 小时重复弹通知，改为只弹一次
- 保存设置时 settings 对象丢失 lastSyncTime，同步时间不显示
- 首次上传后 Gist ID 未同步到 popup，云端书签数不显示
- diff 面板展开/收起选择器错配，点击无效果

### Changed
- 清理冗余代码：重复加载 gist.js、Google Fonts preconnect、未使用的 empty-hint CSS
- notification 使用 requireInteraction 保持可见，按钮可打开扩展 popup

## [1.2] - 2026-06-13

### Removed
- 移除自动同步功能（MV3 Service Worker 无法可靠支持）

### Added
- 超过 7 天未同步时，Chrome 通知提醒，点击可打开扩展

### Changed
- 下载按钮代码简化，移除 auto-sync 相关控制逻辑

## [1.1] - 2026-06-13

### Fixed
- 修复下载书签时因浏览器语言不同导致根文件夹匹配失败、书签翻倍的问题。匹配逻辑改为按 Chrome 永久 ID 优先，title 兜底。

## [1.0] - 2026-06-12

### Added
- 一键上传/下载书签到 GitHub Gist
- 书签差异对比
- 自动同步（30 秒防抖）
- 操作日志
- 深色模式支持
