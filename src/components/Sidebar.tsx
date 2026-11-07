import { Boxes, Download, History, Home, Settings, Sparkles, Users } from "lucide-react";

import { initials } from "../lib/format";
import { pickSelectedAccount, useApp } from "../store/app";
import type { Route } from "../lib/types";

const NAV: Array<{ route: Route; label: string; icon: typeof Home }> = [
  { route: "home", label: "启动", icon: Home },
  { route: "versions", label: "版本库", icon: History },
  { route: "mods", label: "模组", icon: Boxes },
  { route: "downloads", label: "下载", icon: Download },
  { route: "ai", label: "AI 助手", icon: Sparkles },
  { route: "accounts", label: "账户", icon: Users },
  { route: "settings", label: "设置", icon: Settings },
];

const KIND_LABEL: Record<string, string> = {
  microsoft: "Microsoft 正版",
  authlib: "第三方皮肤站",
  offline: "离线模式",
};

export function Sidebar() {
  const route = useApp((s) => s.route);
  const setRoute = useApp((s) => s.setRoute);
  const accounts = useApp((s) => s.accounts);
  const downloadCount = useApp((s) =>
    s.downloads.reduce((n, job) => n + (job.status === "running" ? 1 : 0), 0),
  );

  const account = pickSelectedAccount(accounts);

  return (
    <aside className="sidebar">
      <div className="sidebar-section">导航</div>
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.route}
            type="button"
            className={`nav-item${route === item.route ? " active" : ""}`}
            onClick={() => setRoute(item.route)}
          >
            <Icon size={17} strokeWidth={1.9} />
            <span>{item.label}</span>
            {item.route === "downloads" && downloadCount > 0 ? (
              <span className="nav-badge">{downloadCount}</span>
            ) : null}
          </button>
        );
      })}

      <div className="sidebar-footer">
        <div className="sidebar-section">当前账户</div>
        <button
          type="button"
          className="account-chip"
          onClick={() => setRoute("accounts")}
          title="管理账户"
        >
          {account ? (
            <>
              <span className="avatar">{initials(account.username)}</span>
              <span className="account-chip-info">
                <span className="account-chip-name">{account.username}</span>
                <span className="account-chip-kind">{KIND_LABEL[account.kind] ?? account.kind}</span>
              </span>
            </>
          ) : (
            <>
              <span className="avatar">?</span>
              <span className="account-chip-info">
                <span className="account-chip-name">未登录</span>
                <span className="account-chip-kind">点击添加账户</span>
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
