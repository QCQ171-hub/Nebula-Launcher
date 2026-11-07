import type { VersionSummary } from "./types";

/**
 * Mojang 每年 4 月 1 日前后发布的整活版本。它们同样是 `snapshot` 类型，
 * 但不属于任何正式版的开发线，必须单独拎出来，否则会被算进「XX 测试版」。
 */
const APRIL_FOOLS = new Set([
  "15w14a", // 2015 · 爱之玻璃
  "1.RV-Pre1", // 2016 · 潮流更新
  "3D Shareware v1.34", // 2019 · 3D 共享软件
  "20w14infinite", // 2020 · 无限维度
  "22w13oneblockatatime", // 2022 · 一次一个方块
  "23w13a_or_b", // 2023 · 投票更新
  "24w14potato", // 2024 · 毒马铃薯
  "25w14craftmine", // 2025 · 合成矿井
  "26w14a", // 2026 · 未命名
]);

/** 四个标签页 */
export type VersionTab = "release" | "snapshot" | "april" | "ancient";

/** 构建阶段：正式版 / 预发布（pre、rc）/ 周快照 */
export type VersionStage = "release" | "pre" | "snapshot";

export interface ClassifiedVersion extends VersionSummary {
  /** 属于哪个标签页 */
  tab: VersionTab;
  /** 归属的正式版 id；前沿测试版为 null */
  target: string | null;
  /** 列表里显示的徽章文案，例如「1.20.5 测试版」 */
  badge: string;
  stage: VersionStage;
}

export interface VersionGroup {
  key: string;
  title: string;
  note: string;
  items: ClassifiedVersion[];
}

/** 形如 `1.20.5-rc1`、`26.1.2-rc-1`、`1.14 Pre-Release 4` 都算预发布 */
function stageOf(id: string): VersionStage {
  return /(-rc-?\d|rc\d|-pre-?\d|pre\d|pre-release)/i.test(id) ? "pre" : "snapshot";
}

/** 从 id 开头提取版本号；`24w14a`、`1.RV-Pre1` 这类拿不到 */
const VERSION_PREFIX = /^(\d+(?:\.\d+)+)/;

/**
 * 读取版本类型。后端字段叫 `kind`，但 Mojang 原始清单里是 `type`；
 * 这里做一次兼容，避免字段名不一致时整张表都被判成快照。
 */
function kindOf(v: VersionSummary): string {
  const raw = v as VersionSummary & { type?: string };
  return raw.kind || raw.type || "";
}

function nextReleaseAfter(releases: VersionSummary[], times: number[], t: number): VersionSummary | null {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return releases[lo] ?? null;
}

/**
 * 版本分类。
 *
 * 1. 愚人节版（白名单）→ `april`
 * 2. old_alpha / old_beta → `ancient`（1.0 以前）
 * 3. release → `release`
 * 4. 其余（snapshot / pre / rc）：
 *    - id 自带版本号（`1.20.5-pre1`）→ 归到该版本
 *    - 周快照（`24w14a`）→ 归到它发布之后第一个正式版
 *    - 找不到后续正式版 → 前沿测试版
 */
export function classifyVersions(versions: VersionSummary[]): ClassifiedVersion[] {
  const releases = versions
    .filter((v) => kindOf(v) === "release")
    .slice()
    .sort((a, b) => Date.parse(a.releaseTime) - Date.parse(b.releaseTime));
  const byId = new Map(releases.map((v) => [v.id, v]));
  const times = releases.map((v) => Date.parse(v.releaseTime));

  return versions.map((v) => {
    const base = { ...v, target: null as string | null };
    const kind = kindOf(v);

    if (APRIL_FOOLS.has(v.id)) {
      return { ...base, tab: "april" as const, badge: "愚人节", stage: stageOf(v.id) };
    }
    if (kind === "old_alpha" || kind === "old_beta") {
      return {
        ...base,
        tab: "ancient" as const,
        badge: kind === "old_alpha" ? "Alpha" : "Beta",
        stage: "snapshot" as const,
      };
    }
    if (kind === "release") {
      return { ...base, tab: "release" as const, badge: "正式版", stage: "release" as const };
    }

    const hinted = VERSION_PREFIX.exec(v.id)?.[1];
    const target = (hinted ? byId.get(hinted) : undefined) ?? nextReleaseAfter(releases, times, Date.parse(v.releaseTime));

    if (!target) {
      return { ...base, tab: "snapshot" as const, badge: "前沿测试版", stage: stageOf(v.id) };
    }
    return {
      ...base,
      tab: "snapshot" as const,
      target: target.id,
      badge: `${target.id} 测试版`,
      stage: stageOf(v.id),
    };
  });
}

/**
 * 正式版视图：每个正式版一组，组内是归属它的测试版。
 * 这样「有正式版的快照」就自然排在正式版下面了。
 */
export function groupReleases(list: ClassifiedVersion[]): VersionGroup[] {
  const byTarget = new Map<string, ClassifiedVersion[]>();
  for (const v of list) {
    if (v.tab === "snapshot" && v.target) {
      const bucket = byTarget.get(v.target);
      if (bucket) {
        bucket.push(v);
      } else {
        byTarget.set(v.target, [v]);
      }
    }
  }

  return list
    .filter((v) => v.tab === "release")
    .map((v) => {
      const items = byTarget.get(v.id) ?? [];
      return {
        key: v.id,
        title: v.id,
        note: items.length ? `${items.length} 个测试版` : "无预发布",
        items,
      };
    });
}

/**
 * 测试版视图：前沿测试版置顶，其余按归属的正式版分组（新 → 旧）。
 */
export function groupSnapshots(list: ClassifiedVersion[]): VersionGroup[] {
  const frontier = list.filter((v) => v.tab === "snapshot" && !v.target);
  const groups: VersionGroup[] = [];

  if (frontier.length) {
    groups.push({
      key: "__frontier",
      title: "前沿测试版",
      note: `${frontier.length} 个 · 尚未发布正式版`,
      items: frontier,
    });
  }

  const byTarget = new Map<string, ClassifiedVersion[]>();
  for (const v of list) {
    if (v.tab === "snapshot" && v.target) {
      const bucket = byTarget.get(v.target);
      if (bucket) {
        bucket.push(v);
      } else {
        byTarget.set(v.target, [v]);
      }
    }
  }

  for (const v of list) {
    if (v.tab !== "release") {
      continue;
    }
    const items = byTarget.get(v.id);
    if (items?.length) {
      groups.push({ key: v.id, title: `${v.id} 测试版`, note: `${items.length} 个构建`, items });
    }
  }

  return groups;
}

/** 愚人节 / 远古版本：直接按时间倒序平铺 */
export function flatten(list: ClassifiedVersion[], tab: VersionTab): ClassifiedVersion[] {
  return list.filter((v) => v.tab === tab);
}

export const TAB_LABEL: Record<VersionTab, string> = {
  release: "正式版",
  snapshot: "测试版",
  april: "愚人节",
  ancient: "远古版本",
};
