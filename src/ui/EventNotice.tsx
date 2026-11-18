import { useId, useLayoutEffect, useRef } from "react";
import type { EventNotice as EventContent } from "../game/types";
import { getNation } from "../nations/registry";
import { NationEmblem } from "./NationEmblem";
import "./event-notice.css";

export function EventNotice({ notice, onAcknowledge }: {
  notice: EventContent;
  onAcknowledge: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const nation = notice.nationId ? getNation(notice.nationId) : undefined;
  const titleId = useId();
  const messageId = useId();

  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useLayoutEffect(() => {
    text.current?.scrollTo(0, 0);
    confirm.current?.focus({ preventScroll: true });
  }, [notice]);

  return (
    <dialog
      ref={dialog}
      className="event-notice"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div className="event-notice-card">
        <header>
          {nation && <NationEmblem nation={nation} />}
          <h2 id={titleId}>{notice.title}</h2>
        </header>
        <div id={messageId} ref={text} className="event-notice-message">
          {notice.message}
        </div>
        <footer>
          <button
            ref={confirm}
            type="button"
            className="primary"
            onClick={onAcknowledge}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.repeat) event.preventDefault();
            }}
          >
            我知道了
          </button>
        </footer>
      </div>
    </dialog>
  );
}
