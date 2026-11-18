import { useLayoutEffect, useRef } from "react";
import type { PointerEvent, ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

const treeSize = 720;
type Point = { x: number; y: number };

function midpoint(points: Point[]): Point {
  if (points.length === 1) return points[0];
  return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
}

function span([a, b]: Point[]) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fitScale(view: HTMLElement) {
  return Math.min(1, view.clientWidth / treeSize, view.clientHeight / treeSize);
}

function setScale(view: HTMLElement, scale: number) {
  view.style.setProperty("--tech-scale", String(scale));
  view.style.setProperty("--tech-extent", `${treeSize * scale}px`);
}

function showCentered(view: HTMLElement, scale: number) {
  setScale(view, scale);
  view.scrollLeft = (view.scrollWidth - view.clientWidth) / 2;
  view.scrollTop = (view.scrollHeight - view.clientHeight) / 2;
}

function center(view: HTMLElement) {
  return { x: view.clientWidth / 2, y: view.clientHeight / 2 };
}

// Keep the same point on the tree under the moving pinch midpoint (or cursor).
function zoomAt(view: HTMLElement, factor: number, from: Point, to: Point) {
  const oldScale = Number(view.style.getPropertyValue("--tech-scale")) || 1;
  const scale = Math.min(2.4, Math.max(fitScale(view), oldScale * factor));
  const ratio = scale / oldScale;
  const x = view.scrollLeft + from.x - view.scrollWidth / 2;
  const y = view.scrollTop + from.y - view.scrollHeight / 2;
  if (scale !== oldScale) setScale(view, scale);
  view.scrollLeft = view.scrollWidth / 2 + x * ratio - to.x;
  view.scrollTop = view.scrollHeight / 2 + y * ratio - to.y;
}

export function TechTreeViewport({ balance, children }: { balance: ReactNode; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const dragged = useRef(false);

  useLayoutEffect(() => {
    const view = viewport.current!;
    let previousFit = fitScale(view);
    // Start on the five main branches at a readable size on a narrow screen.
    showCentered(view, Math.max(0.88, previousFit));
    const resize = new ResizeObserver(() => {
      const fit = fitScale(view);
      if (fit === previousFit) return;
      const current = Number(view.style.getPropertyValue("--tech-scale"));
      showCentered(view, current <= previousFit ? fit : Math.max(fit, current));
      previousFit = fit;
    });
    resize.observe(view);
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const rect = view.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.clientHeight : 1;
      zoomAt(view, Math.exp(-event.deltaY * unit * 0.002), anchor, anchor);
    }
    view.addEventListener("wheel", wheel, { passive: false });
    return () => {
      view.removeEventListener("wheel", wheel);
      resize.disconnect();
    };
  }, []);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const active = pointers.current;
    if (!active.size) dragged.current = false;
    if (active.size >= 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    active.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (active.size > 1) dragged.current = true;
    // Capture on the button itself so a stationary tap keeps its normal click.
    const target = (event.target as Element).closest("button") ?? event.currentTarget;
    target.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = pointers.current;
    const previous = active.get(event.pointerId);
    if (!previous) return;
    const view = event.currentTarget;
    const rect = view.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (!dragged.current && Math.hypot(point.x - previous.x, point.y - previous.y) < 6) return;
    dragged.current = true;
    const before = [...active.values()];
    active.set(event.pointerId, point);
    const after = [...active.values()];
    const factor = active.size === 2 ? span(after) / Math.max(1, span(before)) : 1;
    zoomAt(view, factor, midpoint(before), midpoint(after));
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
  }

  function changeZoom(factor?: number) {
    const view = viewport.current!;
    if (factor) zoomAt(view, factor, center(view), center(view));
    else showCentered(view, fitScale(view));
  }

  return <>
    <div className="tech-balance">
      {balance}
      <div className="tech-zoom-controls" role="group" aria-label="科技树视图">
        <button type="button" onClick={() => changeZoom(1 / 1.25)} aria-label="缩小科技树" title="缩小"><Minus size={17} /></button>
        <button type="button" onClick={() => changeZoom()} aria-label="显示完整科技树" title="显示完整科技树"><Maximize size={16} /></button>
        <button type="button" onClick={() => changeZoom(1.25)} aria-label="放大科技树" title="放大"><Plus size={17} /></button>
      </div>
    </div>
    <div ref={viewport} className="tech-viewport" tabIndex={0} role="region" aria-label="可平移缩放的科技树"
      onPointerDownCapture={pointerDown} onPointerMove={pointerMove}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onClickCapture={event => {
        if (dragged.current && event.detail > 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}>
      <div className="tech-stage">
        <div className="radial-tech-tree" style={{ width: treeSize, height: treeSize }}>{children}</div>
      </div>
    </div>
  </>;
}
