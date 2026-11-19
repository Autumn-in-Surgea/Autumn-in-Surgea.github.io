import { useEffect, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { useWindowMotion } from "./interfaceMotion";
import "./full-screen.css";
import "./menu-theme.css";

const menuControls = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex='0']";

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  menuSurface = false,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  menuSurface?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useWindowMotion(ref, "page");
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    // Full-screen menus own the keyboard while the board is underneath them.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(menuControls))
      .filter(node => node.tabIndex >= 0 && node.getClientRects().length > 0);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === ref.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <section
      className={`menu-page${wide ? " menu-page-wide" : ""}`}
      data-menu-surface={menuSurface ? "" : undefined}
      data-window-motion=""
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={handleKey}
    >
      <header className="menu-page-header">
        <div className="menu-page-width menu-page-heading">
          <button className="menu-page-back" onClick={onClose} aria-label="关闭">
            <ArrowLeft aria-hidden="true" size={24} />
            <span>返回</span>
          </button>
          <div>
            {subtitle && <span className="eyebrow">{subtitle}</span>}
            <h2>{title}</h2>
          </div>
        </div>
      </header>
      <div className="menu-page-scroll">
        <div className="menu-page-width menu-page-content">
          {children}
        </div>
      </div>
      {footer && (
        <footer className="menu-page-footer">
          <div className="menu-page-width">{footer}</div>
        </footer>
      )}
    </section>,
    document.querySelector(".app") ?? document.body,
  );
}

export function ResourceIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="m10 1 3 5.5 6 1-4.5 4.5.8 6L10 15.2 4.7 18l.8-6L1 7.5l6-1z" />
    </svg>
  );
}
export function Cost({ value }: { value: number }) {
  return (
    <span className="cost">
      <ResourceIcon size={12} />
      <AnimatedNumber value={value} />
    </span>
  );
}
