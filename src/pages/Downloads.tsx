import { useMemo } from "react";
import { Boxes, Check, Download, Hammer, Package, RefreshCw, Trash2, X } from "lucide-react";

import { call } from "../lib/bridge";
import { formatBytes } from "../lib/format";
import type { DownloadJob, DownloadStatus } from "../lib/types";
import { errorText, useApp } from "../store/app";

const STATUS_LABEL: Record<DownloadStatus, string> = {
  running: "进行中",
  done: "已完成",
  cancelled: "已取消",
  failed: "失败",
};

const KIND_LABEL: Record<string, string> = {
  version: "游戏本体",
  fabric: "Fabric",
  forge: "Forge",
  neoforge: "NeoForge",
  mods: "模组",
  modpack: "整合包",
};

function kindIcon(kind: string) {
  switch (kind) {
    case "forge":
    case "neoforge":
      return Hammer;
    case "mods":
    case "modpack":
      return Boxes;
    case "fabric":
      return Package;
    default:
      return Download;
  }
}

function progressOf(job: DownloadJob): number {
  if (job.bytesTotal > 0) {
    return Math.min(100, (job.bytesDone / job.bytesTotal) * 100);
  }
  if (job.total > 0) {
    return Math.min(100, (job.done / job.total) * 100);
  }
  return 0;
}

function elapsed(job: DownloadJob): string {
  const ms = Math.max(0, (job.status === "running" ? Date.now() : job.updatedAt) - job.startedAt);
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs} 秒`;
  return `${Math.floor(secs / 60)} 分 ${secs % 60} 秒`;
}

export function DownloadsPage() {
  const downloads = useApp((s) => s.downloads);
  const pushToast = useApp((s) => s.pushToast);
  const refreshDownloads = useApp((s) => s.refreshDownloads);

  const running = useMemo(() => downloads.filter((j) => j.status === "running"), [downloads]);
  const totalSpeed = useMemo(() => running.reduce((sum, j) => sum + j.speed, 0), [running]);
  const finished = downloads.length - running.length;

  const cancel = async (job: DownloadJob) => {
    try {
      await call("cancel_install", { taskId: job.taskId });
      pushToast("info", `已取消「${job.label}」`);
      await refreshDownloads();
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const clear = async () => {
    try {
      await call("downloads_clear");
      await refreshDownloads();
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>下载中心</h1>
          <p>
            {running.length
              ? `${running.length} 个任务进行中 · 合计 ${formatBytes(totalSpeed)}/s`
              : "当前没有正在进行的下载"}
          </p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void refreshDownloads()}
            title="刷新"
          >
            <RefreshCw size={14} /> 刷新
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void clear()}
            disabled={finished === 0}
          >
            <Trash2 size={14} /> 清除记录{finished ? ` (${finished})` : ""}
          </button>
        </div>
      </div>

      <div className="dl-summary">
        <div className="dl-stat">
          <span>进行中</span>
          <b>{running.length}</b>
        </div>
        <div className="dl-stat">
          <span>实时速度</span>
          <b>{formatBytes(totalSpeed)}/s</b>
        </div>
        <div className="dl-stat">
          <span>历史任务</span>
          <b>{downloads.length}</b>
        </div>
      </div>

      {downloads.length ? (
        <div className="dl-list">
          {downloads.map((job) => {
            const Icon = kindIcon(job.kind);
            const pct = progressOf(job);
            return (
              <div className={`card dl-card ${job.status}`} key={job.taskId}>
                <div className="dl-icon">
                  <Icon size={18} />
                </div>
                <div className="dl-main">
                  <div className="dl-top">
                    <div className="dl-title">
                      <b>{job.label}</b>
                      <span className="dl-kind">{KIND_LABEL[job.kind] ?? job.kind}</span>
                      <span className={`dl-status ${job.status}`}>
                        {job.status === "done" ? <Check size={11} /> : null}
                        {STATUS_LABEL[job.status]}
                      </span>
                    </div>
                    {job.status === "running" ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm dl-cancel"
                        onClick={() => void cancel(job)}
                      >
                        <X size={13} /> 取消
                      </button>
                    ) : null}
                  </div>

                  <div className="dl-message">{job.message || STATUS_LABEL[job.status]}</div>

                  <div className="dl-bar">
                    <i style={{ width: `${job.status === "done" ? 100 : pct}%` }} />
                  </div>

                  <div className="dl-meta">
                    <span>
                      {formatBytes(job.bytesDone)}
                      {job.bytesTotal > 0 ? ` / ${formatBytes(job.bytesTotal)}` : ""}
                      {job.bytesTotal > 0 ? ` · ${pct.toFixed(1)}%` : ""}
                    </span>
                    <span>
                      {job.total > 0 ? `${job.done}/${job.total} 个文件` : ""}
                    </span>
                    <span>{job.status === "running" ? `${formatBytes(job.speed)}/s` : ""}</span>
                    <span className="dl-elapsed">{elapsed(job)}</span>
                  </div>

                  {job.error ? <div className="dl-error">{job.error}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card empty" style={{ height: 260 }}>
          <Download size={30} />
          <h4>下载队列是空的</h4>
          <p>去「版本库」安装一个游戏版本或加载器，这里会实时显示进度、速度和取消按钮。</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => useApp.getState().setRoute("versions")}
          >
            去版本库
          </button>
        </div>
      )}
    </section>
  );
}
