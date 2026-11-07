import { useEffect, useState } from "react";
import { Camera, Download, FolderOpen, Image, Trash2 } from "lucide-react";

import { Modal } from "./Modal";
import { call } from "../lib/bridge";
import { formatBytes } from "../lib/format";
import type { Instance, ScreenshotInfo } from "../lib/types";
import { errorText, useApp } from "../store/app";

export function InstanceManagerDialog({
  instance,
  onClose,
  onChanged,
}: {
  instance: Instance | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const accounts = useApp((s) => s.accounts);
  const settings = useApp((s) => s.settings);
  const pushToast = useApp((s) => s.pushToast);
  const setRoute = useApp((s) => s.setRoute);

  const [name, setName] = useState("");
  const [java, setJava] = useState("");
  const [memory, setMemory] = useState(4096);
  const [jvmArgs, setJvmArgs] = useState("");
  const [accountId, setAccountId] = useState("");
  const [shots, setShots] = useState<ScreenshotInfo[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!instance) return;
    setName(instance.name);
    setJava(instance.javaPath ?? settings?.javaPath ?? "");
    setMemory(instance.memoryMb ?? settings?.memoryMb ?? 4096);
    setJvmArgs(instance.jvmArgs ?? "");
    setAccountId(instance.accountId ?? "");
  }, [instance?.id, settings?.javaPath]);

  const loadShots = async () => {
    if (!instance) return;
    try {
      setShots(await call<ScreenshotInfo[]>("screenshots_list", { instanceId: instance.id }));
    } catch {
      setShots([]);
    }
  };

  useEffect(() => {
    void loadShots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id]);

  if (!instance) return null;

  const save = async () => {
    setBusy(true);
    try {
      await call("instance_update", {
        instance: {
          ...instance,
          name: name.trim() || instance.name,
          javaPath: java.trim() || null,
          memoryMb: memory,
          jvmArgs: jvmArgs.trim() || null,
          accountId: accountId || null,
        },
      });
      pushToast("success", "实例设置已保存");
      onChanged();
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await call("instance_delete", { instanceId: instance.id });
      pushToast("success", "实例已删除");
      onChanged();
      onClose();
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const exportScript = async () => {
    try {
      const path = await call<string>("instance_export_script", { instanceId: instance.id });
      pushToast("success", `已导出启动脚本：${path}`);
    } catch (err) {
      pushToast("error", errorText(err));
    }
  };

  const deleteShot = async (file: ScreenshotInfo) => {
    try {
      await call("screenshot_delete", { instanceId: instance.id, fileName: file.fileName });
      await loadShots();
    } catch (err) {
      pushToast("error", errorText(err));
    }
  };

  const openFolder = async () => {
    try {
      await call("open_folder", {});
    } catch (err) {
      pushToast("error", errorText(err));
    }
  };

  return (
    <Modal
      open={!!instance}
      wide
      title={`管理 · ${instance.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={busy}>
            <Trash2 size={14} /> 删除实例
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void openFolder()}>
            <FolderOpen size={14} /> 目录
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void exportScript()}>
            <Download size={14} /> 导出启动脚本
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            保存设置
          </button>
        </>
      }
    >
      <div className="manager">
        <div className="manager-grid">
          <label className="field">
            <span className="field-label">实例名称</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">登录方式</span>
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">跟随全局账户</option>
              {accounts.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.username}（{a.kind}）</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">独立 Java 路径</span>
            <input className="input" value={java} onChange={(e) => setJava(e.target.value)} placeholder="留空则使用全局 Java" />
          </label>
          <label className="field">
            <span className="field-label">内存 MB</span>
            <input
              className="input"
              type="number"
              min={512}
              max={32768}
              step={256}
              value={memory}
              onChange={(e) => setMemory(Number(e.target.value) || 4096)}
            />
          </label>
          <label className="field manager-wide">
            <span className="field-label">额外 JVM 参数</span>
            <input className="input" value={jvmArgs} onChange={(e) => setJvmArgs(e.target.value)} placeholder="-XX:+UseZGC ..." />
          </label>
        </div>

        <div className="manager-links">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRoute("mods"); onClose(); }}>
            模组 / 光影 / 材质
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRoute("versions"); onClose(); }}>
            版本库
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRoute("accounts"); onClose(); }}>
            账户管理
          </button>
        </div>

        <div className="manager-section">
          <h4><Camera size={14} /> 截图 · {shots.length}</h4>
          {shots.length ? (
            <div className="shot-list">
              {shots.map((s) => (
                <div className="shot-row" key={s.fileName}>
                  <Image size={14} />
                  <span className="shot-name">{s.fileName}</span>
                  <span className="shot-size">{formatBytes(s.size)}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    title="删除截图"
                    onClick={() => void deleteShot(s)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="manager-empty">还没有截图。游戏里按 F2 截图后会出现在这里。</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
