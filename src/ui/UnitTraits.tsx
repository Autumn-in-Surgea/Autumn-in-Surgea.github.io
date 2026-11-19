import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { UnitSkill } from "../game/types";
import { useWindowMotion } from "./interfaceMotion";

const traits: Record<UnitSkill, readonly [label: string, description: string]> = {
  dash: ["突进", "移动后仍可发动攻击。"],
  escape: ["撤离", "攻击后还可以移动一次。"],
  fortify: ["驻防", "驻守己方城市时获得防御加成，城墙会进一步提高加成。"],
  persist: ["连击", "击杀目标后可以继续攻击。"],
  stiff: ["无法反击", "受到攻击时无法反击。"],
  static: ["不可晋升", "无法晋升为老兵。"],
  heal: ["治疗", "消耗完整行动，为每支相邻友军恢复最多 4 点生命。"],
  convert: ["劝降", "消耗完整行动，使一支相邻敌军加入己方。"],
  hide: ["隐蔽", "移动后进入隐蔽状态，敌军通常无法看见。"],
  infiltrate: ["渗透", "渗透相邻敌城，夺取该城收入并召集地下突击队或海盗。"],
  scout: ["侦察", "基础视野扩大到周围两格。"],
  creep: ["潜行", "可穿过敌军并无视可通行地块的地形减速。"],
  surprise: ["奇袭", "发动攻击时，目标无法反击。"],
  independent: ["独立", "不占所属城市的单位容量。"],
  water: ["水上", "可以在水面航行，进入深水需要航海科技。"],
  carry: ["载运", "运输登船的陆军。登陆时恢复乘员原有的兵种。"],
  splash: ["溅射", "攻击时对目标周围的敌军造成额外伤害。"],
  stomp: ["践踏", "移动时对相邻敌军造成伤害。"],
};

function UnitTraitDialog({ id, skill, anchor, dismiss }: {
  id: string;
  skill: UnitSkill;
  anchor: HTMLButtonElement;
  dismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useWindowMotion(ref, "trait");

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const viewport = window.visualViewport;
    const place = () => {
      const margin = 10;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const topEdge = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      dialog.style.maxWidth = `${width - 2 * margin}px`;
      dialog.style.maxHeight = `${height - 2 * margin}px`;
      const origin = anchor.getBoundingClientRect();
      // The entrance scale is visual and must not influence placement.
      const card = { width: dialog.offsetWidth, height: dialog.offsetHeight };
      const left = Math.max(leftEdge + margin,
        Math.min(origin.left + (origin.width - card.width) / 2, leftEdge + width - card.width - margin));
      const above = origin.top - card.height - 8;
      const top = above >= topEdge + margin ? above
        : Math.max(topEdge + margin, Math.min(origin.bottom + 8, topEdge + height - card.height - margin));
      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
    };
    place();
    window.addEventListener("resize", place);
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
      if (dialog.open) dialog.close();
      if (anchor.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [anchor]);

  return createPortal(
    <dialog ref={ref} id={id} className="unit-trait-dialog" data-window-motion="" role="dialog" aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}
    >
      <div className="unit-trait-card">
        <header>
          <h2 id={`${id}-title`}>{traits[skill][0]}</h2>
          <button type="button" aria-label="关闭特性介绍" autoFocus onClick={dismiss}>
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <p id={`${id}-description`}>{traits[skill][1]}</p>
      </div>
    </dialog>,
    anchor.closest(".app") ?? document.body,
  );
}

export function UnitTraits({ skills }: { skills: readonly UnitSkill[] }) {
  const [active, setActive] = useState<{ skill: UnitSkill; anchor: HTMLButtonElement } | null>(null);
  const id = useId();
  if (!skills.length) return "无";
  return (
    <span className="unit-traits">
      {skills.map(skill => (
        <button key={skill} type="button" className="unit-trait"
          aria-haspopup="dialog" aria-expanded={active?.skill === skill}
          aria-controls={active?.skill === skill ? id : undefined}
          onClick={event => setActive({ skill, anchor: event.currentTarget })}
        >
          {traits[skill][0]}
        </button>
      ))}
      {active && <UnitTraitDialog id={id} {...active} dismiss={() => setActive(null)} />}
    </span>
  );
}
