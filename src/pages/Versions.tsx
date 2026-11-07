import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, RefreshCw, X } from "lucide-react";

import { ProgressBar, Segmented } from "../components/ui";
import { call } from "../lib/bridge";
import { formatBytes } from "../lib/format";
import type {
  FabricLoaderInfo,
  InstallResult,
  Instance,
  LoaderInfo,
  VersionListView,
} from "../lib/types";
import {
  TAB_LABEL,
  classifyVersions,
  flatten,
  groupReleases,
  groupSnapshots,
  type ClassifiedVersion,
  type VersionTab,
} from "../lib/versions";
import { errorText, useApp } from "../store/app";

type LoaderChoice = "vanilla" | "fabric" | "forge" | "neoforge";

const LOADER_NAME: Record<LoaderChoice, string> = {
  vanilla: "原版",
  fabric: "Fabric",
  forge: "Forge",
  neoforge: "NeoForge",
};

function newTaskId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

export function VersionsPage() {
  const instances = useApp((s) => s.instances);
  const pushToast = useApp((s) => s.pushToast);
  const setRoute = useApp((s) => s.setRoute);
  const progress = useApp((s) => s.progress);
  const refreshInstances = useApp((s) => s.refreshInstances);
  const setActiveInstance = useApp((s) => s.setActiveInstance);

  const [view, setView] = useState<VersionListView | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<VersionTab>("release");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loader, setLoader] = useState<LoaderChoice>("vanilla");
  const [loaders, setLoaders] = useState<LoaderInfo[]>([]);
  const [loaderVersion, setLoaderVersion] = useState("");
  const [installing, setInstalling] = useState(false);
  const [taskId, setTaskId] = useState("");

  const load = async (force = false) => {
    setLoading(true);
    try {
      const v = await call<VersionListView>("versions_list", { force });
      setView(v);
      setSelectedId((current) =>
        current && v.versions.some((item) => item.id === current) ? current : v.latest.release,
      );
      setExpanded((prev) => (Object.keys(prev).length ? prev : { [v.latest.release]: true }));
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loader === "vanilla" || !selectedId) {
      return;
    }
    const fetchLoaders = async () => {
      try {
        const list: LoaderInfo[] =
          loader === "fabric"
            ? (
                await call<FabricLoaderInfo[]>("fabric_loaders", { gameVersion: selectedId })
              ).map((item) => ({
                version: item.version,
                stable: item.stable,
                gameVersion: selectedId,
                installerUrl: "",
                versionId: "",
              }))
            : await call<LoaderInfo[]>("loader_versions", {
                flavor: loader,
                gameVersion: selectedId,
              });
        setLoaders(list);
        setLoaderVersion((current) =>
          list.some((item) => item.version === current) ? current : list[0]?.version ?? "",
        );
      } catch (error) {
        setLoaders([]);
        setLoaderVersion("");
        pushToast("error", errorText(error));
      }
    };
    void fetchLoaders();
  }, [loader, selectedId, pushToast]);

  /** 分类结果（保持清单原本的新 → 旧顺序） */
  const classified = useMemo(() => (view ? classifyVersions(view.versions) : []), [view]);

  const counts = useMemo(() => {
    const acc: Record<VersionTab, number> = { release: 0, snapshot: 0, april: 0, ancient: 0 };
    for (const v of classified) {
      acc[v.tab] += 1;
    }
    return acc;
  }, [classified]);

  const searching = query.trim().length > 0;

  /** 搜索时走平铺结果，不再按标签页分组 */
  const searchHit = useMemo(() => {
    if (!classified.length) {
      return [];
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return classified.filter((v) => v.id.toLowerCase().includes(q)).slice(0, 300);
  }, [classified, query]);

  const groups = useMemo(() => {
    if (searching) {
      return [];
    }
    if (tab === "release") {
      return groupReleases(classified);
    }
    if (tab === "snapshot") {
      return groupSnapshots(classified);
    }
    return [];
  }, [classified, tab, searching]);

  const flat = useMemo(
    () => (searching || (tab !== "april" && tab !== "ancient") ? [] : flatten(classified, tab)),
    [classified, tab, searching],
  );

  const selected = useMemo(
    () => classified.find((v) => v.id === selectedId) ?? null,
    [classified, selectedId],
  );

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const install = async () => {
    if (!selectedId) {
      return;
    }
    if (loader !== "vanilla" && !loaderVersion) {
      pushToast("error", "请选择加载器版本");
      return;
    }
    const id = newTaskId();
    setTaskId(id);
    setInstalling(true);
    try {
      if (loader === "vanilla") {
        await call<InstallResult>("install_version", { versionId: selectedId, taskId: id });
      } else if (loader === "fabric") {
        await call<InstallResult>("install_fabric", {
          gameVersion: selectedId,
          loaderVersion,
          taskId: id,
        });
      } else {
        await call<string>("install_loader", {
          flavor: loader,
          gameVersion: selectedId,
          loaderVersion,
          taskId: id,
        });
      }

      const loaderLabel =
        loader === "fabric"
          ? "Fabric"
          : loader === "forge"
            ? "Forge"
            : loader === "neoforge"
              ? "NeoForge"
              : "";
      const baseName = loaderLabel ? `${selectedId} · ${loaderLabel}` : selectedId;
      let finalName = baseName;
      let index = 2;
      while (instances.some((item) => item.name === finalName)) {
        finalName = `${baseName} (${index})`;
        index += 1;
      }
      const created = await call<Instance>("instance_create", {
        name: finalName,
        gameVersion: selectedId,
        loader,
        loaderVersion: loader === "vanilla" ? null : loaderVersion,
      });
      await refreshInstances();
      setActiveInstance(created.id);
      pushToast("success", `「${created.name}」安装完成，可以启动啦`);
      setRoute("home");
    } catch (error) {
      pushToast("error", errorText(error));
    } finally {
      setInstalling(false);
    }
  };

  const cancel = async () => {
    try {
      await call("cancel_install", { taskId });
    } catch {
      /* ignore */
    }
    setInstalling(false);
  };

  const showProgress = installing && !!progress && progress.taskId === taskId;

  const row = (v: ClassifiedVersion, sub = false) => (
    <button
      key={v.id}
      type="button"
      className={`version-row${v.id === selectedId ? " active" : ""}${sub ? " sub" : ""}`}
      onClick={() => setSelectedId(v.id)}
    >
      <span className={`version-badge ${v.tab}${v.stage === "pre" ? " pre" : ""}`}>{v.badge}</span>
      <span className="version-id">{v.id}</span>
      <span className="version-date">{day(v.releaseTime)}</span>
    </button>
  );

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>版本库</h1>
          <p>
            {view
              ? `最新正式版 ${view.latest.release} · 最新快照 ${view.latest.snapshot}`
              : "正在加载版本清单…"}
          </p>
        </div>
        <div className="head-actions">
          <div className="search-wrap">
            <input
              className="search"
              placeholder="搜索任意版本…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching ? (
              <button type="button" className="search-clear" onClick={() => setQuery("")} title="清空">
                <X size={13} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            title="重新获取清单"
            onClick={() => void load(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : undefined} />
          </button>
        </div>
      </div>

      <div className="v-tabs" role="tablist">
        {(Object.keys(TAB_LABEL) as VersionTab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={!searching && tab === key}
            className={`v-tab${!searching && tab === key ? " active" : ""}`}
            onClick={() => {
              setQuery("");
              setTab(key);
            }}
          >
            {TAB_LABEL[key]}
            <span className="v-tab-count">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="versions-layout">
        <div className="card version-list">
          {searching ? (
            searchHit.length ? (
              <>
                <div className="v-hint">共 {searchHit.length} 个匹配结果</div>
                {searchHit.map((v) => row(v))}
              </>
            ) : (
              <div className="empty">
                <h4>没有匹配的版本</h4>
                <p>换个关键词试试，比如「1.20」或「26w」。</p>
              </div>
            )
          ) : tab === "release" ? (
            groups.map((group) => {
              const open = !!expanded[group.key];
              const info = classified.find((v) => v.id === group.key);
              return (
                <div className="v-group" key={group.key}>
                  <div
                    className={`version-row v-group-row${group.key === selectedId ? " active" : ""}`}
                    onClick={() => setSelectedId(group.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedId(group.key);
                      }
                    }}
                  >
                    <span className="version-badge release">正式版</span>
                    <span className="version-id">{group.title}</span>
                    <span className="version-date">{info ? day(info.releaseTime) : ""}</span>
                    {group.items.length ? (
                      <button
                        type="button"
                        className={`v-toggle${open ? " open" : ""}`}
                        title={open ? "收起测试版" : "展开测试版"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(group.key);
                        }}
                      >
                        <ChevronRight size={13} />
                        {group.items.length}
                      </button>
                    ) : null}
                  </div>
                  {open && group.items.length ? (
                    <div className="v-group-body">{group.items.map((item) => row(item, true))}</div>
                  ) : null}
                </div>
              );
            })
          ) : tab === "snapshot" ? (
            groups.map((group) => {
              const open = !!expanded[group.key];
              const frontier = group.key === "__frontier";
              return (
                <div className="v-group" key={group.key}>
                  <button
                    type="button"
                    className={`v-group-head${frontier ? " frontier" : ""}`}
                    onClick={() => toggle(group.key)}
                  >
                    <ChevronRight size={13} className={`v-caret${open ? " open" : ""}`} />
                    <span className="v-group-title">{group.title}</span>
                    <span className="v-group-note">{group.note}</span>
                  </button>
                  {open ? <div className="v-group-body">{group.items.map((item) => row(item, true))}</div> : null}
                </div>
              );
            })
          ) : flat.length ? (
            flat.map((v) => row(v))
          ) : (
            <div className="empty">
              <h4>这里还是空的</h4>
              <p>切换其他标签页看看。</p>
            </div>
          )}
        </div>

        <div className="card install-panel">
          {selectedId ? (
            <>
              <div className="install-hero">
                <div>
                  <div className="install-version">{selectedId}</div>
                  <div className="install-sub">
                    {selected
                      ? selected.tab === "release"
                        ? `正式版 · ${day(selected.releaseTime)}`
                        : selected.target
                          ? `${selected.badge} · 归属 ${selected.target}`
                          : `${selected.badge} · ${day(selected.releaseTime)}`
                      : "Mojang 原版"}
                    {loader !== "vanilla" && loaderVersion
                      ? ` · ${LOADER_NAME[loader]} ${loaderVersion}`
                      : ""}
                  </div>
                </div>
              </div>
              <div className="install-body">
                <Segmented
                  value={loader}
                  onChange={setLoader}
                  disabled={installing}
                  options={[
                    { value: "vanilla", label: "原版" },
                    { value: "fabric", label: "Fabric" },
                    { value: "forge", label: "Forge" },
                    { value: "neoforge", label: "Neo" },
                  ]}
                />

                {loader !== "vanilla" ? (
                  <label className="field">
                    <span className="field-label">{LOADER_NAME[loader]} 加载器</span>
                    <select
                      className="select"
                      value={loaderVersion}
                      onChange={(e) => setLoaderVersion(e.target.value)}
                      disabled={installing || loaders.length === 0}
                    >
                      {loaders.length ? (
                        loaders.map((l) => (
                          <option key={l.version} value={l.version}>
                            {l.version}
                            {l.stable ? "（推荐）" : ""}
                          </option>
                        ))
                      ) : (
                        <option value="">{loader === "fabric" ? "加载中…" : "该版本暂无可用构建"}</option>
                      )}
                    </select>
                    <span className="field-hint">
                      {loader === "fabric"
                        ? "Fabric 轻量、模组生态丰富，适合性能与模组向玩家。"
                        : `${LOADER_NAME[loader]} 会先安装原版，再运行官方 installer 生成版本配置。`}
                    </span>
                  </label>
                ) : (
                  <div className="notice">原版安装只下载 Mojang 客户端与依赖库，最为纯净。</div>
                )}

                {showProgress && progress ? (
                  <div className="install-progress">
                    <div className="install-progress-top">
                      <span>{progress.message}</span>
                      <b>
                        {progress.done}/{progress.total}
                      </b>
                    </div>
                    <ProgressBar done={progress.done} total={progress.total} />
                    <div className="install-note">
                      {formatBytes(progress.bytesDone)} / {formatBytes(progress.bytesTotal)}
                    </div>
                  </div>
                ) : null}

                {installing ? (
                  <button type="button" className="btn btn-danger" onClick={cancel}>
                    <X size={15} /> 取消安装
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={install}>
                    <Download size={15} /> 安装该版本
                  </button>
                )}

                <span className="install-note">
                  {installing ? "正在下载并校验文件，请稍候…" : "安装完成后即可在首页创建实例并启动。"}
                </span>
              </div>
            </>
          ) : (
            <div className="empty">
              <h4>选择左侧版本</h4>
              <p>点一个版本，这里就会出现安装选项。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
