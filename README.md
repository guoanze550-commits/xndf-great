> **V3.0 开发分支：三重边界**。原第一关保留，新增断桥迷城与倒悬之境，三关自动连续，音乐跨关保持。[玩法、操作与验收](docs/V3.md)。main仍为V2.2，需通过PR审核后合并。

> **V2.2：多层遗迹与连接镜头（包版本 0.2.2）**。保持原五次空间跨越，新增推近、连接停留、人物行走回拉与低动态选项。[V2.2 说明](docs/V2.2.md) · [本轮实际验收与交付状态](docs/V2.2-ACCEPTANCE.md)。上一稳定版已保留为 `v2.1-stable`。

> **背景音乐接入**：保留游戏视觉与玩法，仅接入用户提供的探索音乐、本地 MP3、循环及持久音量设置。[接入与实际验收记录](docs/BACKGROUND-MUSIC.md)。

> **V2.0 历史记录（包版本 0.2.0）**。三组联动机构、五次视觉重合与同一场景中的高低回路。V1 已保留为 `v1.0-stable`。[V2 玩法、解答与工程说明](docs/V2.md) · [V2 验证记录](docs/V2-ACCEPTANCE.md)。

# 界限 / THE PERMITTED WORLD

**每一条被允许的路，都是另一种可能的消失。**

原创单场景第三人称正交视角艺术解谜游戏，Vite + TypeScript + Three.js + MediaPipe Hand Landmarker + Electron。三座冬日石岛、三根电线杆、一扇暖光门。玩家改变可行走的空间秩序，让人物从 I 经 II 抵达 III。

当前定位是 **0.2.2 课堂主题作业**：网页优先保证鼠标通关，手势作为增强体验；Apple Silicon Mac 提供可通过 ZIP 分享的 `.app`，用于断网演示。不以商业发行、App Store、Developer ID 签名或公证为当前交付前提。

**课堂请先看：[简洁中文使用说明](docs/CLASSROOM.md)**。展示步骤、网页入口、两个手势、鼠标备用和本地运行方式均在其中；[V2.2 验收记录](docs/V2.2-ACCEPTANCE.md)区分自动测试与真实设备验证。

## V2.2 课堂 Mac ZIP（历史已验证，本分支尚未构建 V3 Mac 包）

[V2.2 Apple Silicon ZIP 下载](https://github.com/guoanze550-commits/xndf-great/actions/runs/39404692221/artifacts/12256654195)（[成功运行](https://github.com/guoanze550-commits/xndf-great/actions/runs/39404692221)）：本次 0.2.2 `.app`、签名/ZIP/资源校验，以及原生 Mac 屏蔽网络后的音乐解码、五段鼠标与镜头自动验证均已成功。登录 GitHub 下载并解开外层 Artifact ZIP，再解开内层课堂 ZIP；真实课堂设备首次安装和摄像头仍需验收。[下载说明与 SHA-256](docs/CLASSROOM-DOWNLOAD.md)。

保留 Pages、DMG 工作流，并继续使用独立 [Build classroom Mac ZIP](https://github.com/guoanze550-commits/xndf-great/actions/workflows/build-classroom-mac.yml)。相关 `main` 提交会自动构建，也可在 Actions 手动运行 `main`；成功后下载 `The-Permitted-World-Classroom-Mac-Apple-Silicon-arm64` Artifact。外层 Artifact ZIP 内含可再分发的 `.app` ZIP、校验值和自动验证报告。无需 Apple 开发者账户或 Secrets。

Apple Silicon Mac 本机构建：`npm ci`、`npx --no-install install-electron`、`npm run classroom:mac`。输出到独立 `release-classroom/`，保留原 `release/` 和网页 `dist-web/`。运行 `npm run test:offline` 可在实际 Electron 中屏蔽所有 HTTP(S)/WebSocket，再验证本地模型推理与完整鼠标通关；该检查不等同于真实 Mac 断网验收。

## 在 Safari / Chrome 直接体验网页版

无需等待 DMG。网页版入口为 **https://guoanze550-commits.github.io/xndf-great/**。V2.2 已由 [运行 39406157991](https://github.com/guoanze550-commits/xndf-great/actions/runs/39406157991) 部署，线上源提交 `4d56508`、脚本、样式、模型和 WASM 校验均通过。

继续使用独立的 [Deploy web game to GitHub Pages](https://github.com/guoanze550-commits/xndf-great/actions/workflows/deploy-pages.yml) 工作流，推送 `main` 后自动构建、验证和部署。当前仓库已成功部署；新建副本首次启用和排错步骤见 `docs/WEB.md`。

网页使用独立 `dist-web/` 与 `/xndf-great/` 子路径，桌面代码和 DMG 工作流保持不变。鼠标无需摄像头；手势只在 HTTPS 页面上按需申请权限，使用同源本地模型和 WASM。Mac Safari/Chrome 与真实摄像头尚须实机验收。[完整部署、验证与排错说明](docs/WEB.md)。

## 开始开发

需要 Node.js 24（仓库使用精确依赖版本及 package-lock.json）。在此仓库目录运行：

```bash
npm ci
npx --no-install install-electron
npm run typecheck
npm test
npm run build
npm run dev
```

Vite 默认端口 5173。开发服务器只在开发时使用；**桌面应用不依赖服务器**。Electron 44 的二进制安装需要显式 `install-electron`，锁定依赖安装本身不一定会下载二进制。

桌面开发：

```bash
npm run build
npm run desktop
```

修改 renderer 后需重新构建再启动桌面。云端无显示设备时使用浏览器验证；`npm run test:desktop` 会在 Linux 的 headless Ozone / SwiftShader 测试配置中启动实际 Electron，普通桌面启动不附加这些参数。

## 怎样玩

1. 点击「进入界限」。摄像头不是启动条件。
2. 在场景中按住鼠标左右拖动，或拖动底部秩序刻度。
3. 对齐石阶两端，观察雪与冰晶反馈；合法后点击「允许前行」。
4. 依次经过 **A→西阶→中庭 B→东廊→上庭 B2→终点 C**，共五次过渡。当前安全位置决定操作机构，中央轴需要复用三次；西阶与回廊保留已确定的朝向。
5. 位置重合还须满足方向和入口可达性；折返和远处无入口的桥不会获得许可。需要时点「观察提示」。
6. 行走期间结构锁定；旧冰先消失，新冰再凝结。完成后可重开或静音。

完整课堂展示解答、组合表和投影算法见 [V2 说明](docs/V2.md)。键盘左右箭头微调、Enter 确认；聚焦滑块时使用滑块自身键盘操作。

### 手势模式（可选）

点击右下角「启用手势」，在系统提示中授权摄像头：

- 将一只手置于画面中间，张开手掌保持片刻完成校准。
- 保持张开，左右移动手掌以改变旋转角；放置手的位置会成为相对控制原点。
- 拇指、食指捏合确认。持续捏合只确认一次，松开才会重新触发。
- 手丢失后冻结输入，再检测到张开的手时重新建立原点，避免跳变。
- 「重新校准」可重设原点；「−」只隐藏预览，**不会关闭摄像头**。请选择「关闭摄像头」停止视频轨道与模型。

摄像头视频只在本机内存中处理，不上传、不录制、不保存。应用不申请麦克风权限。权限被拒、没有摄像头或模型加载失败时，鼠标始终可以通关。

## 自动验收

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:desktop
```

有系统 Chromium 的云环境可用 `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`。端到端测试真实使用鼠标拖动、点击、等待行走完成，没有直接设置关卡状态。测试覆盖摄像头拒绝后的完整通关、离线资源、本地 MediaPipe 对合成视频的实际初始化与推理。**合成帧推理不等于真人手势或系统摄像头硬件验收。**

测试图片与失败诊断在 `test-results/`（不提交）。详细结果和设备验收表见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。

## 保留的 DMG 构建方案（课堂 ZIP 之外的可选方式）

1. 在 Codex 检查变更和测试结果，提交修改并推送到 GitHub 的 `main` 分支。初始远程仓库为空时，必须先产生首个提交及 `main` 分支，GitHub 才能发现工作流。
2. 打开 GitHub 仓库 → **Actions → Build Apple Silicon Mac → Run workflow**。
3. 首次选择 `signed: false`。工作流使用 `macos-15`（ARM64）、Node 24、`npm ci`，运行类型检查、规则测试、生产构建、浏览器验收，再生成 DMG。
4. 构建会检查 Mach-O **仅 arm64**、ASAR 中 HTML/JS/模型/WASM/preload、模型 SHA-256、摄像头用途声明，并用 `hdiutil verify` 检查 DMG 完整性。还会在该 Mac runner 上启动打包后的 Electron 应用做冒烟检查。
5. 成功后在该运行的 **Artifacts** 下载 `The-Permitted-World-Apple-Silicon-arm64-adhoc-internal`，解压后获取：

   `The-Permitted-World-0.1.0-macOS-Apple-Silicon-arm64.dmg`

6. `verification.txt` 包含架构、包大小和 SHA-256。Artifact 是测试产物，**不会自动发布 GitHub Release**。构建失败时查看具体步骤和 `validation-diagnostics`。

当前云端是 Linux。已交叉生成 ARM64 `.app` 目录并检查 Mach-O 与离线资源，但未在此云端生成或验证 DMG；GitHub API 访问被环境拒绝，所以也未实际触发 Actions。工作流文件及检查程序已创建，须在 GitHub 运行成功后才能把包提供给用户。

本机 Apple Silicon Mac 也可以运行 `npm run dist:mac`，然后 `npm run verify:mac`。该命令构建内部 ad-hoc 签名包，不需要 Apple 开发者证书。

## Mac 安装与支持范围

- 目标：**Apple Silicon M1 或更新芯片，macOS 13 Ventura 或更高版本**，建议先在 macOS 15 上测试。不包含 Intel x64 构建。
- Electron 44 官方最低要求为 macOS 13；本项目 `minimumSystemVersion` 与其一致。依据：[Electron v44 breaking changes](https://github.com/electron/electron/blob/v44.9.0/docs/breaking-changes.md#removed-macos-12-support)。最低版本和其他设备的实际运行仍待实机确认。
- 下载 Artifact 并解压，双击 DMG，将 **The Permitted World.app** 拖入 **Applications**。弹出磁盘映像，从 Applications 启动。
- 内部包只有本机 ad-hoc 签名，**没有 Apple Developer ID 信任，也未经公证**。其他 Mac 下载后仍可能被 Gatekeeper 拦截，不能称为免阻碍正式发行版。
- 仅对来源可信且已核对校验值的测试包，按系统提示在「系统设置 → 隐私与安全性」中处理此应用的打开许可。不同 macOS 版本的按钮与流程可能不同；如没有可用许可选项，课堂可先采用网页版；断网演示请换用已提前验证的 Mac。
- 不要求关闭 Gatekeeper、SIP 或全局降低安全设置，也不默认运行清除隔离标记的终端命令。
- 第一次只使用鼠标不需要摄像头。启用手势时才申请权限；此前拒绝后可在「系统设置 → 隐私与安全性 → 摄像头」授权，再退出并重开应用。
- 每次启动为新的一局，不会恢复上一局的临时状态；模型与所有游戏资源已内置，安装完成后可完全离线游玩。

## 可选的正式签名与公证（非本次课堂交付目标）

仅未来选择正式分发时才需要 Apple Developer Program 的 Developer ID Application 证书以及 Apple 公证凭据。在仓库 **Settings → Secrets and variables → Actions** 安全添加：

| Secret | 内容 |
| --- | --- |
| `CSC_LINK` | 导出的 Developer ID `.p12` 证书（electron-builder 支持的 Base64 内容） |
| `CSC_KEY_PASSWORD` | `.p12` 密码 |
| `APPLE_ID` | Apple 开发者账户 |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple 应用专用密码 |
| `APPLE_TEAM_ID` | 开发团队 ID |

不要将密钥或值写入代码、聊天、工作流或 README。运行 workflow 并选择 `signed: true`，会启用 hardened runtime、摄像头/JIT entitlements、Developer ID 签名与公证，随后执行 codesign、stapler 和 Gatekeeper 检查。该分支尚未使用真实凭据执行。

**仅未来正式发布前：**在一台真实目标 Mac 启动打包后的应用、验证摄像头权限与真人手势、关闭网络通关、退出后重新打开；再让另一台 Mac 从实际下载渠道下载、安装、首次启动，并确认 Gatekeeper 信任。CI runner 的冒烟检查不能替代这些步骤。逐项记录在设备验收表中。

## 常见问题

| 现象 | 排查或恢复 |
| --- | --- |
| 点击应用无法打开 | 确认 Apple Silicon / macOS 13+、DMG 完整性、内部包的 Gatekeeper 状态；课堂可先使用网页，离线须在演示 Mac 预先测试 |
| 黑屏或图形提示 | 重启应用、关闭其他图形程序、更新系统；浏览器开发时启用硬件加速；检查是否完整运行 `npm run build` |
| 本地资源加载失败 | 重新获取完整安装包；不要单独复制 HTML；运行 `npm run verify:mac` 检查 ASAR |
| 手势无法启用 | 检查系统摄像头授权、是否被其他程序占用；关闭后重启摄像头；继续鼠标模式 |
| 手不跟随或误触 | 改善光线、单手完整入镜、重新校准；保持张开 0.22 秒、捏合 0.16 秒以上 |
| 人物不前进 | 等待冰路完全形成，并确认连接的是人物所在平台的下一站 |
| 暂时不能旋转 | 人物行走时是正常锁定；到达平台后恢复 |
| Electron 二进制未安装 | `npx --no-install install-electron`；保留 TLS/校验，检查 GitHub 下载访问，不要禁用校验 |

## 代码结构与资源许可

- `src/game/rules.ts`：有限状态机，唯一道路与通行授权来源。
- `src/scene/`：原创建筑、冰路生长 Shader、暗水面 Shader、三层雪粒子、角色与行走、真实下垂电线、软阴影和克制 Bloom。
- `src/input/`：单手关键点读取、尺度归一化捏合、平滑、滞回、失踪冻结、权限与生命周期。
- `src/game/audio.ts`：低音量、本机合成的风、凝冰、共鸣、脚步与结尾音，不使用外部音频。
- `electron/`：`permitted://world/` 安全资源协议、严格导航与媒体权限、隔离 preload。关闭 nodeIntegration，启用 sandbox 与 contextIsolation。
- `scripts/`：资源准备、可选模型重建、Mac 包核验、真实 Electron 冒烟测试。
- `public/vision/`：本地模型、来源与修改声明。WASM 从锁定 npm 依赖生成。生产构建不访问模型下载站点。

代码 MIT；第三方资源须保留原许可证及修改声明，见 [third-party/NOTICE.md](third-party/NOTICE.md)。不依赖外部 API、CDN、网页背景图片、在线字体或在线游戏服务。
