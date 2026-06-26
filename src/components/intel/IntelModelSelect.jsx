import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { usePlanStore } from "../../stores/planStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import {
  DEFAULT_INTEL_MODEL_ID,
  getDefaultIntelModel,
  getIntelModel,
  getIntelModelCatalog,
  resolveIntelModelForPlan,
} from "../../lib/intelModels.js";

const STORAGE_KEY = "futura-intel-model-id";

/**
 * @param {"free"|"pro"} plan
 */
function readStoredModelId(plan) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const resolved = resolveIntelModelForPlan(raw, plan);
      if (resolved.id === raw) return raw;
    }
  } catch {
    /* ignore */
  }
  return getDefaultIntelModel(plan).id;
}

/**
 * @param {{ disabled?: boolean, className?: string }} props
 */
export function IntelModelSelect({ disabled = false, className = "" }) {
  const { t } = useI18n();
  const plan = usePlanStore((s) => s.profile.plan);
  const modelId = useUIStateStore((s) => s.intelSelectedModelId);
  const setIntelSelectedModelId = useUIStateStore((s) => s.setIntelSelectedModelId);
  const [open, setOpen] = useState(false);
  const options = getIntelModelCatalog(plan);
  const rootRef = useRef(null);

  useEffect(() => {
    setIntelSelectedModelId(readStoredModelId(plan));
  }, [plan, setIntelSelectedModelId]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectableOptions = options.filter((option) => option.selectable);
  const active = getIntelModel(modelId);
  const safeValue = selectableOptions.some((option) => option.id === active.id)
    ? active.id
    : selectableOptions[0]?.id;
  const selectedModel = getIntelModel(safeValue || DEFAULT_INTEL_MODEL_ID);

  useEffect(() => {
    if (!safeValue || safeValue === modelId) return;
    setIntelSelectedModelId(safeValue);
    try {
      localStorage.setItem(STORAGE_KEY, safeValue);
    } catch {
      /* ignore */
    }
  }, [safeValue, modelId, setIntelSelectedModelId]);

  const formatCreditCost = (count) => (
    count === 1
      ? t("intel.modelCreditCost", { count: 1 })
      : t("intel.modelCreditCostPlural", { count })
  );

  const pickModel = (nextId) => {
    const option = options.find((row) => row.id === nextId);
    if (!option?.selectable) return;
    setIntelSelectedModelId(nextId);
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, nextId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      ref={rootRef}
      className={`intel-meta-kv intel-bottom-item intel-model-select${className ? ` ${className}` : ""}`}
    >
      <span>{t("intel.model")}:</span>
      <div className="intel-model-select__control">
        <button
          type="button"
          className="intel-model-select__trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={t("intel.modelSelectAria")}
          onClick={() => setOpen((value) => !value)}
        >
          {selectedModel.label}
        </button>
        {open ? (
          <ul className="intel-model-select__menu" role="listbox" aria-label={t("intel.modelSelectAria")}>
            {options.map((option) => (
              <li key={option.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.id === safeValue}
                  aria-disabled={option.selectable ? undefined : true}
                  disabled={!option.selectable}
                  title={option.selectable ? undefined : t("intel.modelProOnly")}
                  className={
                    "intel-model-select__option"
                    + (option.id === safeValue ? " intel-model-select__option--active" : "")
                    + (option.selectable ? "" : " intel-model-select__option--locked")
                  }
                  onClick={() => pickModel(option.id)}
                >
                  <span className="intel-model-select__option-name">{option.label}</span>
                  <span className="intel-model-select__option-credit">{formatCreditCost(option.creditCost)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
