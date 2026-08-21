import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  applyStepCodeTemplateToBlocks,
  createStepEntry,
  createStepEntryFromTemplate,
  finalizeStepSequence,
  getStepCodeTemplateShells,
  propagateStepCodeTemplate,
  stepUsesRecipeLayout,
} from "../../../lib/docBlocks.js";
import { useI18n } from "../../../i18n/useI18n.js";
import { StepRecipeCard } from "./StepRecipeCard.jsx";
import { StepStepBlocksEditor } from "./StepStepBlocksEditor.jsx";

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
  const { t } = useI18n();
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
        {t("doc.stepRecipe.blockLabel")}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        className="doc-step-sequence__title-input"
        value={title}
        placeholder={t("doc.stepRecipe.titlePlaceholder")}
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
  const { t } = useI18n();
  return (
    <div className="doc-step-sequence__header">
      <div className="doc-step-sequence__heading">
        <span className="doc-step-sequence__label">{t("doc.stepRecipe.blockLabel")}</span>
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
                aria-label={t("doc.stepRecipe.edit")}
              >
                {t("doc.stepRecipe.edit")}
              </button>
            ) : null}
            {onDeleteBlock ? (
              <button
                type="button"
                className="doc-step-sequence__delete"
                onClick={onDeleteBlock}
                aria-label={t("doc.stepRecipe.delete")}
              >
                {t("doc.stepRecipe.delete")}
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
  title = "",
  steps,
  compact,
  onStepsChange,
  onDeleteBlock,
  onEditRequest,
}) {
  const { t } = useI18n();
  const total = steps.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(0, total - 1));
  const step = steps[safeIndex];
  const stepNumber = safeIndex + 1;

  useEffect(() => {
    if (activeIndex >= total) {
      setActiveIndex(Math.max(0, total - 1));
    }
  }, [activeIndex, total]);

  const updateStepBlocks = useCallback((blocks) => {
    const next = steps.map((entry, index) => (
      index === safeIndex ? { ...entry, blocks } : entry
    ));
    onStepsChange?.(next);
  }, [onStepsChange, safeIndex, steps]);

  return (
    <div
      className={`doc-step-sequence doc-step-sequence--saved${compact ? " doc-step-sequence--compact" : ""}`}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <StepSequenceHeader
        blockId={blockId}
        title=""
        onTitleChange={undefined}
        compact={compact}
        counter={t("doc.stepRecipe.stepOf", { n: stepNumber, total })}
        onEditRequest={onEditRequest}
        onDeleteBlock={onDeleteBlock}
        displayTitle={title}
      />

      <div className="doc-step-sequence__card">
        <AnimatePresence mode="wait">
          <motion.div
            key={step?.id ?? safeIndex}
            className="doc-step-sequence__panel doc-step-sequence__panel--blocks"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28 }}
          >
            {stepUsesRecipeLayout(step) ? (
              <StepRecipeCard
                step={step}
                readOnly
                compact={compact}
              />
            ) : (
              <>
                <span className="doc-step-sequence__step-badge">
                  {t("doc.stepRecipe.stepOf", { n: stepNumber, total })}
                </span>
                <StepStepBlocksEditor
                  blocks={step?.blocks}
                  onBlocksChange={updateStepBlocks}
                  readOnly
                  compact={compact}
                  stepId={step?.id}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="doc-step-sequence__nav">
          <button
            type="button"
            className="doc-step-sequence__nav-btn doc-step-sequence__nav-btn--back"
            onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
            disabled={safeIndex <= 0}
          >
            {t("common.back")}
          </button>
          <div className="doc-step-sequence__nav-actions">
            <button
              type="button"
              className="doc-step-sequence__nav-btn doc-step-sequence__nav-btn--next"
              onClick={() => setActiveIndex((prev) => Math.min(total - 1, prev + 1))}
              disabled={safeIndex >= total - 1}
            >
              {t("doc.stepRecipe.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step by step — wizard while drafting; one step at a time after Save.
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
  initialActiveIndex = 0,
}) {
  const { t } = useI18n();
  const safeSteps = steps.length ? steps : [createStepEntry()];
  const total = safeSteps.length;
  const [activeIndex, setActiveIndex] = useState(() => {
    const raw = Number(initialActiveIndex);
    const idx = Number.isFinite(raw) ? Math.floor(raw) : 0;
    return Math.max(0, Math.min(idx, Math.max(0, total - 1)));
  });

  const stepNumber = Math.min(activeIndex, total - 1) + 1;
  const activeStep = safeSteps[Math.min(activeIndex, total - 1)] ?? safeSteps[0];
  const isLastStep = activeIndex >= total - 1;

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

  const updateActiveStepPatch = useCallback((patch) => {
    const index = Math.min(activeIndex, safeSteps.length - 1);
    onStepsChange?.(safeSteps.map((step, i) => (
      i === index ? createStepEntry({ ...step, ...patch }) : step
    )));
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

  if (saved) {
    return (
      <SavedStepSequenceView
        blockId={blockId}
        title={title}
        steps={safeSteps}
        compact={compact}
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
        counter={t("doc.stepRecipe.stepOf", { n: stepNumber, total })}
        onDeleteBlock={onDeleteBlock}
      />

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
            {stepUsesRecipeLayout(activeStep) ? (
              <StepRecipeCard
                step={activeStep}
                onChange={updateActiveStepPatch}
                compact={compact}
                allowSecondImage
              />
            ) : (
              <>
                <span className="doc-step-sequence__step-badge">
                  {t("doc.stepRecipe.stepOf", { n: stepNumber, total })}
                </span>
                <span className="doc-step-sequence__field-label">{t("doc.stepRecipe.instructions")}</span>
                <StepStepBlocksEditor
                  blocks={activeStep?.blocks}
                  onBlocksChange={updateActiveStepBlocks}
                  compact={compact}
                  autoFocus={autoFocus}
                  stepId={activeStep?.id}
                  onOuterKeyDown={handleWizardKeyDown}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="doc-step-sequence__nav">
          <button
            type="button"
            className="doc-step-sequence__nav-btn doc-step-sequence__nav-btn--back"
            onClick={goBack}
            disabled={activeIndex <= 0}
          >
            {t("common.back")}
          </button>
          <div className="doc-step-sequence__nav-actions">
            <button
              type="button"
              className="doc-step-sequence__nav-btn doc-step-sequence__nav-btn--save"
              onClick={handleSave}
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              className="doc-step-sequence__nav-btn doc-step-sequence__nav-btn--next"
              onClick={goNext}
            >
              {t("doc.stepRecipe.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
