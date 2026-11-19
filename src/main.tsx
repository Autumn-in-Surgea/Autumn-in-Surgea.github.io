import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/main.css";
import { initializePwa } from "./pwa/register";

initializePwa();

const root = document.getElementById("root")!;

// Cancel Safari's page gesture and forward trackpad pinch to the existing zoom controls.
type PinchGesture = Event & { scale: number; clientX?: number; clientY?: number };
let pinchTarget: Element | null = null;
let lastPinchScale = 1;
root.addEventListener("gesturestart", (event) => {
  event.preventDefault();
  lastPinchScale = 1;
  pinchTarget = navigator.maxTouchPoints === 0 && event.target instanceof Element
    ? event.target.closest(".game-scene canvas, .tech-viewport")
    : null;
}, { passive: false });
root.addEventListener("gesturechange", (event) => {
  event.preventDefault();
  const { scale, clientX, clientY } = event as PinchGesture;
  if (!pinchTarget?.isConnected || !Number.isFinite(scale) || scale <= 0 || scale === lastPinchScale) return;
  const bounds = pinchTarget.getBoundingClientRect();
  pinchTarget.dispatchEvent(new WheelEvent("wheel", {
    cancelable: true,
    ctrlKey: true,
    clientX: clientX ?? bounds.x + bounds.width / 2,
    clientY: clientY ?? bounds.y + bounds.height / 2,
    deltaY: -200 * Math.log(scale / lastPinchScale),
  }));
  lastPinchScale = scale;
}, { passive: false });
root.addEventListener("gestureend", (event) => {
  event.preventDefault();
  pinchTarget = null;
}, { passive: false });

// Chromium and Firefox use a modified wheel event for desktop trackpad pinch.
root.addEventListener("wheel", (event) => {
  if (event.ctrlKey && !event.defaultPrevented) event.preventDefault();
}, { passive: false });

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>加载失败</h1>
        <p>画面遇到异常。自动存档仍保留在浏览器中。</p>
        <pre>{this.state.error}</pre>
        <button onClick={() => location.reload()}>重新载入</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
