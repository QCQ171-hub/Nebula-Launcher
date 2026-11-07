import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Terminal, Trash2, X } from "lucide-react";

import { errorText, useApp } from "../store/app";

/** 启动游戏后自动弹出的实时命令行窗口 */
export function GameConsole() {
  const running = useApp((s) => s.running);
  const logs = useApp((s) => s.logs);
  const instances = useApp((s) => s.instances);
  const clearLogs = useApp((s) => s.clearLogs);
  const pushToast = useApp((s) => s.pushToast);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const activeId = useMemo(
    () => Object.keys(running).find((id) => running[id]) ?? null,
    [running],
  );
  const instance = instances.find((i) => i.id === activeId);
  const lines = activeId ? (logs[activeId] ?? []) : [];

  useEffect(() => {
    if (activeId) {
      setOpen(true);
      setMinimized(false);
    }
  }, [activeId]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines.length]);

  if (!open || !activeId) return null;

  const clear = () => {
    try {
      clearLogs(activeId);
    } catch (err) {
      pushToast("error", errorText(err));
    }
  };

  return (
    <div className={`game-console${minimized ? " minimized" : ""}`}>
      <div className="console-head">
        <Terminal size={14} />
        <b>游戏命令行</b>
        <span>{instance?.name ?? activeId}</span>
        <div className="console-actions">
          <button type="button" title="清空" onClick={clear}>
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            title={minimized ? "展开" : "收起"}
            onClick={() => setMinimized((v) => !v)}
          >
            {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button type="button" title="关闭" onClick={() => setOpen(false)}>
            <X size={14} />
          </button>
        </div>
      </div>
      {!minimized ? (
        <div className="console-body" ref={bodyRef}>
          {lines.length ? (
            lines.map((line, i) => (
              <div
                key={i}
                className={`console-line${/error|exception|fatal/i.test(line) ? " err" : ""}`}
              >
                {line}
              </div>
            ))
          ) : (
            <div className="console-line muted">等待游戏输出…</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
