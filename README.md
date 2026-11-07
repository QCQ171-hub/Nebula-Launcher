# Nebula Launcher

一个用 **Rust + Tauri 2 + React** 写成的 Minecraft 桌面启动器。无边框窗口、自绘标题栏，支持原版 / Fabric 安装、Modrinth 模组与整合包、以及微软正版、皮肤站（authlib-injector）、离线三种登录方式。

> 前端只负责界面，所有网络请求、文件校验、进程管理都在 Rust 侧完成，因此不存在"只开个网页"的情况——`tauri dev` / `tauri build` 产出的是真正的桌面程序。



---

## 功能一览

| 模块   | 能力                                                                                         |
| ---- | ------------------------------------------------------------------------------------------ |
| 版本管理 | Mojang 版本清单，正式版 / 测试版 / 前沿测试版 / 愚人节 / 远古版本五类智能归类，`inheritsFrom` 合并、`rules` 平台判定、BMCLAPI 镜像 |
| 游戏下载 | 客户端 jar、libraries、assets 并发下载，SHA-1 校验，`.part` 断点续传式写入，进度事件                                |
| 加载器  | Fabric（quilt 风格 profile 由 fabric-meta 生成），自动合并父版本                                          |
| 模组   | Modrinth 搜索 / 版本列表 / 依赖下载，按实例存放，一键启用禁用                                                     |
| 整合包  | 导入 Modrinth `.mrpack`，解析 `modrinth.index.json` 并生成实例                                       |
| 登录   | 微软设备码 OAuth（XBL → XSTS → Minecraft Services）、authlib-injector 皮肤站、离线 UUID                  |
| 启动   | 占位符替换、JVM 调优参数、natives 解压、classpath 拼装、stdout 实时日志                                         |
| 存储   | natives 硬链接共享、日志自动轮转、存储占用面板（一键清理缓存 / 日志 / Natives）                                         |
| 界面   | 无边框窗口 + 自定义标题栏（拖动 / 最小化 / 最大化 / 关闭）、首页/版本库/模组/账户/设置                                        |



---

## 技术栈

- **后端**：Rust 2021（1.77+，实测 1.99）、Tauri 2、tokio、reqwest、serde、sha1、zip
- **前端**：React 19、TypeScript 5.8、Vite 6、zustand、lucide-react
- **打包**：Tauri CLI（NSIS 安装包）
- **运行时**：需要本机 Java（默认 `E:\cpp\jdk-25.0.5.0.3\bin\java.exe`，可在设置里改）

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 准备 WebView2 运行时（只需一次；系统已装可跳过）
powershell -ExecutionPolicy Bypass -File scripts\fetch-webview2.ps1

# 3. 开发模式（自动拉起 Vite + Rust，热重载）
npm run tauri:dev

# 4. 生产构建（先 vite build，再编译 Rust，最后打 NSIS 包）
npm run tauri:build
```

产物位置：`E:\cpp\nebula-build\release\bundle\nsis\*.exe`  
（`src-tauri/.cargo/config.toml` 把构建目录重定向到了 `../../nebula-build`，调试产物在 `E:\cpp\nebula-build\debug\`）

> **关于 WebView2**：Tauri 在 Windows 上靠 WebView2（Edge 内核）渲染界面。如果系统里的 Evergreen 运行时被卸载或损坏（注册表有记录、目录却是空的），安装程序会拒绝重装，界面就会白屏。本项目支持**固定版便携运行时**：
>
> - `scripts/fetch-webview2.ps1` 会下载官方 CAB、校验 SHA256、解压到项目根的 `webview2/`（约 662MB，已在 `.gitignore` 里）；
> - `src-tauri/src/main.rs` 启动时按 `环境变量 → 程序目录旁 webview2/ → 系统运行时` 的顺序查找，整条链路都不需要管理员权限；
> - 分发时把 `webview2/` 目录随 exe 一起拷过去即可（可放在 exe 同级或 `resources/` 下）。
>
> **当前精简版未附带运行时**：仓库里只有脚本、没有 662MB 的运行时文件。首次运行前请先执行
> `powershell -ExecutionPolicy Bypass -File scripts\fetch-webview2.ps1`，或确保系统 Evergreen 运行时可用，
> 否则窗口会报 `Could not find the webview runtime`。

> **构建目录瘦身**：`E:\cpp\nebula-build` 里的 `deps/` / `build/` / `incremental/` 都是编译中间产物，
> 可随时删除，只保留 `debug/nebula-launcher.exe` 与 `WebView2Loader.dll` 即可运行。
> 删掉后下次 `cargo build` 会全量重编（约 10 分钟），属正常现象。

> **没有假数据回退**：`src/lib/mock.ts` 已删除。检测不到 Tauri 容器时，`call()` 直接抛出「缺少后端」，界面会显示明确的启动指引；所有功能都必须在桌面窗口（`npm run tauri:dev` 或打包后的 exe）里运行。开发地址固定用 `127.0.0.1:8788` 而非 `localhost`——部分机器上 `localhost` 会先解析到 `::1`，被代管代理或防火墙拦掉会直接报连接拒绝。

---

## 目录结构

```
HTMLButCpp/
├─ index.html
├─ vite.config.ts               # 端口 8788（与 tauri.conf devUrl 对齐）
├─ src/                         # ── 前端 ──
│  ├─ App.tsx                   # 布局 + 路由 + 全局事件订阅
│  ├─ components/
│  │  ├─ TitleBar.tsx           # 自定义标题栏与窗口控制
│  │  ├─ Sidebar.tsx            # 侧边导航
│  │  ├─ InstanceDialog.tsx     # 新建实例
│  │  ├─ Modal.tsx              # 弹窗 / 确认框
│  │  ├─ Toasts.tsx  ui.tsx  Logo.tsx
│  ├─ pages/
│  │  ├─ Home.tsx               # 首页：启动、实例、实时日志
│  │  ├─ Versions.tsx           # 版本库：分类标签页 + 原版/Fabric/Forge/NeoForge 安装
│  │  ├─ Downloads.tsx          # 下载中心：进度、实时速度、取消
│  │  ├─ Mods.tsx               # 模组：Modrinth 搜索与安装
│  │  ├─ Accounts.tsx           # 账户：三种登录
│  │  └─ Settings.tsx           # 设置：Java、内存、镜像、并发、存储占用
│  ├─ lib/
│  │  ├─ bridge.ts              # invoke 封装：非 Tauri 容器直接抛「缺少后端」
│  │  ├─ types.ts  versions.ts  format.ts
│  ├─ store/app.ts              # zustand 全局状态（实例、账户、日志、进度）
│  └─ styles/global.css         # 设计系统（变量、卡片、按钮、日志…）
│
└─ src-tauri/                   # ── 后端 ──
   ├─ tauri.conf.json           # 窗口：decorations:false、1240×800
   ├─ capabilities/default.json # 窗口控制 / 文件选择 / 打开链接 权限
   └─ src/
      ├─ main.rs  lib.rs        # 入口、插件、命令注册
      ├─ error.rs               # AppError → 前端可读的错误字符串
      ├─ model.rs               # 领域模型 + Mojang 元数据结构
      ├─ config.rs  state.rs    # 设置持久化 / AppState（实例、账户、进程表）
      ├─ util.rs                # 路径、SHA-1、时间戳、脱敏
      ├─ core/
      │  ├─ meta.rs             # 清单拉取、版本继承合并、rules 判定
      │  ├─ download.rs         # 并发下载器（重试 / 校验 / 取消 / 进度）
      │  ├─ install.rs          # 安装编排：jar + libraries + assets + natives
      │  ├─ java.rs             # Java 探测与版本匹配
      │  ├─ launch.rs           # 参数拼装、进程启动、日志流
      │  ├─ fabric.rs           # Fabric loader 版本与 profile 安装
      │  ├─ modrinth.rs         # Modrinth API
      │  ├─ modpack.rs          # .mrpack 导入
      │  └─ auth/
      │     ├─ microsoft.rs     # 设备码 → XBL → XSTS → Minecraft
      │     ├─ authlib.rs       # 皮肤站 Yggdrasil + authlib-injector
      │     └─ offline.rs       # 离线 UUID
      └─ commands/              # Tauri 命令层（薄壳，业务在 core）
         ├─ app.rs  versions.rs  instances.rs  accounts.rs  mods.rs
```

---

## 核心模块划分

后端严格分层：**commands（协议层）→ core（业务）→ state / util（基础设施）**。命令层只做参数校验和错误转换，方便将来换 IPC 传输或做单元测试。

| 文件                 | 职责     | 关键点                                                                                                                                        |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `core/meta.rs`     | 版本元数据  | 清单带 5 分钟内存缓存；`inheritsFrom` 递归合并；`rules` 里按 `os.name`、`arch`、`features` 过滤；1.19+ 的 `natives-windows` 独立 artifact 与老式 `classifiers` 两条路径都支持 |
| `core/download.rs` | 并发下载   | `for_each_concurrent` + 信号量控制并发；先比文件大小跳过已存在文件；失败重试 3 次（退避 400/800/1200ms）；写 `.part` 再改名；SHA-1 不匹配删掉重来；`AtomicBool` 取消                      |
| `core/install.rs`  | 安装     | 一次收集全部 `DownloadItem` 再统一跑，减少事件抖动；assets 走 objects 哈希目录；natives 从 jar 解压并按 `extract.exclude` 过滤                                            |
| `core/launch.rs`   | 启动     | 用正则替换 `${auth_player_name}` 等占位符；`-Djava.library.path` 指向临时 natives 目录；子进程 stdout/stderr 两路合并后按行 emit `game://log`                         |
| `core/fabric.rs`   | Fabric | 从 meta.fabricmc.net 取 loader 列表，生成 `fabric-loader-<loader>-<game>` 的 profile 后按常规版本安装                                                      |
| `core/auth/*`      | 三种登录   | 见下文                                                                                                                                        |

---

## 关键实现思路

### 1. 无边框窗口与自定义标题栏

`tauri.conf.json` 里 `decorations: false`，窗口边框与按钮全部交给前端：

```json
{ "label": "main", "decorations": false, "shadow": true, "minWidth": 1040, "minHeight": 680 }
```

拖动区域用 `data-tauri-drag-region`（Tauri 内置，双击最大化也生效），按钮直接调窗口 API：

```tsx
const appWindow = isTauri() ? getCurrentWindow() : null;

<div className="titlebar-drag" data-tauri-drag-region />
<button onClick={() => appWindow?.minimize()} />
<button onClick={() => appWindow?.toggleMaximize()} />
<button onClick={() => appWindow?.close()} />
```

`onResized` 里重新读 `isMaximized()`，图标在「最大化 / 还原」之间切换。对应权限已在 `capabilities/default.json` 显式列出（`core:window:allow-minimize` 等），少一条就会在运行时报 ACL 错误。

### 2. 三种登录

**微软正版（设备码流程，无需内嵌浏览器）**

```
devicecode  → 用户在浏览器输入 code
    ↓ 轮询 token
Xbox Live user.auth.xboxlive.com/user/authenticate   → XBL token
    ↓
xsts.auth.xboxlive.com/xsts/authorize                → XSTS token
    ↓
api.minecraftservices.com/authentication/login_with_xbox → access_token
    ↓
api.minecraftservices.com/minecraft/profile          → uuid + 皮肤 + 正版验证
```

需要在设置里填 Azure 应用的 **Client ID**（该应用要允许公共客户端流）。令牌过期后 `auth::ensure_fresh` 会在启动前用 `refresh_token` 自动续期，失败才提示重新登录。

**皮肤站（authlib-injector）**

先 `GET {base}/` 读 `authlib-injector` 元数据拿到 `authserver`，再 `POST /authserver/authenticate` 换 `accessToken` + `selectedProfile`。启动时把 `authlib-injector.jar` 作为 `-javaagent` 挂上，并注入：

```
-Dminecraft.api.auth.host=...  -Dminecraft.api.account.host=...
-Dminecraft.api.session.host=...  -Dminecraft.api.services.host=...
```

这样游戏内的心跳、皮肤、会话校验都会走皮肤站。

**离线登录**

`uuid = md5("OfflinePlayer:" + name)`，按 RFC 4122 把第 7、9 字节的版本位与变体位改成 3 / `a`，输出带连字符的形式。

### 3. 下载器

```rust
futures_util::stream::iter(items)
    .for_each_concurrent(concurrency, |item| async move { ... })
    .await;
```

- 并发数来自设置（4~64，默认 16）
- 已存在且大小一致的文件直接跳过，重复安装几乎瞬间完成
- 每个文件最多 3 次重试，首个错误被记住并最终抛出
- 每完成一个文件 emit 一次 `install://progress`，前端只做展示，不做状态机
- `cancel_install` 把对应 `TaskId` 的 `AtomicBool` 置 true，正在写的 `.part` 会被删除

### 4. 版本解析

客户端 json 有两种形态：**原版**（自带 `libraries` / `assets` / `mainClass`）和**派生版**（Fabric 的 profile 只有 `inheritsFrom` + 增量 libraries）。`meta::resolve` 递归合并父版本：libraries 追加、arguments 拼接、`assetIndex` / `mainClass` 缺省继承。

`rules` 判定按顺序扫描，`allow` / `disallow` 后写覆盖先写，最终决定某个库在当前平台是否生效——这是跨平台正确性的关键，Windows 上主要过滤 `osx`、`linux` 条目与 `natives-windows` 分类器。

### 5. 启动流程

```
校验实例 → 检查文件是否装好 → 取账户（必要时刷新令牌）
   → 解析版本 → 探测 Java（版本不满足直接给出人话提示）
   → 解压 natives 到临时目录 → 拼参数 → spawn → 读日志
```

拼装时先取版本 json 里的 `arguments.jvm` / `arguments.game`（老版本是 `minecraftArguments` 字符串），逐个替换占位符，再补上内存、JVM 调优、natives 路径与 `-cp`。

### 6. 模组

Modrinth v2 API：`/search` 带 `facets=[["categories:fabric"],["versions:<gameVersion>"]]` 过滤，`/project/{id}/version` 取匹配加载器与游戏版本的 `files[0]`，下载到实例目录 `mods/`。禁用即把 `.jar` 改名为 `.jar.disabled`，启动时按文件名过滤。

### 7. 版本智能归类

Mojang 清单里只有 `release` / `snapshot` / `old_alpha` / `old_beta` 四种类型，直接把 700 多个 `snapshot` 平铺出来没法用。`src/lib/versions.ts` 在此基础上做了四层归类：

| 标签页  | 判定方式                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 正式版  | `type == release`，每个正式版可展开它名下的测试版                                                                                                          |
| 测试版  | 见下                                                                                                                                         |
| 愚人节  | 白名单：`15w14a`、`1.RV-Pre1`、`3D Shareware v1.34`、`20w14infinite`、`22w13oneblockatatime`、`23w13a_or_b`、`24w14potato`、`25w14craftmine`、`26w14a` |
| 远古版本 | `old_alpha` / `old_beta`（1.0 以前）                                                                                                           |

测试版的归属规则有两条，按优先级：

1. **id 自带版本号**：`1.20.5-rc3`、`26.1.2-rc-1`、`1.14 Pre-Release 4` 用正则取开头版本号，直接挂到同名正式版下。
2. **周快照**（`24w14a` 这类没有版本号的）：按 `releaseTime` 二分查找，归到**它发布之后第一个正式版**，徽章显示成「1.20.5 测试版」。
3. 找不到后续正式版的（永远是最新那几个）→ 归入「前沿测试版」，在测试版标签页置顶。

分类结果与官方清单（922 条）完全对齐：正式版 103、测试版 749（其中 7 个前沿）、愚人节 9、远古 61，无遗漏。注意 Mojang 从 2025 年底开始改用 `26.1 / 26.2 / 26.3` 的年度版本号，这套规则不依赖版本号格式，因此新旧命名都能正确归属。

### 8. 存储优化

一个装十几个版本的启动器很容易吃掉十几 GB，`natives` 是重灾区：每个版本目录都解压一份完全相同的 LWJGL DLL。这里做了三件事：

- **natives 硬链接共享**：native jar 按 Maven 路径解压到 `natives-cache/`，各版本 `natives/` 目录里的文件用 `std::fs::hard_link` 指过去。看起来是完整文件，磁盘上只有一份数据；跨卷或文件系统不支持时自动退回复制。
- **日志轮转**：启动前只保留最近 19 份日志，避免崩溃日志无限堆积。
- **存储面板**：设置页统计各目录体积（版本 / 依赖库 / 资源 / 实例 / Natives / 日志 / 清单），并提供三类一键清理——日志、Natives（连同各版本目录里的硬链接一起删，否则空间不会释放）、清单与临时文件。

注意「依赖库」和「游戏资源」不提供清理：它们按哈希共用，删了只是让下次安装重新下载。

---

## 数据目录

默认在 `%APPDATA%\com.nebula.launcher`（Tauri `app_data_dir`）：

```
com.nebula.launcher/
├─ settings.json          # 设置
├─ accounts.json          # 账户（含令牌）
├─ instances.json         # 实例索引
├─ versions/<id>/         # 版本 JSON、client.jar、natives/（硬链接）
├─ libraries/             # Maven 依赖
├─ assets/{indexes,objects}
├─ natives-cache/         # natives 解压缓存，各版本硬链接复用
├─ meta/                  # 版本清单缓存
├─ libs/                  # authlib-injector 等运行时组件
├─ logs/                  # 游戏日志
└─ instances/<instanceId>/
   ├─ mods/  saves/  config/  resourcepacks/
```

游戏本体与资源是**多实例共用**的（`versions/`、`libraries/`、`assets/`），只有存档、模组、配置按实例隔离，装十个版本也只占一份库文件。

---

## 常见问题

**Java 版本不够？** 启动前的 `java::meets_requirement` 会比对版本 json 里的 `javaVersion.majorVersion`；不满足时直接提示"该版本需要 Java 21+，当前是 17"，不会让游戏莫名崩溃。

**安装很慢？** 设置里把下载源切成 BMCLAPI 镜像，国内会快很多。


**微软登录提示未配置 Client ID？** 到 <https://portal.azure.com> 注册一个应用（受支持账户类型选"个人 Microsoft 账户"），在"身份验证"里允许公共客户端流，把应用 ID 填进「设置 → 微软登录」。

**启动后窗口是白的，任务管理器里也没有 `msedgewebview2.exe`？** 按下面两条排查：

1. **系统运行时缺失**。典型症状是注册表 `HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}` 还留着 `pv`，但 `C:\Program Files (x86)\Microsoft\EdgeWebView\Application` 已经不存在了。这时运行官方安装器只会报 `0x80040828 已为系统安装`——它认注册表不认文件。本项目的做法是绕开它：跑 `scripts\fetch-webview2.ps1` 准备便携运行时，程序会自动使用。
2. **第三方 DLL 注入**。Chromium 对内嵌 DLL 很敏感，检测到非预期注入会主动 `__debugbreak()`。崩溃转储在 `%LOCALAPPDATA%\com.nebula.launcher\EBWebView\Crashpad\reports\*.dmp`，用 WinDbg/cdb 打开看 `ExceptionCode`：若是 `0x80000003`（BREAKPOINT）且调用栈落在 `msedge.dll`，基本就是注入导致，把对应安全软件/沙箱对 `msedgewebview2.exe` 的注入关掉即可。

**编译时报 build script 权限错误？** 少数受限环境（沙箱、企业安全软件）会拦截 `target/` 下新生成的可执行文件写文件。把构建目录挪出去即可：

```bash
CARGO_TARGET_DIR=/path/outside/workspace cargo build
```

本仓库已经在 `src-tauri/.cargo/config.toml` 里固定了 `target-dir = "../../nebula-build"`（即 `E:\cpp\nebula-build`），改路径的话同步改那一行。另外，**不要**把构建产物（exe）拷到工作区目录里运行——同一套策略会拦住它加载 DLL，报 `error while loading shared libraries`。

---

## 参考

- [PCL-CE](https://github.com/PCL-community/PCL-CE) — 版本解析、下载源与启动参数的工程实践
- [BlockHelm-Launcher](https://github.com/zqq-699/BlockHelm-Launcher) — 界面分层与账户流程
- [Tauri v2 文档](https://v2.tauri.org.cn/start/)
- [Mojang 版本清单](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)
- [Modrinth API](https://docs.modrinth.com/)
- [authlib-injector](https://github.com/yushijinhun/authlib-injector)
