import { create } from "zustand";

import { BACKEND_MISSING, call } from "../lib/bridge";
import type {
  Account,
  AccountsView,
  AppInfo,
  DownloadJob,
  Instance,
  ProgressEvent,
  Route,
  Settings,
} from "../lib/types";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

interface AppState {
  ready: boolean;
  route: Route;
  appInfo: AppInfo | null;
  settings: Settings | null;
  instances: Instance[];
  accounts: AccountsView;
  activeInstanceId: string | null;
  running: Record<string, boolean>;
  logs: Record<string, string[]>;
  progress: ProgressEvent | null;
  downloads: DownloadJob[];
  backendError: string | null;
  toasts: Toast[];

  bootstrap: () => Promise<void>;
  setRoute: (route: Route) => void;
  refreshInstances: () => Promise<void>;
  refreshDownloads: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  setActiveInstance: (id: string) => void;
  setRunning: (instanceId: string, running: boolean) => void;
  appendLog: (instanceId: string, line: string) => void;
  clearLogs: (instanceId: string) => void;
  setProgress: (progress: ProgressEvent | null) => void;
  pushToast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
}

const errorText = (error: unknown): string =>
  typeof error === "string" ? error : error instanceof Error ? error.message : String(error);

export const useApp = create<AppState>()((set, get) => ({
  ready: false,
  route: "home",
  appInfo: null,
  settings: null,
  instances: [],
  accounts: { accounts: [], selected: null },
  activeInstanceId: null,
  running: {},
  logs: {},
  progress: null,
  downloads: [],
  backendError: null,
  toasts: [],

  bootstrap: async () => {
    try {
      const [appInfo, settings, instances, accounts] = await Promise.all([
        call<AppInfo>("app_info"),
        call<Settings>("settings_get"),
        call<Instance[]>("instances_list"),
        call<AccountsView>("accounts_list"),
      ]);
      const active =
        (settings.lastInstance && instances.some((item) => item.id === settings.lastInstance)
          ? settings.lastInstance
          : instances[0]?.id) ?? null;
      set({ appInfo, settings, instances, accounts, activeInstanceId: active, ready: true, backendError: null });
      void get().refreshDownloads();
    } catch (error) {
      set({
        ready: true,
        backendError:
          typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)
            ? BACKEND_MISSING
            : `后端连接失败：${errorText(error)}`,
      });
      get().pushToast("error", errorText(error));
    }
  },

  setRoute: (route) => set({ route }),

  refreshInstances: async () => {
    try {
      const instances = await call<Instance[]>("instances_list");
      const current = get().activeInstanceId;
      const active = current && instances.some((item) => item.id === current)
        ? current
        : instances[0]?.id ?? null;
      set({ instances, activeInstanceId: active });
    } catch (error) {
      get().pushToast("error", errorText(error));
    }
  },

  refreshAccounts: async () => {
    try {
      const accounts = await call<AccountsView>("accounts_list");
      set({ accounts });
    } catch (error) {
      get().pushToast("error", errorText(error));
    }
  },

  refreshSettings: async () => {
    try {
      const settings = await call<Settings>("settings_get");
      set({ settings });
    } catch (error) {
      get().pushToast("error", errorText(error));
    }
  },

  setSettings: (settings) => set({ settings }),

  refreshDownloads: async () => {
    try {
      const downloads = await call<DownloadJob[]>("downloads_list");
      set({ downloads });
    } catch {
      // 下载中心只是辅助视图，轮询失败时保留上一次结果，不打扰用户
    }
  },

  setActiveInstance: (id) => set({ activeInstanceId: id }),

  setRunning: (instanceId, running) =>
    set((state) => ({ running: { ...state.running, [instanceId]: running } })),

  appendLog: (instanceId, line) =>
    set((state) => {
      const previous = state.logs[instanceId] ?? [];
      const next = [...previous, line].slice(-600);
      return { logs: { ...state.logs, [instanceId]: next } };
    }),

  clearLogs: (instanceId) =>
    set((state) => ({ logs: { ...state.logs, [instanceId]: [] } })),

  setProgress: (progress) => set({ progress }),

  pushToast: (kind, text) => {
    const id = Date.now() + Math.random();
    set((state) => ({ toasts: [...state.toasts, { id, kind, text }] }));
    window.setTimeout(() => get().dismissToast(id), kind === "error" ? 7000 : 4200);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const pickSelectedAccount = (accounts: AccountsView): Account | null => {
  if (!accounts.accounts.length) return null;
  return (
    accounts.accounts.find((account) => account.id === accounts.selected) ?? accounts.accounts[0]
  );
};

export const pickActiveInstance = (
  instances: Instance[],
  activeInstanceId: string | null,
): Instance | null =>
  instances.find((instance) => instance.id === activeInstanceId) ?? instances[0] ?? null;

export { errorText };
