import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** 是否运行在 Tauri 容器内。这里不再提供任何浏览器假数据回退。 */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 没有 Rust 后端时的统一提示语 */
export const BACKEND_MISSING =
  "缺少后端：本应用必须在 Tauri 桌面窗口中运行（npm run tauri:dev 或双击打包后的 exe）。浏览器直接打开无法调用 Rust 后端。";

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(BACKEND_MISSING);
  }
  return invoke<T>(cmd, args);
}

export function on<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!isTauri()) {
    // 事件订阅是被动的，这里静默返回空订阅即可，错误由 call() 统一抛出
    return Promise.resolve(() => undefined);
  }
  return listen<T>(event, (e) => handler(e.payload));
}
