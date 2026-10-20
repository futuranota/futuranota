import { useMemo } from "react";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

function stepState(index, activeStep, completed) {
  const step = index + 1;
  if (completed || step < activeStep) return "completed";
  if (step === activeStep) return "active";
  return "inactive";
}

/**
 * Vertical instruction stepper. JSX + CSS port of the saved paste.
 * @param {{
 *   sections: { title?: string, body?: string }[],
 *   activeStep?: number,
 *   onActiveStep?: (step: number) => void,
 *   readOnly?: boolean,
 *   onTitleChange?: (index: number, title: string) => void,
 *   onAdd?: () => void,
 *   renderBody?: (section: { title?: string, body?: string }, index: number) => import('react').ReactNode,
 * }} props
 */
export default function PromptInstructionStepper({
  sections,
  activeStep = 1,
  onActiveStep,
  readOnly = false,
  onTitleChange,
  onAdd,
  renderBody,
}) {
  const items = useMemo(
    () => (sections?.length ? sections : [{ title: "Step 1", body: "" }]),
    [sections],
  );

  return (
    <div className="prompt-stepper" data-orientation="vertical">
      <nav className="prompt-stepper__nav" data-orientation="vertical" aria-label="Instruction steps">
        {items.map((section, index) => {
          const step = index + 1;
          const state = stepState(index, activeStep, false);
          const selected = activeStep === step;
          return (
            <div
              key={`instruction-step-${index}`}
              className="prompt-stepper__item"
              data-state={state}
            >
              <button
                type="button"
                className="prompt-stepper__trigger"
                role="tab"
                id={`prompt-stepper-tab-${step}`}
                aria-selected={selected}
                aria-controls={`prompt-stepper-panel-${step}`}
                data-state={state}
                onClick={() => onActiveStep?.(step)}
              >
                <span className="prompt-stepper__indicator" data-state={state}>
                  {state === "completed" ? <CheckIcon /> : step}
                </span>
                <span className="prompt-stepper__copy">
                  {readOnly || !onTitleChange ? (
                    <span className="prompt-stepper__title">{section.title || `Step ${step}`}</span>
                  ) : (
                    <input
                      className="prompt-stepper__title-input"
                      value={section.title || `Step ${step}`}
                      aria-label={`Step ${step} title`}
                      onChange={(event) => onTitleChange(index, event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  )}
                </span>
              </button>
              {index < items.length - 1 ? (
                <span className="prompt-stepper__separator" data-state={state} aria-hidden="true" />
              ) : null}
              <div
                className="prompt-stepper__panel"
                id={`prompt-stepper-panel-${step}`}
                role="tabpanel"
                hidden={!selected}
                data-state={activeStep}
              >
                {selected ? renderBody?.(section, index) : null}
              </div>
            </div>
          );
        })}
      </nav>
      {!readOnly && onAdd ? (
        <button type="button" className="prompt-stepper__add" onClick={onAdd}>
          Add step
        </button>
      ) : null}
    </div>
  );
}
