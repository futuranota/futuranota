import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  applyStepCodeTemplateToBlocks,
  createStepEntry,
  createStepEntryFromTemplate,
  finalizeStepSequence,
  getStepCodeTemplateShells,
  propagateStepCodeTemplate,
} from "../../../lib/docBlocks.js";
import { StepStepBlocksEditor } from "./StepStepBlocksEditor.jsx";

const BLOCK_LABEL = "Step by step";

const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

function StepTitleField({
  title,
  onTitleChange,
  compact,
  autoFocusTitle = false,
  blockId = "default",
  inHeader = false,
}) {
  const inputRef = useRef(null);
  const inputId = `step-seq-title-${blockId}`;

  useEffect(() => {
    if (!autoFocusTitle) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [autoFocusTitle]);

  const stopBubble = (e) => {
    e.stopPropagation();
  };

  return (
    <div className={[
      "doc-step-sequence__title-wrap",
      compact ? "doc-step-sequence__title-wrap--compact" : "",
      inHeader ? "doc-step-sequence__title-wrap--header" : "",
    ].filter(Boolean).join(" ")}>
      <label className="doc-step-sequence__title-label" htmlFor={inputId}>
        Title
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        className="doc-step-sequence__title-input"
        value={title}
        placeholder="Untitled guide"
        spellCheck
        onChange={(e) => onTitleChange?.(e.target.value)}
        onKeyDown={stopBubble}
        onKeyUp={stopBubble}
        onMouseDown={stopBubble}
      />
    </div>
  );
}

function StepSequenceHeader({
  blockId,
  title,
  onTitleChange,
  compact,
  autoFocusTitle,
  counter,
  onDeleteBlock,
  onEditRequest,
  displayTitle = "",
}) {
  return (
    <div className="doc-step-sequence__header">
      <div className="doc-step-sequence__heading">
        <span className="doc-step-sequence__label">{BLOCK_LABEL}</span>
        {onTitleChange ? (
          <StepTitleField
            title={title}
            onTitleChange={onTitleChange}
            compact={compact}
            autoFocusTitle={autoFocusTitle}
            blockId={blockId}
            inHeader
          />
        ) : displayTitle ? (
          <span className="doc-step-sequence__header-title">{displayTitle}</span>
        ) : null}
      </div>
      <div className="doc-step-sequence__header-aside">
        {counter ? (
          <span className="doc-step-sequence__counter mono-sm">{counter}</span>
        ) : null}
        {onEditRequest || onDeleteBlock ? (
          <div className="doc-step-sequence__hover-actions">
            {onEditRequest ? (
              <button
                type="button"
                className="doc-step-sequence__edit"
                onClick={onEditRequest}
                aria-label={`Editar bloque ${BLOCK_LABEL}`}
              >
                Editar
              </button>
            ) : null}
            {onDeleteBlock ? (
              <button
                type="button"
                className="doc-step-sequence__delete"
                onClick={onDeleteBlock}
                aria-label={`Eliminar bloque ${BLOCK_LABEL}`}
              >
                Eliminar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SavedStepSequenceView({
  blockId,
  title,
  steps,
  compact,
  onTitleChange,
  onStepsChange,
  onDeleteBlock,
  onEditRequest,
}) {
  const displayTitle = (title || "").trim();

  const updateStepBlocks = useCallback((stepIndex, blocks) => {
    const next = steps.map((step, index) => (
      index === stepIndex ? { ...step, blocks } : step
    ));
    onStepsChange?.(next);
  }, [onStepsChange, steps]);

  return (
    <div
      className={`doc-step-sequence doc-step-sequence--saved${compact ? " doc-step-sequence--compact" : ""}`}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <StepSequenceHeader
        blockId={blockId}
        title={title}
        onTitleChange={onTitleChange}
        compact={compact}
        counter={`${steps.length} ${steps.length === 1 ? "step" : "steps"}`}
        onEditRequest={onEditRequest}
        onDeleteBlock={onDeleteBlock}
        displayTitle={!onTitleChange ? displayTitle : ""}
      />

      <div className="doc-step-sequence__card doc-step-sequence__card--saved">
        <div className="doc-step-sequence__saved-list scroll-match-bg">
          {steps.map((step, index) => (
            <article key={step.id} className="doc-step-sequence__saved-step">
              <span className="doc-step-sequence__step-badge">
                Step {index + 1}
              </span>
              <StepStepBlocksEditor
                blocks={step.blocks}
                onBlocksChange={(blocks) => updateStepBlocks(index, blocks)}
                readOnly
                compact={compact}
                stepId={step.id}
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Step by step — wizard while drafting; full stacked view after Save.
 */
export function StepSequenceBlockView({
  blockId = "default",
  title = "",
  steps = [],
  saved = false,
  onTitleChange,
  onStepsChange,
  onSavedChange,
  onEditRequest,
  onDeleteBlock,
  compact = false,
  autoFocus = false,
}) {
  const safeSteps = steps.length ? steps : [createStepEntry()];
  const total = safeSteps.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(0);

  const stepNumber = Math.min(activeIndex, total - 1) + 1;
  const activeStep = safeSteps[Math.min(activeIndex, total - 1)] ?? safeSteps[0];
  const isLastStep = activeIndex >= total - 1;

  useEffect(() => {
    setMaxVisitedIndex((prev) => Math.max(prev, activeIndex));
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex >= total) {
      setActiveIndex(Math.max(0, total - 1));
    }
  }, [activeIndex, total]);

  const updateActiveStepBlocks = useCallback((blocks) => {
    const index = Math.min(activeIndex, safeSteps.length - 1);
    let next = safeSteps.map((step, i) => (
      i === index ? { ...step, blocks } : step
    ));
    if (index === 0) {
      next = propagateStepCodeTemplate(next);
    }
    onStepsChange?.(next);
  }, [activeIndex, onStepsChange, safeSteps]);

  const applyTemplateToStep = useCallback((steps, targetIndex) => {
    const shells = getStepCodeTemplateShells(steps[0]);
    if (!shells.length || targetIndex <= 0 || targetIndex >= steps.length) {
      return steps;
    }
    return steps.map((step, i) => (
      i === targetIndex
        ? { ...step, blocks: applyStepCodeTemplateToBlocks(step.blocks, shells) }
        : step
    ));
  }, []);

  const goBack = useCallback(() => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goNext = useCallback(() => {
    const index = Math.min(activeIndex, safeSteps.length - 1);
    const shells = getStepCodeTemplateShells(safeSteps[0]);

    if (index >= safeSteps.length - 1) {
      const newStep = createStepEntryFromTemplate(shells);
      onStepsChange?.([...safeSteps, newStep]);
      setActiveIndex(safeSteps.length);
      return;
    }

    const targetIndex = index + 1;
    onStepsChange?.(applyTemplateToStep(safeSteps, targetIndex));
    setActiveIndex(targetIndex);
  }, [activeIndex, applyTemplateToStep, onStepsChange, safeSteps]);

  const handleSave = useCallback(() => {
    onSavedChange?.(finalizeStepSequence(safeSteps));
  }, [onSavedChange, safeSteps]);

  const handleWizardKeyDown = useCallback((e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!isLastStep) {
        goNext();
      } else {
        handleSave();
      }
    }
  }, [goNext, handleSave, isLastStep]);

  const goToStep = useCallback((index) => {
    if (index < 0 || index >= total) return;
    if (index > 0) {
      onStepsChange?.(applyTemplateToStep(safeSteps, index));
    }
    setActiveIndex(index);
  }, [applyTemplateToStep, onStepsChange, safeSteps, total]);

  if (saved) {
    return (
      <SavedStepSequenceView
        blockId={blockId}
        title={title}
        steps={safeSteps}
        compact={compact}
        onTitleChange={onTitleChange}
        onStepsChange={onStepsChange}
        onEditRequest={onEditRequest}
        onDeleteBlock={onDeleteBlock}
      />
    );
  }

  return (
    <div
      className={`doc-step-sequence${compact ? " doc-step-sequence--compact" : ""}`}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <StepSequenceHeader
        blockId={blockId}
        title={title}
        onTitleChange={onTitleChange}
        compact={compact}
        autoFocusTitle={autoFocus && !(title || "").trim()}
        counter={`Step ${stepNumber} of ${total}`}
        onDeleteBlock={onDeleteBlock}
      />

      <div className="doc-step-sequence__progress" aria-label="Steps">
        {safeSteps.map((step, index) => {
          const isActive = index === activeIndex;
          const isVisited = index <= maxVisitedIndex;
          return (
            <span
              key={step.id}
              role="button"
              tabIndex={0}
              aria-label={`Step ${index + 1}`}
              aria-current={isActive ? "step" : undefined}
              className={[
                "doc-step-sequence__progress-pill",
                isActive ? "doc-step-sequence__progress-pill--active" : "",
                isVisited ? "doc-step-sequence__progress-pill--visited" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => goToStep(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  goToStep(index);
                }
              }}
            >
              {index + 1}
            </span>
          );
        })}
      </div>

      <div className="doc-step-sequence__card">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep?.id ?? activeIndex}
            className="doc-step-sequence__panel doc-step-sequence__panel--blocks"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28 }}
          >
            <span className="doc-step-sequence__step-badge">
              Step {stepNumber}
            </span>
            <span className="doc-step-sequence__field-label">Instructions</span>
            <StepStepBlocksEditor
              blocks={activeStep?.blocks}
              onBlocksChange={updateActiveStepBlocks}
              compact={compact}
              autoFocus={autoFocus}
              stepId={activeStep?.id}
              onOuterKeyDown={handleWizardKeyDown}
            />
          </motion.div>
        </AnimatePresence>

        <div className="doc-step-sequence__nav">
          <button
            type="button"
            className="doc-step-sequence__nav-btn doc-step-sequence__nav-btn--back"
            onClick={goBack}
            disabled={activeIndex <= 0}
          >
            Back
          </button>
          <div className="doc-step-sequence__nav-actions">
            <button
              type="button"
              className="doc-step-sequence__nav-btn doc-step-sequence__nav-btn--save"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              type="button"
              className="doc-step-sequence__nav-btn doc-step-sequence__nav-btn--next"
              onClick={goNext}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
