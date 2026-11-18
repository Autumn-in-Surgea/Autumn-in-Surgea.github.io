import type { NationPack } from "../nations/registry";
import "./nation-emblem.css";

export function NationEmblem({ nation, className = "", decorative = true }: {
  nation: NationPack;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span className={`nation-emblem ${className}`}>
      <img src={nation.images.emblem} alt={decorative ? "" : nation.name} width={36} height={36} />
    </span>
  );
}
