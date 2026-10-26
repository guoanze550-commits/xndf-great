# 默认游戏交付标准

从 V3.0 起，后续版本默认同时交付：

1. 可直接打开的 HTTPS 在线游戏，无需 Node.js、终端或安装。未合并版本使用独立预览子路径，保留 main 的稳定版。
2. Apple Silicon Mac 原生 Electron `.app` ZIP，下载、解压即可按 macOS 安全提示正常打开；包含全部离线资源，不要求用户安装 Node.js 或运行服务器。

复用 `preview-v3.yml` 和 `build-classroom-mac.yml`，不以网页服务器 ZIP 代替 Mac 应用。当前 V3.0 的 Mac 工作流须选择 `feature/v3-continuous-adventure`；不得合并 PR #1 或覆盖 main 来发布预览。

网页版预览路径：`https://guoanze550-commits.github.io/xndf-great/preview/v3/`，仅在部署及 HTTPS 核验成功后交付。GitHub 的 github-pages 环境须显式允许开发分支；保留 main 的规则，不绕过环境限制。

Mac ZIP 使用本机 ad-hoc 签名，不含 Developer ID 或公证。可信应用如被系统阻止，按「系统设置 → 隐私与安全性」中的「仍要打开」及系统确认流程处理；不关闭系统整体安全保护。

每次交付分别记录自动三关通关、关卡衔接、音乐/本地资源及原生 Mac 离线测试结果。真实 Mac 安装、真人摄像头、Safari、帧率与主观体验须单独标明人工验收情况，不将云端自动测试等同于课堂设备验证。
