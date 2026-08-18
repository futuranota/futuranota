import { useId, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";

/** Script label + info icon (#i / #o usage). */
export function LibraryAssetPromptLabel() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <div className="library-asset-prompt-label">
      <span className="folder-library-element-modal__label library-asset-prompt-label__text">
        {t("doc.library.assetDescriptionLabel")}
      </span>
      <span className="library-asset-prompt-label__info-wrap">
        <button
          type="button"
          className="library-asset-prompt-label__info"
          aria-label={t("doc.library.assetPromptInfoAria")}
          aria-expanded={open}
          aria-describedby={open ? tipId : undefined}
          onClick={() => setOpen((value) => !value)}
          onBlur={(event) => {
            if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
              setOpen(false);
            }
          }}
        >
          <img
            src="/uploads/Info%201.svg"
            alt=""
            aria-hidden
            draggable={false}
          />
        </button>
        <span
          id={tipId}
          role="tooltip"
          className={"library-asset-prompt-label__tip" + (open ? " is-open" : "")}
        >
          {t("doc.library.assetPromptInfo")}
        </span>
      </span>
    </div>
  );
}
