import { createContext, useContext, useLayoutEffect, useRef } from "react";
import "./number-motion.css";

export function allowsNumberMotion(element: HTMLElement) {
  return !element.closest(".reduce-motion") &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    typeof element.animate === "function";
}

export const NumberMotionDisabled = createContext(false);

export function useNumberMotion<T extends HTMLElement>(value: number) {
  const element = useRef<T>(null);
  const previous = useRef(value);
  const disabled = useContext(NumberMotionDisabled);
  useLayoutEffect(() => {
    const difference = value - previous.current;
    previous.current = value;
    const node = element.current;
    if (disabled || !difference || !node || !allowsNumberMotion(node)) return;

    const direction = Math.sign(difference);
    const light = direction > 0 ? "#dfb9689e" : "#d98d759e";
    const animation = node.animate([
      { transform: `translateY(${direction * 0.24}em) scale(.91)`, opacity: .62 },
      { transform: `translateY(${-direction * 0.12}em) scale(1.12)`, opacity: 1,
        textShadow: `0 0 .48em ${light}`, offset: .51 },
      { transform: `translateY(${direction * 0.035}em) scale(.985)`, textShadow: "0 0 .15em #c1946835", offset: .78 },
      { transform: "none", opacity: 1, textShadow: "none" },
    ], { duration: 350, easing: "cubic-bezier(.18,.71,.29,1)" });
    return () => animation.cancel();
  }, [disabled, value]);
  return element;
}

export function AnimatedNumber({ value, prefix, suffix }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useNumberMotion<HTMLSpanElement>(value);
  const display = value < 0 ? `−${-value}` : value;
  return <span ref={ref} className="animated-number">{prefix}{display}{suffix}</span>;
}

// Keep mixed action descriptions as plain text for their accessible names.
export function AnimatedNumbersInText({ text }: { text: string }) {
  return text.split(/(\d+(?:\.\d+)?)/).map((part, index) =>
    index % 2 ? <AnimatedNumber key={index} value={Number(part)} /> : part);
}
