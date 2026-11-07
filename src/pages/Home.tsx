import type { ReactNode } from "react";
import { useState } from "react";
import { Boxes, Clock, FolderOpen, Gauge, Package, Play, Plus, Settings2, StopCircle, Trash2, Users } from "lucide-react";

import { BACKEND_MISSING, call, isTauri } from "../lib/bridge";
import { InstanceDialog } from "../components/InstanceDialog";
import { InstanceManagerDialog } from "../components/InstanceManagerDialog";
import { InstanceSettingsDialog } from "../components/InstanceSettingsDialog";
import { ConfirmDialog } from "../components/Modal";
import type { Instance } from "../lib/types";
import { formatPlaytime, hueFrom, initials } from "../lib/format";
import { errorText, pickActiveInstance, pickSelectedAccount, useApp } from "../store/app";

export function HomePage() {
  const instances = useApp((s) => s.instances);
  const accounts = useApp((s) => s.accounts);
  const settings = useApp((s) => s.settings);
  const activeInstanceId = useApp((s) => s.activeInstanceId);
  const setActiveInstance = useApp((s) => s.setActiveInstance);
  const setRoute = useApp((s) => s.setRoute);
  const running = useApp((s) => s.running);
  const logs = useApp((s) => s.logs);
  const progress = useApp((s) => s.progress);
  const pushToast = useApp((s) => s.pushToast);
  const clearLogs = useApp((s) => s.clearLogs);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Instance | null>(null);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [managing, setManaging] = useState<Instance | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const refreshInstances = useApp((s) => s.refreshInstances);

  const instance = pickActiveInstance(instances, activeInstanceId);
  const account = pickSelectedAccount(accounts);

  const importPack = async () => {
    if (!isTauri()) {
      throw new Error(BACKEND_MISSING);
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({
      multiple: false,
      filters: [{ name: "Modrinth 整合包", extensions: ["mrpack"] }],
    });
    if (!path) return;
    try {
      const created = await call<{ id: string; name: string }>("modpack_import", { path });
      const store = useApp.getState();
      await store.refreshInstances();
      store.setActiveInstance(created.id);
      pushToast("success", `已导入整合包「${created.name}」`);
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  if (!instance) {
    return (
      <>
        <div className="empty" style={{ height: "100%" }}>
          <Boxes size={30} />
          <h4>还没有任何实例</h4>
          <p>先新建一个实例，选好游戏版本与加载器，再去版本库下载对应文件。</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> 新建实例
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setRoute("versions")}>
              去版本库
            </button>
          </div>
        </div>
        <InstanceDialog open={creating} onClose={() => setCreating(false)} />
      </>
    );
  }

  const lines = logs[instance.id] ?? [];
  const isRunning = !!running[instance.id];
  const memory = instance.memoryMb ?? settings?.memoryMb ?? 4096;
  const loaderName =
    instance.loader === "fabric"
      ? "Fabric"
      : instance.loader === "forge"
        ? "Forge"
        : instance.loader === "neoforge"
          ? "NeoForge"
          : "原版";
  const totalPlay = instances.reduce((sum, item) => sum + item.playtimeMs, 0);

  const launch = async () => {
    if (!instance.installed) {
      pushToast("info", "该实例尚未安装，正在前往版本库…");
      setRoute("versions");
      return;
    }
    try {
      await call("launch_game", { instanceId: instance.id });
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const stop = async () => {
    try {
      await call("stop_game", { instanceId: instance.id });
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const openFolder = async () => {
    try {
      await call("open_folder", {});
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }
    setDeleteBusy(true);
    try {
      await call("instance_delete", { instanceId: deleting.id });
      await refreshInstances();
      pushToast("success", `实例「${deleting.name}」已删除`);
      setDeleting(null);
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section>
      <div className="hero">
        <div className="hero-art" />
        <div className="hero-side">
          <select
            className="hero-select"
            value={instance.id}
            onChange={(event) => setActiveInstance(event.target.value)}
            aria-label="切换实例"
          >
            {instances.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="hero-content player-mode">
          <div className="player-avatar">
            <span className="player-avatar-fallback">
              {account ? initials(account.username) : "?"}
            </span>
            {account ? (
              <img
                src={`https://mc-heads.net/avatar/${encodeURIComponent(account.username)}/96`}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </div>
          <h1 className="hero-title player-name">{account ? account.username : "未登录账户"}</h1>
          <div className="player-version">
            {instance.name} · {instance.gameVersion} · {loaderName}
          </div>
          <span className="hero-eyebrow">
            <span className="dot" />
            {isRunning ? "游戏运行中" : "已就绪"}
          </span>
          <div className="hero-tags">
            <span className="pill accent">{instance.gameVersion}</span>
            <span className="pill violet">{instance.loader === "fabric" ? "Fabric" : "原版"}</span>
            <span className="pill cyan">{memory} MB</span>
            <span className={`pill ${instance.installed ? "accent" : "warn"}`}>
              {instance.installed ? "已安装" : "待安装"}
            </span>
          </div>
          <div className="hero-actions">
            {isRunning ? (
              <button type="button" className="btn btn-danger play-btn" onClick={stop}>
                <StopCircle size={18} /> 停止游戏
              </button>
            ) : (
              <button type="button" className="btn btn-primary play-btn" onClick={launch}>
                <Play size={18} /> {instance.installed ? "启动游戏" : "先去安装"}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={openFolder}>
              <FolderOpen size={16} /> 打开目录
            </button>
            <button type="button" className="btn btn-ghost" onClick={importPack}>
              <Package size={16} /> 导入整合包
            </button>
          </div>
        </div>
      </div>

      <div className="stat-row">
        <Stat icon={<Boxes size={18} />} label="实例" value={String(instances.length)} />
        <Stat icon={<Users size={18} />} label="账户" value={String(accounts.accounts.length)} />
        <Stat
          icon={<Gauge size={18} />}
          label="已安装"
          value={`${instances.filter((i) => i.installed).length}/${instances.length}`}
        />
        <Stat icon={<Clock size={18} />} label="累计时长" value={formatPlaytime(totalPlay)} />
      </div>

      <div className="home-grid">
        <div className="card">
          <div className="card-head">
            <h3>我的实例</h3>
            <span className="muted">左键选择 · 右键管理</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(true)}>
              <Plus size={14} /> 新建
            </button>
          </div>
          <div className="instance-list">
            {instances.map((item) => {
              const h = hueFrom(item.name);
              const itemRunning = !!running[item.id];
              return (
                <div
                  key={item.id}
                  className="instance-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => setActiveInstance(item.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setManaging(item);
                  }}
                >
                  <div
                    className="instance-cover"
                    style={{
                      background: `linear-gradient(140deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 42%))`,
                    }}
                  >
                    {initials(item.name)}
                  </div>
                  <div className="instance-info">
                    <div className="instance-name">
                      {item.name}
                      {itemRunning ? <span className="dot" /> : null}
                    </div>
                    <div className="instance-sub">
                      {item.gameVersion} · {item.loader === "fabric" ? "Fabric" : "原版"} ·{" "}
                      {item.installed ? "已安装" : "待安装"}
                    </div>
                  </div>
                  <div className="instance-action" onClick={(e) => e.stopPropagation()}>
                    {item.id === instance.id ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={itemRunning ? stop : launch}
                      >
                        {itemRunning ? "停止" : "启动"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      title="实例设置"
                      onClick={() => setEditing(item)}
                    >
                      <Settings2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      title="删除实例"
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="side-stack">
          <div className="card profile-card">
            <div className="profile-main">
              <span className="avatar lg">{account ? initials(account.username) : "?"}</span>
              <div>
                <div className="profile-name">{account?.username ?? "未登录"}</div>
                <div className="profile-sub">
                  {account
                    ? account.kind === "microsoft"
                      ? "Microsoft 正版"
                      : account.kind === "authlib"
                        ? (account.authlibName ?? "第三方皮肤站")
                        : "离线模式"
                    : "添加账户以登录"}
                </div>
              </div>
            </div>
            <div className="profile-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setRoute("accounts")}>
                管理账户
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setRoute("versions")}>
                安装版本
              </button>
            </div>
          </div>

          {progress && progress.stage !== "done" ? (
            <div className="card">
              <div className="card-head">
                <h3>正在安装</h3>
                <span className="muted">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div style={{ padding: "0 18px 16px" }}>
                <div className="install-note">{progress.message}</div>
                <div className="progress" style={{ marginTop: 10 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card log-panel">
        <div className="log-head">
          <div className="log-title">
            {isRunning ? <span className="dot" /> : null}
            游戏日志 · {instance.name}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearLogs(instance.id)}>
            清空
          </button>
        </div>
        <div className="log-body">
          {lines.length ? (
            lines.map((line, index) => (
              <div key={index} className={`log-line${/ERROR|Exception|SEVERE/i.test(line) ? " err" : ""}`}>
                {line}
              </div>
            ))
          ) : (
            <span className="muted">还没有日志。启动游戏后这里会实时输出。</span>
          )}
        </div>
      </div>

      <InstanceDialog open={creating} onClose={() => setCreating(false)} />
      <InstanceSettingsDialog
        instance={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        danger
        busy={deleteBusy}
        title="删除实例"
        confirmLabel="删除"
        message={
          <>
            将删除实例「{deleting?.name}」及其目录下的存档、模组与配置，此操作不可撤销。
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
      <InstanceManagerDialog
        instance={managing}
        onClose={() => setManaging(null)}
        onChanged={() => void refreshInstances()}
      />
    </section>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
