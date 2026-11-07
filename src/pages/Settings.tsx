import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Cpu, FolderOpen, HardDrive, RefreshCw, Save, Trash2 } from "lucide-react";

import { Switch } from "../components/ui";
import { call } from "../lib/bridge";
import { formatBytes } from "../lib/format";
import type { DataDirView, JavaInfo, Settings as SettingsType, StorageStats } from "../lib/types";
import { errorText, useApp } from "../store/app";

export function SettingsPage() {
  const storeSettings = useApp((s) => s.settings);
  const appInfo = useApp((s) => s.appInfo);
  const setSettings = useApp((s) => s.setSettings);
  const pushToast = useApp((s) => s.pushToast);

  const [draft, setDraft] = useState<SettingsType | null>(null);
  const [javaList, setJavaList] = useState<JavaInfo[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState<DataDirView | null>(null);
  const [dirTarget, setDirTarget] = useState("");

  useEffect(() => {
    if (storeSettings && !draft) {
      setDraft({ ...storeSettings });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSettings]);

  const detectJava = async () => {
    setDetecting(true);
    try {
      setJavaList(await call<JavaInfo[]>("java_detect"));
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    void detectJava();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const view = await call<DataDirView>("data_dir_get");
        setDataDir(view);
        setDirTarget(view.pending ?? view.current);
      } catch {
        /* 忽略 */
      }
    })();
  }, []);

  const browseDir = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({ directory: true, multiple: false });
      if (picked) setDirTarget(String(picked));
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const saveDir = async () => {
    try {
      const view = await call<DataDirView>("data_dir_set", { path: dirTarget });
      setDataDir(view);
      pushToast("success", "数据目录已写入，重启启动器后生效");
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const loadStorage = async () => {
    try {
      setStorage(await call<StorageStats>("storage_stats"));
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  useEffect(() => {
    void loadStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanStorage = async (target: string) => {
    setCleaning(target);
    try {
      const freed = await call<number>("storage_clean", { target });
      pushToast("success", freed > 0 ? `已释放 ${formatBytes(freed)}` : "没有可清理的内容");
      await loadStorage();
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setCleaning(null);
    }
  };

  if (!draft) {
    return (
      <div className="empty" style={{ height: "100%" }}>
        <h4>加载中…</h4>
      </div>
    );
  }

  const patch = (value: Partial<SettingsType>) => setDraft((d) => (d ? { ...d, ...value } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await call<SettingsType>("settings_save", { settings: draft });
      setSettings(saved);
      setDraft({ ...saved });
      pushToast("success", "设置已保存");
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setSaving(false);
    }
  };

  const openFolder = async () => {
    try {
      await call("open_folder", {});
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const memPct = ((draft.memoryMb - 512) / (16384 - 512)) * 100;
  const memStyle = { ["--pct" as string]: `${Math.max(0, Math.min(100, memPct))}%` } as CSSProperties;

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>设置</h1>
          <p>Java 运行时、内存、下载源与启动行为</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost btn-icon" title="打开数据目录" onClick={() => void openFolder()}>
            <FolderOpen size={15} />
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            <Save size={15} /> {saving ? "保存中…" : "保存设置"}
          </button>
        </div>
      </div>

      <div className="settings-wrap">
        <div className="card section">
          <div className="section-head">
            <Cpu size={16} />
            <h3>Java 运行时</h3>
            <span className="muted">共 {javaList.length} 个</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void detectJava()}
              disabled={detecting}
              style={{ marginLeft: 12 }}
            >
              <RefreshCw size={13} className={detecting ? "spin" : undefined} /> 重新探测
            </button>
          </div>
          <div className="section-body">
            <div className="toggle-row">
              <div className="toggle-text">
                <b>自动探测本机 JDK</b>
                <span>启动时扫描常见安装位置，按版本要求匹配</span>
              </div>
              <Switch on={draft.autoJava} onChange={(v) => patch({ autoJava: v })} label="自动探测" />
            </div>
            <div className="java-list">
              {javaList.map((java) => (
                <div
                  key={java.path}
                  className={`java-item${java.path === draft.javaPath ? " active" : ""}`}
                  onClick={() => patch({ javaPath: java.path })}
                  style={{ cursor: "pointer" }}
                >
                  <div className="java-item-info">
                    <div className="java-item-path">{java.path}</div>
                    <div className="java-item-meta">
                      {java.vendor} · {java.version} · {java.arch}
                    </div>
                  </div>
                  {java.path === draft.javaPath ? <span className="dot" /> : null}
                </div>
              ))}
              {javaList.length === 0 ? <div className="field-hint">未探测到 Java，可手动填写下方路径。</div> : null}
            </div>
            <label className="field">
              <span className="field-label">Java 路径（java.exe 或 JDK 根目录）</span>
              <input className="input" value={draft.javaPath} onChange={(e) => patch({ javaPath: e.target.value })} />
            </label>
          </div>
        </div>

        <div className="card section">
          <div className="section-head">
            <Cpu size={16} />
            <h3>内存与 JVM</h3>
          </div>
          <div className="section-body">
            <div className="slider-row">
              <input
                type="range"
                min={512}
                max={16384}
                step={512}
                value={draft.memoryMb}
                style={memStyle}
                onChange={(e) => patch({ memoryMb: Number(e.target.value) })}
              />
              <span className="memory-value">{draft.memoryMb} MB</span>
            </div>
            <label className="field">
              <span className="field-label">额外 JVM 参数</span>
              <textarea
                className="textarea"
                placeholder="-XX:+UseG1GC"
                value={draft.jvmArgs}
                onChange={(e) => patch({ jvmArgs: e.target.value })}
              />
              <span className="field-hint">对所有实例生效；实例可在详情里单独覆盖。</span>
            </label>
          </div>
        </div>

        <div className="card section">
          <div className="section-head">
            <FolderOpen size={16} />
            <h3>下载源</h3>
          </div>
          <div className="section-body">
            <div className="radio-cards">
              <button
                type="button"
                className={`radio-card${draft.mirror === "official" ? " active" : ""}`}
                onClick={() => patch({ mirror: "official" })}
              >
                <b>Mojang 官方</b>
                <span>稳定、完整，海外网络直连</span>
              </button>
              <button
                type="button"
                className={`radio-card${draft.mirror === "bmclapi" ? " active" : ""}`}
                onClick={() => patch({ mirror: "bmclapi" })}
              >
                <b>BMCLAPI 镜像</b>
                <span>国内加速，覆盖库/资源/元数据</span>
              </button>
            </div>
            <label className="field">
              <span className="field-label">并发下载数（4 ~ 64）</span>
              <input
                className="input"
                type="number"
                min={4}
                max={64}
                value={draft.concurrency}
                onChange={(e) => patch({ concurrency: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>

        <div className="card section">
          <div className="section-head">
            <Cpu size={16} />
            <h3>启动行为</h3>
          </div>
          <div className="section-body">
            <div className="toggle-row">
              <div className="toggle-text">
                <b>启动后最小化窗口</b>
                <span>游戏启动时把启动器缩到后台</span>
              </div>
              <Switch on={draft.minimizeOnLaunch} onChange={(v) => patch({ minimizeOnLaunch: v })} />
            </div>
            <div className="toggle-row">
              <div className="toggle-text">
                <b>启动后关闭启动器</b>
                <span>释放内存，游戏独立运行</span>
              </div>
              <Switch on={draft.closeAfterLaunch} onChange={(v) => patch({ closeAfterLaunch: v })} />
            </div>
            <div className="toggle-row">
              <div className="toggle-text">
                <b>版本库显示快照</b>
                <span>列出 snapshot 测试版本</span>
              </div>
              <Switch on={draft.showSnapshots} onChange={(v) => patch({ showSnapshots: v })} />
            </div>
          </div>
        </div>

        <div className="card section">
          <div className="section-head">
            <FolderOpen size={16} />
            <h3>微软登录</h3>
          </div>
          <div className="section-body">
            <label className="field">
              <span className="field-label">Azure 应用 Client ID</span>
              <input
                className="input"
                placeholder="公共客户端 ID（GUID）"
                value={draft.microsoftClientId}
                onChange={(e) => patch({ microsoftClientId: e.target.value })}
              />
              <span className="field-hint">需启用「允许公共客户端流」，或使用 XUID 账户体系下的 Azure 应用。</span>
            </label>
          </div>
        </div>

        <div className="card section">
          <div className="section-head">
            <FolderOpen size={16} />
            <h3>数据目录</h3>
          </div>
          <div className="section-body">
            <div className="notice mono">
              当前生效：{dataDir?.current ?? "读取中…"}
              <br />
              配置文件：{dataDir?.configPath ?? "—"}
            </div>
            <label className="field">
              <span className="field-label">游戏文件存放位置（版本、依赖库、资源、实例）</span>
              <div className="row-2">
                <input
                  className="input"
                  placeholder="例如 E://Minecraft"
                  value={dirTarget}
                  onChange={(e) => setDirTarget(e.target.value)}
                />
                <button type="button" className="btn btn-ghost" onClick={() => void browseDir()}>
                  浏览…
                </button>
              </div>
              <span className="field-hint">
                配置写在 exe 同级的 nebula.json，游戏本体不再占用 User 目录；切换后需重启启动器。
              </span>
            </label>
            <div className="head-actions">
              <button type="button" className="btn btn-primary" onClick={() => void saveDir()}>
                <Save size={14} /> 应用数据目录
              </button>
              {dataDir?.pending ? <span className="muted">待重启生效：{dataDir.pending}</span> : null}
            </div>
          </div>
        </div>

        <div className="card section">
          <div className="section-head">
            <HardDrive size={16} />
            <h3>存储空间</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm head-refresh"
              onClick={() => void loadStorage()}
            >
              <RefreshCw size={13} /> 刷新
            </button>
          </div>
          <div className="section-body">
            {storage ? (
              <>
                <div className="storage-total">
                  <b>{formatBytes(storage.totalBytes)}</b>
                  <span>
                    {storage.totalFiles.toLocaleString("zh-CN")} 个文件 · {storage.root}
                  </span>
                </div>
                <div className="storage-list">
                  {storage.buckets.map((bucket) => {
                    const pct =
                      storage.totalBytes > 0 ? (bucket.bytes / storage.totalBytes) * 100 : 0;
                    const target =
                      bucket.key === "natives-cache"
                        ? "natives"
                        : bucket.key === "meta"
                          ? "cache"
                          : bucket.key;
                    return (
                      <div className="storage-row" key={bucket.key}>
                        <div className="storage-meta">
                          <span className="storage-label">{bucket.label}</span>
                          <span className="storage-hint">{bucket.hint}</span>
                        </div>
                        <div className="storage-bar">
                          <i style={{ width: `${Math.max(1.5, pct)}%` }} />
                        </div>
                        <span className="storage-size">{formatBytes(bucket.bytes)}</span>
                        {bucket.cleanable ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm storage-action"
                            disabled={cleaning !== null}
                            onClick={() => void cleanStorage(target)}
                          >
                            <Trash2 size={12} />
                            {cleaning === target ? "清理中…" : "清理"}
                          </button>
                        ) : (
                          <span className="storage-files">
                            {bucket.files.toLocaleString("zh-CN")} 个文件
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="notice">正在统计磁盘占用…</div>
            )}
          </div>
        </div>

        {appInfo ? (
          <div className="card section">
            <div className="section-head">
              <Cpu size={16} />
              <h3>关于</h3>
            </div>
            <div className="section-body">
              <div className="notice mono">
                版本 {appInfo.version} · {appInfo.os}/{appInfo.arch}
                <br />
                数据目录：{appInfo.dataDir}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
