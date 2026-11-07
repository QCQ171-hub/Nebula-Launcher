import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Download, Loader2 } from "lucide-react";

import { Modal } from "./Modal";
import { call } from "../lib/bridge";
import { compactNumber, formatBytes, initials } from "../lib/format";
import type { Instance, ModHit, ProjectDetail } from "../lib/types";
import { errorText, useApp } from "../store/app";

interface Props {
  hit: ModHit | null;
  kind: "mod" | "shader" | "resourcepack";
  instance: Instance;
  onClose: () => void;
  onInstalled: () => void;
}

export function ProjectDetailDialog({ hit, kind, instance, onClose, onInstalled }: Props) {
  const pushToast = useApp((s) => s.pushToast);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!hit) {
      setDetail(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    setDetail(null);
    setVersionId(null);
    call<ProjectDetail>("project_detail", {
      projectId: hit.projectId,
      gameVersion: instance.gameVersion,
      loader: instance.loader,
    })
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((err) => {
        if (alive) setError(errorText(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [hit?.projectId, instance.gameVersion, instance.loader]);

  const current = detail?.currentVersion ?? instance.gameVersion;
  const supported = detail?.compatible ?? true;

  /** 当前实例版本永远排第一，其余按后端给的新 → 旧顺序 */
  const orderedVersions = useMemo(() => {
    if (!detail) return [];
    return [current, ...detail.gameVersions.filter((v) => v !== current)];
  }, [detail, current]);

  /** 兼容当前版本的构建优先，方便直接装 */
  const orderedBuilds = useMemo(() => {
    if (!detail) return [];
    return [...detail.versions].sort((a, b) => {
      const hitA = a.gameVersions.includes(current) ? 0 : 1;
      const hitB = b.gameVersions.includes(current) ? 0 : 1;
      return hitA - hitB;
    });
  }, [detail, current]);

  const install = async () => {
    if (!hit) return;
    setInstalling(true);
    try {
      const files = await call<string[]>("resource_install", {
        instanceId: instance.id,
        projectId: hit.projectId,
        kind,
        versionId,
        taskId: `res-${Date.now()}-${hit.projectId}`,
      });
      pushToast("success", `已安装 ${files.length} 个文件`);
      onInstalled();
      onClose();
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setInstalling(false);
    }
  };

  const icon = detail?.iconUrl || hit?.iconUrl;

  return (
    <Modal
      open={!!hit}
      wide
      title={hit?.title ?? "项目详情"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className={`btn ${supported ? "btn-primary" : "btn-danger"}`}
            disabled={installing || loading || !detail || detail.versions.length === 0}
            onClick={() => void install()}
          >
            {installing ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {installing ? "安装中" : supported ? "安装到当前实例" : "仍然安装"}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="detail-loading">
          <Loader2 size={22} className="spin" /> 正在读取项目信息…
        </div>
      ) : error ? (
        <div className="detail-error">{error}</div>
      ) : detail && hit ? (
        <div className="detail">
          <div className="detail-head">
            <div className="detail-icon">
              {icon ? <img src={icon} alt="" /> : initials(hit.title)}
            </div>
            <div className="detail-head-info">
              <div className="detail-title">{detail.title || hit.title}</div>
              <div className="detail-byline">
                by {hit.author || "—"} · {compactNumber(detail.downloads || hit.downloads)} 下载
              </div>
              <div className="detail-tags">
                <span className="pill cyan">{kind === "mod" ? "模组" : kind === "shader" ? "光影" : "材质包"}</span>
                {detail.loaders.slice(0, 4).map((l) => (
                  <span className="pill" key={l}>{l}</span>
                ))}
              </div>
            </div>
          </div>

          {!supported ? (
            <div className="compat-banner">
              <AlertTriangle size={17} />
              <div>
                <b>不兼容当前版本 {current}</b>
                <span>
                  该项目没有找到支持 {current} 的构建。安装后可能无法加载或导致游戏崩溃，请确认版本后再装。
                </span>
              </div>
            </div>
          ) : (
            <div className="compat-ok">
              <Check size={15} /> 已找到兼容 {current} 的构建
            </div>
          )}

          <div className="detail-section">
            <h4>支持的游戏版本</h4>
            <div className="version-chips">
              {orderedVersions.map((v) => {
                const isCurrent = v === current;
                const ok = detail.gameVersions.includes(v);
                return (
                  <span
                    key={v}
                    className={`version-chip${isCurrent ? " current" : ""}${ok ? "" : " unsupported"}`}
                  >
                    {v}
                    {isCurrent ? " · 当前" : ""}
                    {!ok ? " · 不支持" : ""}
                  </span>
                );
              })}
              {orderedVersions.length <= 1 ? <span className="muted">暂无更多版本信息</span> : null}
            </div>
          </div>

          <div className="detail-section">
            <h4>可用构建 · {detail.versions.length}</h4>
            <div className="build-list">
              {orderedBuilds.slice(0, 12).map((v) => {
                const ok = v.gameVersions.includes(current);
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`build-row${versionId === v.id ? " active" : ""}`}
                    onClick={() => setVersionId(v.id)}
                  >
                    <span className={`build-dot${ok ? " ok" : ""}`} />
                    <span className="build-name">{v.name || v.versionNumber}</span>
                    <span className="build-versions">{v.gameVersions.slice(0, 3).join(" / ")}</span>
                    <span className="build-size">{formatBytes(v.fileSize)}</span>
                  </button>
                );
              })}
              {detail.versions.length === 0 ? <span className="muted">没有可下载的文件</span> : null}
            </div>
          </div>

          {detail.description ? (
            <div className="detail-section">
              <h4>简介</h4>
              <p className="detail-desc">{detail.description}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
