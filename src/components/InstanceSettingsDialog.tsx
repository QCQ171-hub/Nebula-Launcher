import { useEffect, useState } from "react";
import { Save } from "lucide-react";

import { call } from "../lib/bridge";
import type { Instance } from "../lib/types";
import { errorText, useApp } from "../store/app";
import { Modal } from "./Modal";

interface Props {
  instance: Instance | null;
  open: boolean;
  onClose: () => void;
}

export function InstanceSettingsDialog({ instance, open, onClose }: Props) {
  const refreshInstances = useApp((s) => s.refreshInstances);
  const settings = useApp((s) => s.settings);
  const pushToast = useApp((s) => s.pushToast);

  const [name, setName] = useState("");
  const [memory, setMemory] = useState("");
  const [javaPath, setJavaPath] = useState("");
  const [jvmArgs, setJvmArgs] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !instance) {
      return;
    }
    setName(instance.name);
    setMemory(instance.memoryMb ? String(instance.memoryMb) : "");
    setJavaPath(instance.javaPath ?? "");
    setJvmArgs(instance.jvmArgs ?? "");
  }, [open, instance]);

  if (!instance) {
    return null;
  }

  const globalMemory = settings?.memoryMb ?? 4096;
  const globalJava = settings?.javaPath ?? "";

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      pushToast("error", "实例名称不能为空");
      return;
    }
    const raw = memory.trim();
    const mem = raw ? Number(raw) : null;
    if (mem !== null && (!Number.isFinite(mem) || mem < 512 || mem > 65536)) {
      pushToast("error", "内存需要是 512 ~ 65536 之间的整数");
      return;
    }
    setBusy(true);
    try {
      await call<Instance>("instance_update", {
        instance: {
          ...instance,
          name: trimmed,
          memoryMb: mem,
          javaPath: javaPath.trim() || null,
          jvmArgs: jvmArgs.trim() || null,
        },
      });
      await refreshInstances();
      pushToast("success", "实例设置已保存");
      onClose();
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="实例设置"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            <Save size={15} /> 保存
          </button>
        </>
      }
    >
      <div className="dialog-form">
        <div className="notice">
          {instance.gameVersion} · {instance.loader === "fabric" ? `Fabric ${instance.loaderVersion ?? ""}` : "原版"}
        </div>

        <label className="field">
          <span className="field-label">实例名称</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
          />
        </label>

        <label className="field">
          <span className="field-label">最大内存（MB）</span>
          <input
            className="input"
            value={memory}
            placeholder={`跟随全局：${globalMemory}`}
            onChange={(event) => setMemory(event.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
          />
          <span className="field-hint">留空则使用设置页的全局值；大型整合包建议 6144 以上。</span>
        </label>

        <label className="field">
          <span className="field-label">Java 路径</span>
          <input
            className="input"
            value={javaPath}
            placeholder={globalJava ? `跟随全局：${globalJava}` : "跟随全局设置"}
            onChange={(event) => setJavaPath(event.target.value)}
          />
          <span className="field-hint">可填 java.exe，也可填 JDK 的 bin 目录。</span>
        </label>

        <label className="field">
          <span className="field-label">额外 JVM 参数</span>
          <input
            className="input"
            value={jvmArgs}
            placeholder="例如 -XX:+UseZGC -Dfile.encoding=UTF-8"
            onChange={(event) => setJvmArgs(event.target.value)}
          />
          <span className="field-hint">会追加在全局参数之后，仅对该实例生效。</span>
        </label>
      </div>
    </Modal>
  );
}
