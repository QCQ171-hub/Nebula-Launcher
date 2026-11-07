import { useEffect } from "react";
import type { ComponentType } from "react";
import { AlertTriangle } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { Toasts } from "./components/Toasts";
import { GameConsole } from "./components/GameConsole";
import { call, isTauri, on } from "./lib/bridge";
import type { GameStateEvent, GameLogEvent, ProgressEvent, Route } from "./lib/types";
import { AccountsPage } from "./pages/Accounts";
import { AiPage } from "./pages/Ai";
import { DownloadsPage } from "./pages/Downloads";
import { HomePage } from "./pages/Home";
import { ModsPage } from "./pages/Mods";
import { SettingsPage } from "./pages/Settings";
import { VersionsPage } from "./pages/Versions";
import { useApp } from "./store/app";
import { errorText } from "./store/app";

const PAGES: Record<Route, ComponentType> = {
  home: HomePage,
  versions: VersionsPage,
  mods: ModsPage,
  downloads: DownloadsPage,
  ai: AiPage,
  accounts: AccountsPage,
  settings: SettingsPage,
};

export default function App() {
  const ready = useApp((s) => s.ready);
  const route = useApp((s) => s.route);
  const appInfo = useApp((s) => s.appInfo);
  const backendError = useApp((s) => s.backendError);

  useEffect(() => {
    void useApp.getState().bootstrap();
  }, []);

  // 下载中心的状态来自 Rust 侧的 job 表，轮询保证切到别的页面再回来也能看到全貌
  useEffect(() => {
    const timer = window.setInterval(() => void useApp.getState().refreshDownloads(), 800);
    return () => window.clearInterval(timer);
  }, []);

  // 全局拖放：把 .jar 拖进窗口 = 安装到当前实例的 mods 目录
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    let dispose: (() => void) | undefined;

    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const jars = event.payload.paths.filter((p) => p.toLowerCase().endsWith(".jar"));
        if (!jars.length) return;

        const store = useApp.getState();
        const instanceId = store.activeInstanceId;
        if (!instanceId) {
          store.pushToast("error", "请先在版本库创建实例，再拖入模组");
          return;
        }
        void call<string[]>("mod_install_local", { instanceId, paths: jars })
          .then((files) => {
            store.pushToast("success", `已拖入安装 ${files.length} 个模组`);
            store.setRoute("mods");
          })
          .catch((err) => store.pushToast("error", errorText(err)));
      })
      .then((fn) => {
        if (alive) dispose = fn;
        else fn();
      });

    return () => {
      alive = false;
      dispose?.();
    };
  }, []);

  // 全局订阅：游戏状态 / 游戏日志 / 安装进度
  useEffect(() => {
    let alive = true;
    const disposers: Array<() => void> = [];

    const bind = <T,>(event: string, handler: (payload: T) => void) => {
      on<T>(event, (payload) => {
        if (alive) handler(payload);
      }).then((dispose) => {
        if (alive) disposers.push(dispose);
        else dispose();
      });
    };

    bind<GameStateEvent>("game://state", (e) => {
      const store = useApp.getState();
      store.setRunning(e.instanceId, e.state === "running");
      if (e.state === "running") {
        store.pushToast("success", `游戏已启动${e.message ? ` · ${e.message}` : ""}`);
      } else {
        store.pushToast("info", `游戏已退出${e.code == null ? "" : `（code ${e.code}）`}`);
        void store.refreshInstances();
      }
    });

    bind<GameLogEvent>("game://log", (e) => useApp.getState().appendLog(e.instanceId, e.line));

    bind<ProgressEvent>("install://progress", (e) => {
      const store = useApp.getState();
      store.setProgress(e);
      if (e.stage === "done") void store.refreshInstances();
    });

    return () => {
      alive = false;
      disposers.forEach((dispose) => dispose());
    };
  }, []);

  const Page = PAGES[route];

  return (
    <div className="app">
      <div className="app-bg" />
      <TitleBar version={appInfo?.version ?? "0.1.0"} />
      <div className="shell">
        <Sidebar />
        <main className="main">
          {backendError ? (
            <div className="page">
              <div className="page-inner">
                <div className="card backend-missing">
                  <div className="backend-icon">
                    <AlertTriangle size={26} />
                  </div>
                  <h2>缺少后端</h2>
                  <p>{backendError}</p>
                  <div className="backend-steps">
                    <div>
                      <b>桌面运行</b>
                      <code>nebula-launcher.exe</code>
                      <span>双击打包后的程序，前端会随窗口一起载入。</span>
                    </div>
                    <div>
                      <b>开发模式</b>
                      <code>npm run tauri:dev</code>
                      <span>由 Tauri CLI 同时拉起 Vite 与 Rust 后端。</span>
                    </div>
                  </div>
                  <p className="backend-foot">
                    单纯用浏览器打开 <code>npm run dev</code> 只能看到静态页面，所有功能都依赖 Rust 后端，因此不再提供假数据。
                  </p>
                </div>
              </div>
            </div>
          ) : ready ? (
            <div className="page">
              <div className="page-inner">
                <Page />
              </div>
            </div>
          ) : (
            <div className="empty" style={{ height: "100%" }}>
              <h4>Nebula Launcher</h4>
              <p>正在初始化数据…</p>
            </div>
          )}
        </main>
      </div>
      <Toasts />
      <GameConsole />
    </div>
  );
}
