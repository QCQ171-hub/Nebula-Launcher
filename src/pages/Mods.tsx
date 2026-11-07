import { useEffect, useState } from "react";
import { Boxes, Check, Download, Layers, Palette, Sun, Trash2 } from "lucide-react";

import { ConfirmDialog } from "../components/Modal";
import { ProjectDetailDialog } from "../components/ProjectDetailDialog";
import { Switch } from "../components/ui";
import { call } from "../lib/bridge";
import { compactNumber, formatBytes, hueFrom, initials } from "../lib/format";
import type { InstalledMod, ModHit, ModSearchResult } from "../lib/types";
import { errorText, pickActiveInstance, useApp } from "../store/app";

type Kind = "mod" | "shader" | "resourcepack";

const KIND_TABS: Array<{ value: Kind; label: string; icon: typeof Boxes }> = [
  { value: "mod", label: "模组", icon: Boxes },
  { value: "shader", label: "光影", icon: Sun },
  { value: "resourcepack", label: "材质包", icon: Palette },
];

const SORTS = [
  { value: "relevance", label: "相关度" },
  { value: "downloads", label: "下载量" },
  { value: "newest", label: "最新发布" },
  { value: "updated", label: "最近更新" },
  { value: "follows", label: "关注数" },
];

const CATEGORIES = [
  { value: "", label: "全部分类" },
  { value: "optimization", label: "优化" },
  { value: "performance", label: "性能" },
  { value: "worldgen", label: "世界生成" },
  { value: "library", label: "前置库" },
  { value: "utility", label: "实用" },
  { value: "decoration", label: "装饰" },
  { value: "technology", label: "科技" },
  { value: "adventure", label: "冒险" },
  { value: "magic", label: "魔法" },
];

const KIND_LABEL: Record<Kind, string> = {
  mod: "模组",
  shader: "光影",
  resourcepack: "材质包",
};

export function ModsPage() {
  const instances = useApp((s) => s.instances);
  const activeInstanceId = useApp((s) => s.activeInstanceId);
  const setRoute = useApp((s) => s.setRoute);
  const pushToast = useApp((s) => s.pushToast);
  const instance = pickActiveInstance(instances, activeInstanceId);

  const [kind, setKind] = useState<Kind>("mod");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("relevance");
  const [category, setCategory] = useState("");
  const [strict, setStrict] = useState(true);
  const [hits, setHits] = useState<ModHit[]>([]);
  const [total, setTotal] = useState(0);
  const [installed, setInstalled] = useState<InstalledMod[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [del, setDel] = useState<InstalledMod | null>(null);
  const [detailHit, setDetailHit] = useState<ModHit | null>(null);

  const refreshInstalled = async () => {
    if (!instance) return;
    try {
      setInstalled(
        await call<InstalledMod[]>("resources_list", { instanceId: instance.id, kind }),
      );
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const search = async () => {
    if (!instance) return;
    setSearching(true);
    try {
      const result = await call<ModSearchResult>("resources_search", {
        query,
        gameVersion: instance.gameVersion,
        loader: instance.loader,
        kind,
        sort,
        category,
        strictVersion: strict,
        offset: 0,
        limit: 24,
      });
      setHits(result.hits);
      setTotal(result.totalHits);
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!instance) return;
    void refreshInstalled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id, kind]);

  useEffect(() => {
    if (!instance) return;
    const timer = window.setTimeout(() => void search(), query ? 450 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id, kind, query, sort, category, strict]);

  if (!instance) {
    return (
      <div className="empty" style={{ height: "100%" }}>
        <Boxes size={30} />
        <h4>还没有可用实例</h4>
        <p>先在版本库安装版本并创建实例，才能给它添加资源。</p>
        <button type="button" className="btn btn-primary" onClick={() => setRoute("versions")}>
          去版本库
        </button>
      </div>
    );
  }

  const isInstalled = (hit: ModHit) =>
    installed.some((m) => m.fileName.toLowerCase().includes(hit.slug.toLowerCase()));

  const quickInstall = async (hit: ModHit) => {
    setBusy((b) => ({ ...b, [hit.projectId]: true }));
    try {
      await call("resource_install", {
        instanceId: instance.id,
        projectId: hit.projectId,
        kind,
        versionId: null,
        taskId: `res-${Date.now()}-${hit.projectId}`,
      });
      pushToast("success", `已安装 ${hit.title}`);
      await refreshInstalled();
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setBusy((b) => ({ ...b, [hit.projectId]: false }));
    }
  };

  const toggle = async (mod: InstalledMod, enabled: boolean) => {
    try {
      await call("resource_toggle", {
        instanceId: instance.id,
        kind,
        fileName: mod.fileName,
        enabled,
      });
      await refreshInstalled();
    } catch (error) {
      pushToast("error", errorText(error));
    }
  };

  const doDelete = async () => {
    if (!del) return;
    try {
      await call("resource_delete", {
        instanceId: instance.id,
        kind,
        fileName: del.fileName,
      });
      await refreshInstalled();
      pushToast("success", `已删除${KIND_LABEL[kind]}`);
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setDel(null);
    }
  };

  const loaderLabel =
    instance.loader === "fabric"
      ? "Fabric"
      : instance.loader === "forge"
        ? "Forge"
        : instance.loader === "neoforge"
          ? "NeoForge"
          : "原版";

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>资源库</h1>
          <p>
            实例「{instance.name}」 · {instance.gameVersion} · {loaderLabel}
          </p>
        </div>
        <div className="head-actions">
          <input
            className="search"
            placeholder={`搜索 Modrinth ${KIND_LABEL[kind]}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="v-tabs" role="tablist">
        {KIND_TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={kind === item.value}
              className={`v-tab${kind === item.value ? " active" : ""}`}
              onClick={() => {
                setKind(item.value);
                setStrict(item.value === "mod");
                setCategory("");
              }}
            >
              <Icon size={14} /> {item.label}
            </button>
          );
        })}
      </div>

      <div className="filter-bar">
        <label className="filter-item">
          <span>排序</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        {kind === "mod" ? (
          <label className="filter-item">
            <span>分类</span>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="filter-item filter-switch">
          <span>仅当前版本</span>
          <Switch on={strict} onChange={setStrict} />
        </label>
        <span className="filter-count">{compactNumber(total)} 个结果</span>
        <span className="filter-hint">
          <Layers size={13} /> 把 .jar 拖进窗口即可直接安装模组
        </span>
      </div>

      {installed.length ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h3>已安装 · {installed.length}</h3>
            <span className="muted">开关可临时禁用，删除即移除文件</span>
          </div>
          {installed.map((mod) => (
            <div key={mod.fileName} className="installed-row">
              <span className="mod-file-icon"><Boxes size={16} /></span>
              <div className="installed-info">
                <div className="installed-name">{mod.displayName}</div>
                <div className="installed-sub">{formatBytes(mod.size)}</div>
              </div>
              <Switch on={mod.enabled} onChange={(v) => void toggle(mod, v)} />
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                title="删除"
                onClick={() => setDel(mod)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mod-grid">
        {hits.map((hit) => {
          const h = hueFrom(hit.title);
          const done = isInstalled(hit);
          return (
            <div
              key={hit.projectId}
              className="card mod-card clickable"
              onClick={() => setDetailHit(hit)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") setDetailHit(hit);
              }}
            >
              <div
                className="mod-icon"
                style={{
                  background: hit.iconUrl
                    ? undefined
                    : `linear-gradient(140deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 42%))`,
                }}
              >
                {hit.iconUrl ? <img src={hit.iconUrl} alt="" /> : initials(hit.title)}
              </div>
              <div className="mod-body">
                <div className="mod-title-row">
                  <h4 className="mod-title">{hit.title}</h4>
                  <span className="mod-author">{hit.author}</span>
                </div>
                <p className="mod-desc">{hit.description}</p>
                <div className="mod-meta">
                  <span className="pill cyan">{compactNumber(hit.downloads)} 下载</span>
                  {hit.versions.slice(0, 3).map((v) => (
                    <span className="pill" key={v}>{v}</span>
                  ))}
                </div>
              </div>
              <div className="mod-action" onClick={(e) => e.stopPropagation()}>
                {done ? (
                  <span className="done" title="已安装"><Check size={18} /></span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!!busy[hit.projectId]}
                    onClick={() => void quickInstall(hit)}
                  >
                    <Download size={14} /> {busy[hit.projectId] ? "安装中" : "安装"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {searching && hits.length === 0 ? (
          <div className="empty"><h4>搜索中…</h4></div>
        ) : null}
        {!searching && hits.length === 0 ? (
          <div className="empty">
            <Boxes size={28} />
            <h4>没有结果</h4>
            <p>换个关键词，或关掉「仅当前版本」再试。</p>
          </div>
        ) : null}
      </div>

      <ProjectDetailDialog
        hit={detailHit}
        kind={kind}
        instance={instance}
        onClose={() => setDetailHit(null)}
        onInstalled={() => void refreshInstalled()}
      />

      <ConfirmDialog
        open={!!del}
        title={`删除${KIND_LABEL[kind]}`}
        message={`确定要删除 ${del?.fileName ?? ""} 吗？此操作会移除该文件。`}
        confirmLabel="删除"
        danger
        onConfirm={() => void doDelete()}
        onClose={() => setDel(null)}
      />
    </section>
  );
}
