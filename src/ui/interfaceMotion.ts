import { useLayoutEffect } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import "./interface-motion.css";

type WindowSurface = "page" | "notice" | "trait";

const presses = new WeakMap<HTMLElement, Animation>();

function motionAllowed(root: Element) {
  return !root.classList.contains("reduce-motion") &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function showEffect(root: Element, element: HTMLElement, lifetime: number) {
  element.setAttribute("aria-hidden", "true");
  element.inert = true;
  root.append(element);
  const timeout = window.setTimeout(() => element.remove(), lifetime);
  element.addEventListener("animationend", event => {
    if (event.target !== element || event.pseudoElement) return;
    window.clearTimeout(timeout);
    element.remove();
  });
}

function turnRipple(root: Element, rect: DOMRect) {
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 1.1;
  const buttonRadius = Math.hypot(rect.width, rect.height) / 2;
  const ripple = document.createElement("span");
  ripple.className = "interface-turn-ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.setProperty("--wave-diameter", `${radius * 2}px`);
  ripple.style.setProperty("--wave-start", String(buttonRadius * .22 / radius));
  ripple.style.setProperty("--wave-near", String(buttonRadius * 1.04 / radius));
  showEffect(root, ripple, 1100);
}

export function playInterfaceClick(event: ReactMouseEvent<HTMLDivElement>) {
  const root = event.currentTarget;
  if (!(event.target instanceof Element) || !motionAllowed(root)) return;
  const button = event.target.closest<HTMLElement>("button:not(:disabled), summary");
  if (!button || !root.contains(button) || button.closest("[inert]")) return;
  const rect = button.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = event.detail ? event.clientX - rect.left : rect.width / 2;
  const y = event.detail ? event.clientY - rect.top : rect.height / 2;

  // Let controls such as the draggable tech tree reject a click first.
  queueMicrotask(() => {
    if (event.defaultPrevented || !root.isConnected || !motionAllowed(root)) return;
    if (button.matches(".hud-end-turn")) {
      turnRipple(root, rect);
      return;
    }

    if (button.isConnected && button.animate) {
      presses.get(button)?.cancel();
      presses.set(button, button.animate([
        { scale: ".97", filter: "brightness(1.14)" },
        { scale: "1.025", filter: "brightness(1.07)", offset: .36 },
        { scale: "1", filter: "brightness(1)" },
      ], { duration: 265, easing: "cubic-bezier(.15,.78,.31,1)" }));
    }

    const flare = document.createElement("span");
    flare.className = "interface-button-flash";
    Object.assign(flare.style, {
      left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    });
    flare.style.setProperty("--press-x", `${x}px`);
    flare.style.setProperty("--press-y", `${y}px`);
    showEffect(root, flare, 440);
  });
}

function leaveWindow(element: HTMLElement, surface: WindowSurface) {
  const root = element.closest(".app");
  if (!root || !motionAllowed(root)) return;
  const snapshot = element.cloneNode(true) as HTMLElement;
  snapshot.classList.add("interface-window-snapshot");
  snapshot.removeAttribute("id");
  snapshot.removeAttribute("role");
  snapshot.removeAttribute("aria-modal");
  snapshot.removeAttribute("tabindex");
  snapshot.querySelectorAll("[id], [autofocus]").forEach(item => {
    item.removeAttribute("id");
    item.removeAttribute("autofocus");
  });
  // The snapshot is only painted; the live window and its focus trap leave immediately.
  if (surface !== "page") {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    Object.assign(snapshot.style, {
      inset: "auto", margin: "0", maxWidth: "none", maxHeight: "none",
      left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    });
    snapshot.setAttribute("open", "");
  }
  const layer = document.createElement("div");
  layer.className = "interface-window-exit";
  layer.dataset.surface = surface;
  layer.append(snapshot);
  showEffect(root, layer, 290);
  const scrollRegions = element.querySelectorAll(".menu-page-scroll, .event-notice-message");
  snapshot.querySelectorAll(".menu-page-scroll, .event-notice-message").forEach((item, i) => {
    item.scrollTop = scrollRegions[i].scrollTop;
    item.scrollLeft = scrollRegions[i].scrollLeft;
  });
  const maps = element.querySelectorAll<HTMLCanvasElement>(".setup-map");
  snapshot.querySelectorAll<HTMLCanvasElement>(".setup-map").forEach((item, i) => {
    item.getContext("2d")?.drawImage(maps[i], 0, 0);
  });
}

export function useWindowMotion(ref: RefObject<HTMLElement | null>, surface: WindowSurface) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let shown = false;
    const displayFrame = window.requestAnimationFrame(() => { shown = true; });
    return () => {
      window.cancelAnimationFrame(displayFrame);
      // React Strict Mode may tear down a newly mounted effect before it is ever painted.
      if (shown && element.isConnected) leaveWindow(element, surface);
    };
  }, [ref, surface]);
}
