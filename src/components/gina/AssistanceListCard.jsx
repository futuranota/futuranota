import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";

const DESK_IMG = "/uploads/G-Assistance-Desk.png";
const RESPONDE_IMG = "/uploads/g-assistente-responde.png";

/** Above overlay backdrop (12000), below chat panel (12002). */
const HERO_FLOAT_Z = 12001;

/**
 * Compact Assistance strip: Talk + Knowledge (opens overlay) + Meetings.
 *
 * @param {{
 *   onTalk: () => void,
 *   onOpenMeeting: () => void,
 *   onOpenKnowledge: () => void,
 *   isAdmin?: boolean,
 *   knowledgeDocCount?: number,
 *   chatOpen?: boolean,
 * }} props
 */
export function AssistanceListCard({
  onTalk,
  onOpenMeeting,
  onOpenKnowledge,
  isAdmin = false,
  knowledgeDocCount = 0,
  chatOpen = false,
}) {
  const { t } = useI18n();
  const slotRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [floatRect, setFloatRect] = useState(
    /** @type {{ top: number, left: number, width: number, height: number } | null} */ (null),
  );

  useLayoutEffect(() => {
    if (!chatOpen) {
      setFloatRect(null);
      return undefined;
    }

    const syncRect = () => {
      const el = slotRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setFloatRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    };

    syncRect();
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);
    return () => {
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
    };
  }, [chatOpen]);

  return (
    <div className="lp-assistance-space">
      <div
        ref={slotRef}
        className={"lp-assistance-hero" + (chatOpen ? " is-chat-open" : "")}
      >
        <img
          src={DESK_IMG}
          alt=""
          className="lp-assistance-hero__img"
          aria-hidden={chatOpen}
        />
      </div>

      {chatOpen && floatRect && typeof document !== "undefined"
        ? createPortal(
            <img
              src={RESPONDE_IMG}
              alt=""
              className="lp-assistance-hero__float"
              draggable={false}
              style={{
                top: floatRect.top,
                left: floatRect.left,
                width: floatRect.width,
                height: floatRect.height,
                zIndex: HERO_FLOAT_Z,
              }}
            />,
            document.body,
          )
        : null}

      <button
        type="button"
        className="btn sm lp-assistance-action-btn lp-assistance-call-btn"
        onClick={() => onTalk?.()}
        disabled={chatOpen}
        aria-pressed={chatOpen}
      >
        {t("gina.talkToAssistance")}
      </button>

      <div className="lp-assistance-actions">
        <button
          type="button"
          className="btn sm lp-assistance-action-btn"
          onClick={() => onOpenKnowledge?.()}
        >
          {t("gina.knowledgeTitle")}
          {knowledgeDocCount > 0 ? (
            <span className="lp-assistance-action-btn__count">{knowledgeDocCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          className="btn sm primary lp-assistance-action-btn"
          disabled={!isAdmin}
          title={isAdmin ? undefined : t("gina.meetingsAdminOnly")}
          onClick={() => onOpenMeeting?.()}
        >
          {t("gina.meetingsTitle")}
        </button>
      </div>
      {!isAdmin ? (
        <p className="lp-assistance-section__note dim">{t("gina.meetingsAdminOnly")}</p>
      ) : null}
    </div>
  );
}

export default AssistanceListCard;
