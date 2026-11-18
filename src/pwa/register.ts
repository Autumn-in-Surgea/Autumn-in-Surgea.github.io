import { registerSW } from "virtual:pwa-register";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaState {
  supported: boolean;
  offlineReady: boolean;
  needRefresh: boolean;
  installAvailable: boolean;
  installed: boolean;
  online: boolean;
  error: string;
}

let state: PwaState = {
  supported: false,
  offlineReady: false,
  needRefresh: false,
  installAvailable: false,
  installed: false,
  online: true,
  error: "",
};
const listeners = new Set<() => void>();
let initialized = false;
let installPrompt: InstallPrompt | undefined;
let registration: ServiceWorkerRegistration | undefined;
let updateRequested = false;

function publish(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function getPwaState() {
  return state;
}

export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Call before rendering: install prompts can arrive before Settings is opened. */
export function initializePwa() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const standalone = window.matchMedia("(display-mode: standalone)");
  const device = navigator as Navigator & { standalone?: boolean };
  // Desktop-style iPad user agents still advertise Macintosh with touch input.
  const appleMobile = /iPhone|iPad|iPod/.test(device.userAgent) ||
    (/Macintosh/.test(device.userAgent) && device.maxTouchPoints > 1);
  const installed = () => standalone.matches || device.standalone === true;
  const syncIosLayout = () => document.documentElement.toggleAttribute(
    "data-ios-standalone",
    device.standalone === true || (standalone.matches && appleMobile),
  );
  syncIosLayout();
  publish({
    installed: installed(),
    online: navigator.onLine,
    supported: import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext,
  });
  window.addEventListener("online", () => {
    publish({ online: true });
    void registration?.update().catch(() => undefined);
  });
  window.addEventListener("offline", () => publish({ online: false }));
  standalone.addEventListener("change", () => {
    syncIosLayout();
    publish({ installed: installed() });
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    publish({ installAvailable: true });
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    publish({ installed: true, installAvailable: false });
    void requestPersistentStorage();
  });
  if (!state.supported) return;
  // Reload the tab that requested the update when the new worker takes over.
  // Use the browser event also for tabs opened before their first worker installed.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateRequested) window.location.reload();
  });
  registerSW({
    immediate: true,
    onNeedRefresh: () => publish({ needRefresh: true, offlineReady: true }),
    onNeedReload: () => publish({ needRefresh: true }),
    onOfflineReady: () => publish({ offlineReady: true, error: "" }),
    onRegisteredSW: (_url, value) => {
      registration = value;
      if (value?.active) publish({ offlineReady: true, error: "" });
      if (value?.waiting) publish({ needRefresh: true });
      // Re-check on returning to the app, without automatically replacing an active game.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && navigator.onLine)
          void registration?.update().catch(() => undefined);
      });
    },
    onRegisterError: () => publish({ error: "离线缓存未完成，请联网重试。" }),
  });
  void navigator.serviceWorker.ready.then(() => {
    publish({ offlineReady: true });
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return await navigator.storage?.persist?.() ?? false;
  } catch {
    return false;
  }
}

export async function installPwa(): Promise<boolean> {
  if (!installPrompt || !state.offlineReady) return false;
  const prompt = installPrompt;
  installPrompt = undefined;
  publish({ installAvailable: false });
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") void requestPersistentStorage();
    return choice.outcome === "accepted";
  } catch {
    publish({ error: "请使用浏览器菜单安装。" });
    return false;
  }
}

export async function applyPwaUpdate(): Promise<void> {
  if (!state.needRefresh || updateRequested) return;
  const waiting = registration?.waiting;
  // Another window may have activated the update before we clicked.
  if (!waiting) {
    window.location.reload();
    return;
  }
  updateRequested = true;
  try {
    waiting.postMessage({ type: "SKIP_WAITING" });
  } catch (error) {
    updateRequested = false;
    throw error;
  }
}
