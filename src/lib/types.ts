export type LoaderKind = "vanilla" | "fabric" | "forge" | "neoforge";
export type AccountKind = "microsoft" | "authlib" | "offline";
export type Mirror = "official" | "bmclapi";
export type Route = "home" | "versions" | "mods" | "downloads" | "ai" | "accounts" | "settings";

export interface LatestVersions {
  release: string;
  snapshot: string;
}

export interface VersionSummary {
  id: string;
  kind: string;
  url: string;
  time: string;
  releaseTime: string;
  sha1?: string;
}

export interface VersionListView {
  latest: LatestVersions;
  versions: VersionSummary[];
}

export interface Instance {
  id: string;
  name: string;
  versionId: string;
  gameVersion: string;
  loader: LoaderKind;
  loaderVersion?: string | null;
  createdAt: number;
  lastPlayed?: number | null;
  playtimeMs: number;
  memoryMb?: number | null;
  javaPath?: string | null;
  jvmArgs?: string | null;
  /** 实例专属登录账户；空则用全局选中账户 */
  accountId?: string | null;
  installed: boolean;
}

export interface Account {
  id: string;
  kind: AccountKind;
  username: string;
  uuid: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number;
  authlibBase?: string | null;
  authlibName?: string | null;
  xuid?: string | null;
  avatar?: string | null;
}

export interface AccountsView {
  accounts: Account[];
  selected: string | null;
}

export interface Settings {
  javaPath: string;
  autoJava: boolean;
  memoryMb: number;
  jvmArgs: string;
  mirror: Mirror;
  concurrency: number;
  minimizeOnLaunch: boolean;
  closeAfterLaunch: boolean;
  microsoftClientId: string;
  lastInstance?: string | null;
  showSnapshots: boolean;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
}

export interface JavaInfo {
  path: string;
  version: string;
  major: number;
  vendor: string;
  arch: string;
}

export interface DeviceCodeInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

export interface MsPollResult {
  status: "pending" | "success" | "failed";
  account?: Account;
  message?: string;
}

export interface FabricLoaderInfo {
  version: string;
  stable: boolean;
}

export interface ProgressEvent {
  taskId: string;
  stage: string;
  message: string;
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
}

export interface InstallResult {
  versionId: string;
  libraries: number;
  assets: number;
  durationMs: number;
}

export interface GameLogEvent {
  instanceId: string;
  line: string;
  stream: string;
}

export interface GameStateEvent {
  instanceId: string;
  state: "running" | "exited";
  code?: number | null;
  message?: string | null;
}

export interface AppInfo {
  version: string;
  dataDir: string;
  os: string;
  arch: string;
}

export interface ModHit {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  follows: number;
  iconUrl?: string | null;
  categories: string[];
  versions: string[];
}

export interface ModSearchResult {
  hits: ModHit[];
  totalHits: number;
  offset: number;
  limit: number;
}

export interface ModVersionInfo {
  id: string;
  name: string;
  versionNumber: string;
  versionType: string;
  gameVersions: string[];
  loaders: string[];
  downloads: number;
  datePublished: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileSha1: string;
}

export interface InstalledMod {
  fileName: string;
  displayName: string;
  size: number;
  enabled: boolean;
}

// ───────────────────────────── 存储占用 ─────────────────────────────

export interface StorageBucket {
  key: string;
  label: string;
  hint: string;
  bytes: number;
  files: number;
  cleanable: boolean;
}

export interface StorageStats {
  root: string;
  totalBytes: number;
  totalFiles: number;
  buckets: StorageBucket[];
}

// ───────────────────────────── 下载中心 ─────────────────────────────

export type DownloadStatus = "running" | "done" | "cancelled" | "failed";

export interface DownloadJob {
  taskId: string;
  label: string;
  kind: string;
  stage: string;
  message: string;
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  /** 后端平滑计算出的实时速度，字节/秒 */
  speed: number;
  startedAt: number;
  updatedAt: number;
  status: DownloadStatus;
  error?: string | null;
}

export interface LoaderInfo {
  version: string;
  gameVersion: string;
  installerUrl: string;
  stable: boolean;
  /** 安装后生成的版本 id */
  versionId: string;
}

// ───────────────────────────── 资源详情 ─────────────────────────────

export interface ProjectDetail {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  iconUrl?: string | null;
  downloads: number;
  follows: number;
  categories: string[];
  projectType: string;
  /** 全部支持过的游戏版本（新 → 旧） */
  gameVersions: string[];
  loaders: string[];
  /** 是否兼容当前实例的游戏版本 */
  compatible: boolean;
  currentVersion: string;
  versions: ModVersionInfo[];
}

export interface ScreenshotInfo {
  fileName: string;
  size: number;
  path: string;
}

export interface AiConfigView {
  baseUrl: string;
  model: string;
  keySet: boolean;
}

export interface DataDirView {
  current: string;
  configPath: string;
  custom: boolean;
  pending?: string | null;
}

export interface AiAction {
  type: string;
  [key: string]: unknown;
}
