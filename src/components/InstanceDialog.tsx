import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { call } from "../lib/bridge";
import type { FabricLoaderInfo, Instance, VersionListView } from "../lib/types";
import { errorText, useApp } from "../store/app";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InstanceDialog({ open, onClose }: Props) {
  const instances = useApp((s) => s.instances);
  const refreshInstances = useApp((s) => s.refreshInstances);
  const setActiveInstance = useApp((s) => s.setActiveInstance);
  const pushToast = useApp((s) => s.pushToast);

  const [name, setName] = useState("");
  const [gameVersion, setGameVersion] = useState("");
  const [loader, setLoader] = useState<"vanilla" | "fabric">("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [versions, setVersions] = useState<VersionListView | null>(null);
  const [loaders, setLoaders] = useState<FabricLoaderInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    if (!open || versions) {
      return;
    }
    setLoadingVersions(true);
    call<VersionListView>("versions_list", { force: false })
      .then((view) => {
        setVersions(view);
        const latest =
          view.versions.find((v) => v.id === view.latest.release) ??
          view.versions.find((v) => v.kind === "release");
        if (latest) setGameVersion((current) => current || latest.id);
      })
      .catch((error) => pushToast("error", errorText(error)))
      .finally(() => setLoadingVersions(false));
  }, [open, versions, pushToast]);

  useEffect(() => {
    if (loader !== "fabric" || !gameVersion) {
      return;
    }
    call<FabricLoaderInfo[]>("fabric_loaders", { gameVersion })
      .then((list) => {
        setLoaders(list);
        setLoaderVersion((current) =>
          list.some((item) => item.version === current) ? current : list[0]?.version ?? "",
        );
      })
      .catch((error) => pushToast("error", errorText(error)));
  }, [loader, gameVersion, pushToast]);

  const releaseList = useMemo(
    () => (versions?.versions ?? []).filter((v) => v.kind === "release").slice(0, 80),
    [versions],
  );

  const reset = () => {
    setName("");
    setLoader("vanilla");
    setLoaderVersion("");
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    const finalName = name.trim() || `${gameVersion}${loader === "fabric" ? " · Fabric" : ""}`;
    if (!gameVersion) {
      pushToast("error", "请选择游戏版本");
      return;
    }
    if (loader === "fabric" && !loaderVersion) {
      pushToast("error", "请选择 Fabric 加载器版本");
      return;
    }
    setBusy(true);
    try {
      const created = await call<Instance>("instance_create", {
        name: finalName,
        gameVersion,
        loader,
        loaderVersion: loader === "fabric" ? loaderVersion : null,
      });
      await refreshInstances();
      setActiveInstance(created.id);
      pushToast("success", `实例「${created.name}」已创建`);
      close();
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const duplicated = instances.some(
    (item) =>
      item.gameVersion === gameVersion &&
      item.loader === loader &&
      (loader === "vanilla" || item.loaderVersion === loaderVersion),
  );

  return (
    <Modal
      open={open}
      title="新建实例"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} 创建实例
          </button>
        </>
      }
    >
      <div className="dialog-form">
        <label className="field">
          <span className="field-label">实例名称</span>
          <input
            className="input"
            value={name}
            placeholder={gameVersion ? `${gameVersion}${loader === "fabric" ? " · Fabric" : ""}` : "我的世界"}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
          />
          <span className="field-hint">留空则自动使用「版本名 + 加载器」。</span>
        </label>

        <label className="field">
          <span className="field-label">游戏版本</span>
          <select
            className="select"
            value={gameVersion}
            onChange={(event) => {
              setGameVersion(event.target.value);
              setLoaderVersion("");
            }}
            disabled={loadingVersions || busy}
          >
            {releaseList.length === 0 ? <option value="">加载中…</option> : null}
            {releaseList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">加载器</span>
          <select
            className="select"
            value={loader}
            onChange={(event) => setLoader(event.target.value as "vanilla" | "fabric")}
            disabled={busy}
          >
            <option value="vanilla">原版（Vanilla）</option>
            <option value="fabric">Fabric</option>
          </select>
        </label>

        {loader === "fabric" ? (
          <label className="field">
            <span className="field-label">Fabric Loader</span>
            <select
              className="select"
              value={loaderVersion}
              onChange={(event) => setLoaderVersion(event.target.value)}
              disabled={busy || loaders.length === 0}
            >
              {loaders.length === 0 ? <option value="">加载中…</option> : null}
              {loaders.map((item) => (
                <option key={item.version} value={item.version}>
                  {item.version}
                  {item.stable ? "" : "（非稳定）"}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {duplicated ? (
          <div className="notice">已有相同版本与加载器的实例，仍可再建一个（存档互相独立）。</div>
        ) : null}
      </div>
    </Modal>
  );
}
