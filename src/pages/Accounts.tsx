import { useEffect, useState } from "react";
import { ExternalLink, LogIn, RefreshCw, Trash2 } from "lucide-react";

import { call } from "../lib/bridge";
import { initials } from "../lib/format";
import type { Account, DeviceCodeInfo, MsPollResult } from "../lib/types";
import { errorText, useApp } from "../store/app";
import { Segmented } from "../components/ui";

type Tab = "microsoft" | "authlib" | "offline";

const KIND_LABEL: Record<string, string> = {
  microsoft: "Microsoft 正版",
  authlib: "第三方皮肤站",
  offline: "离线模式",
};

export function AccountsPage() {
  const accounts = useApp((s) => s.accounts);
  const refreshAccounts = useApp((s) => s.refreshAccounts);
  const pushToast = useApp((s) => s.pushToast);

  const [tab, setTab] = useState<Tab>("microsoft");
  const [busy, setBusy] = useState(false);

  const [offlineName, setOfflineName] = useState("");
  const [base, setBase] = useState("https://littleskin.cn");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [device, setDevice] = useState<DeviceCodeInfo | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!polling || !device) {
      return;
    }
    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      try {
        const result = await call<MsPollResult>("ms_poll", { deviceCode: device.deviceCode });
        if (cancelled) {
          return;
        }
        if (result.status === "success") {
          setPolling(false);
          setDevice(null);
          await refreshAccounts();
          pushToast("success", "微软账户登录成功");
        } else if (result.status === "failed") {
          setPolling(false);
          pushToast("error", result.message ?? "微软登录失败");
        } else {
          timer = window.setTimeout(tick, Math.max(3, device.interval) * 1000);
        }
      } catch (error) {
        if (!cancelled) {
          setPolling(false);
          pushToast("error", errorText(error));
        }
      }
    };

    timer = window.setTimeout(tick, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [polling, device, refreshAccounts, pushToast]);

  const select = async (account: Account) => {
    try {
      await call("account_select", { accountId: account.id });
      await refreshAccounts();
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const remove = async (account: Account) => {
    try {
      await call("account_delete", { accountId: account.id });
      await refreshAccounts();
      pushToast("info", "已移除账户");
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const refreshToken = async (account: Account) => {
    try {
      await call<Account>("account_refresh", { accountId: account.id });
      await refreshAccounts();
      pushToast("success", "令牌已刷新");
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const startDeviceCode = async () => {
    setBusy(true);
    try {
      const info = await call<DeviceCodeInfo>("ms_device_code");
      setDevice(info);
      setPolling(true);
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.userCode);
      pushToast("success", "验证码已复制");
    } catch {
      pushToast("info", device.userCode);
    }
  };

  const loginOffline = async () => {
    if (offlineName.trim().length < 3) {
      pushToast("error", "玩家名至少 3 个字符");
      return;
    }
    setBusy(true);
    try {
      await call<Account>("login_offline", { name: offlineName.trim() });
      await refreshAccounts();
      setOfflineName("");
      pushToast("success", "离线账户已创建");
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const loginAuthlib = async () => {
    if (!authUser.trim() || !authPass) {
      pushToast("error", "请填写用户名和密码");
      return;
    }
    setBusy(true);
    try {
      await call<Account>("authlib_login", { base: base.trim(), username: authUser.trim(), password: authPass });
      await refreshAccounts();
      setAuthPass("");
      pushToast("success", "皮肤站登录成功");
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>账户</h1>
          <p>管理登录方式，当前共 {accounts.accounts.length} 个账户</p>
        </div>
      </div>

      <div className="accounts-layout">
        <div className="card account-list">
          {accounts.accounts.length ? (
            accounts.accounts.map((account) => (
              <div
                key={account.id}
                className={`account-row${account.id === accounts.selected ? " active" : ""}`}
                onClick={() => void select(account)}
                style={{ cursor: "pointer" }}
              >
                <span className="avatar">{initials(account.username)}</span>
                <div className="account-row-main">
                  <div className="account-name">{account.username}</div>
                  <div className="account-meta">
                    <span className={`pill ${account.kind === "offline" ? "warn" : "accent"}`}>
                      {KIND_LABEL[account.kind] ?? account.kind}
                    </span>
                    {account.authlibName ? <span className="muted">{account.authlibName}</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  title="刷新令牌"
                  onClick={(e) => {
                    e.stopPropagation();
                    void refreshToken(account);
                  }}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(account);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty">
              <h4>还没有账户</h4>
              <p>在右侧选择一种登录方式开始。</p>
            </div>
          )}
        </div>

        <div className="card login-panel">
          <div className="login-tabs">
            <Segmented
              value={tab}
              onChange={setTab}
              disabled={polling}
              options={[
                { value: "microsoft", label: "Microsoft" },
                { value: "authlib", label: "皮肤站" },
                { value: "offline", label: "离线" },
              ]}
            />
          </div>

          {tab === "offline" ? (
            <div className="form-stack">
              <label className="field">
                <span className="field-label">游戏名</span>
                <input
                  className="input"
                  placeholder="例如 Steve"
                  value={offlineName}
                  onChange={(e) => setOfflineName(e.target.value)}
                  maxLength={16}
                />
                <span className="field-hint">3~16 位字母、数字或下划线；离线账户无法进入正版服务器。</span>
              </label>
              <button type="button" className="btn btn-primary" onClick={() => void loginOffline()} disabled={busy}>
                <LogIn size={15} /> 创建离线账户
              </button>
            </div>
          ) : null}

          {tab === "authlib" ? (
            <div className="form-stack">
              <label className="field">
                <span className="field-label">皮肤站地址</span>
                <input className="input" value={base} onChange={(e) => setBase(e.target.value)} />
                <span className="field-hint">支持 authlib-injector 协议的站点，如 LittleSkin。</span>
              </label>
              <label className="field">
                <span className="field-label">账号</span>
                <input
                  className="input"
                  value={authUser}
                  onChange={(e) => setAuthUser(e.target.value)}
                  placeholder="邮箱 / 用户名"
                />
              </label>
              <label className="field">
                <span className="field-label">密码</span>
                <input
                  className="input"
                  type="password"
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                />
              </label>
              <button type="button" className="btn btn-primary" onClick={() => void loginAuthlib()} disabled={busy}>
                <LogIn size={15} /> 登录皮肤站
              </button>
            </div>
          ) : null}

          {tab === "microsoft" ? (
            device ? (
              <>
                <div className="device-code">
                  <div className="code-value">{device.userCode}</div>
                  <div className="code-hint">
                    请在任意浏览器打开 <span className="mono">{device.verificationUri}</span> 并输入上面的代码，
                    完成后本窗口会自动完成登录。
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyCode()}>
                      复制代码
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setPolling(false);
                        setDevice(null);
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
                <div className="login-tip notice">
                  <span className="dot" /> 正在等待你在浏览器中授权…
                </div>
              </>
            ) : (
              <div className="form-stack">
                <div className="notice">
                  使用 Microsoft 设备码登录：无需在启动器内输入密码，安全合规，支持正版验证。
                </div>
                <button type="button" className="btn btn-primary" onClick={() => void startDeviceCode()} disabled={busy}>
                  <ExternalLink size={15} /> 开始微软登录
                </button>
                <span className="field-hint">若提示未配置 Client ID，请到「设置 → 微软登录」填入 Azure 应用 ID。</span>
              </div>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
