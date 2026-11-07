import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";

import { isTauri } from "../lib/bridge";
import { Logo } from "./Logo";

const appWindow = isTauri() ? getCurrentWindow() : null;

export function TitleBar({ version }: { version: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!appWindow) return;
    let unlisten: (() => void) | undefined;
    let alive = true;

    appWindow
      .isMaximized()
      .then((value) => {
        if (alive) setMaximized(value);
      })
      .catch(() => undefined);

    appWindow
      .onResized(() => {
        appWindow
          .isMaximized()
          .then((value) => {
            if (alive) setMaximized(value);
          })
          .catch(() => undefined);
      })
      .then((fn) => {
        if (alive) unlisten = fn;
        else fn();
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);

  return (
    <header className="titlebar">
      <div className="brand">
        <span className="brand-mark">
          <Logo size={21} />
        </span>
        <span className="brand-name">NEBULA</span>
        <span className="brand-ver">v{version}</span>
      </div>

      {/* 只有带 data-tauri-drag-region 的元素可以拖动窗口 */}
      <div className="titlebar-drag" data-tauri-drag-region>
        <span className="titlebar-hint">Minecraft Launcher</span>
      </div>

      <div className="win-controls">
        <button
          className="win-btn"
          aria-label="最小化"
          onClick={() => appWindow?.minimize()}
          disabled={!appWindow}
        >
          <Minus size={15} strokeWidth={1.8} />
        </button>
        <button
          className="win-btn"
          aria-label={maximized ? "还原" : "最大化"}
          onClick={() => appWindow?.toggleMaximize()}
          disabled={!appWindow}
        >
          {maximized ? (
            <Copy size={13} strokeWidth={1.8} />
          ) : (
            <Square size={12} strokeWidth={1.8} />
          )}
        </button>
        <button
          className="win-btn close"
          aria-label="关闭"
          onClick={() => appWindow?.close()}
          disabled={!appWindow}
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
