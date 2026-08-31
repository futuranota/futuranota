/**
 * Gina chat card — Call Asistente shell inside an open document.
 * Dictation: listen → insert into composer (edit STT) → Send.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useWebSpeech } from "../../hooks/useWebSpeech.js";
import { absorbDictationFinal } from "../../lib/ginaSpeechCommands.js";
import { normalizeDictationTranscript } from "../../lib/ginaSpeechVocab.js";
import { GinaAiMessageText } from "./GinaAnimatedText.jsx";
import { GinaStartDocReveal } from "./GinaStartDocReveal.jsx";
import { GinaDataVisualization } from "./GinaDataVisualization.jsx";
import { GinaThinkingStatus } from "./GinaThinkingStatus.jsx";
import { buildGinaOpeningChips, chipsAreHomeOpening } from "../../lib/gina/ginaReplyChips.js";
import {
  buildGinaDocActionsMenu,
  buildGinaExportAppliedAck,
  buildGinaExportDestPromptMessage,
  buildGinaExportFollowUpChips,
  buildGinaExportFormatChips,
  buildGinaExportLearnMoreMessage,
  buildGinaExportPromptMessage,
  buildGinaOrganizeAppliedAck,
  buildGinaOrganizePromptMessage,
  buildGinaOrganizeStyleChips,
  buildGinaPdfToTextMessage,
  buildGinaPdfUploadChip,
  buildGinaPdfWaitMessage,
  buildGinaPdfDoneMessage,
} from "../../lib/gina/ginaDocActionChips.js";
import { buildGinaDocumentSyncOpening } from "../../lib/gina/ginaOpenings.js";
import { getGinaTestQuickLinks } from "../../lib/gina/ginaTestQuickLinks.js";
import { GINA_RESET_DAY_RITUAL_PROTOCOL } from "../../lib/gina/ginaDayRitualReset.js";
import { buildTalkRequestNotifyChips, isEnableTalkNotificationsIntent } from "../../lib/gina/ginaTalkRequest.js";
import { hasDaySheet } from "../../lib/gina/ginaDaySheetStore.js";
import {
  applyDaySheetCompletionBatch,
  buildDaySheetBatchCompleteAck,
  buildDaySheetBatchCompleteChips,
  buildDaySheetPendingActionChips,
  buildInDocDaySheetIdleChips,
  clearPendingDaySheetSelection,
  flattenDaySheetDocs,
  isDocCompleted,
  pickNextDaySheetDoc,
  togglePendingDaySheetSelection,
} from "../../lib/gina/ginaDaySheet.js";
import { DOC_WORK_STATUS, syncDocWorkStatusFields } from "../../lib/docWorkStatus.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useNodesStore } from "../../stores/index.js";
import { resolveListRefineSelection } from "../../lib/gina/ginaSyntaxDocsByCategory.js";
import { playGinaEnableSound } from "../../lib/ginaEnableSound.js";
import { playGinaDoubleBipSound } from "../../lib/ginaDoubleBipSound.js";
import { playGinaHighlightsSound } from "../../lib/ginaHighlightsSound.js";
import { playGinaLeaveScheduleSound } from "../../lib/ginaLeaveScheduleSound.js";
import { playGinaWhatsNextSound } from "../../lib/ginaWhatsNextSound.js";
import {
  playGinaFilesMovementSound,
  stopGinaFilesMovementSound,
} from "../../lib/ginaFilesMovementSound.js";
import { stopGinaTypingSound } from "../../lib/ginaTypingSound.js";

/** Silence after open, before greeting / chips (Enable.wav moved to sheet reveal). */
const GINA_OPEN_SOUND_DELAY_MS = 2_000;
/** Extra beat after open delay before greeting typewriter. */
const GINA_POST_SOUND_TEXT_DELAY_MS = 1_000;
/** After the schedule table is ready, wait before showing notify gate chips. */
const GINA_NOTIFY_GATE_DELAY_MS = 5_000;
/** After todayOverview infographic, wait before sheet intro (textMid). */
const GINA_SHEET_INTRO_DELAY_MS = 10_000;

/** @typedef {{ id?: string, sender: "ai" | "user", text: string, textMid?: string | null, textAfter?: string | null, textAfterRest?: string | null, startDocLines?: { label: string, value: string }[] | null, startDocRevealed?: boolean, textPitch?: string | null, deferVisualization?: boolean, vizRevealed?: boolean, recoveryCopyFirst?: boolean, midReady?: boolean, midRevealed?: boolean, sheetTableRevealed?: boolean, afterRevealed?: boolean, pitchRevealed?: boolean, savedAckRevealed?: boolean, notifyGateRevealed?: boolean, voiceSequence?: string | null, leaveAckDone?: boolean, queued?: boolean, visualization?: { type: string, data: object } | null, learnProposal?: { title: string, body: string } | null, chips?: { id?: string, label: string, text?: string, primary?: boolean, kind?: string, group?: string, selectable?: boolean, value?: string }[] | null, chipsRestorable?: { id?: string, label: string, text?: string, primary?: boolean, kind?: string, group?: string, selectable?: boolean, value?: string }[] | null, refineRevealed?: boolean }} GinaChatMessage */

function messageHasNotifyGate(message) {
  return Array.isArray(message?.chips)
    && message.chips.some((c) => c?.id === "recovery_notify");
}

function messageHasLeaveScheduleVoice(message) {
  return message?.voiceSequence === "leave_schedule";
}

function chipsAreTalkNotifyOffer(chips) {
  return Array.isArray(chips)
    && chips.some((c) => c?.id === "enable_day_notifications");
}

function talkNotifyOfferVisible(message) {
  if (!chipsAreTalkNotifyOffer(message?.chips)) return false;
  if (message.deferVisualization) {
    if (!message.vizRevealed) return false;
    if (message.midRevealed === false) return false;
    if (message.sheetTableRevealed === false) return false;
  }
  return true;
}

function messageChipsReadyToShow(message, { isTyping, isAiAnimating }) {
  if (!message || message.sender !== "ai") return false;
  if (!Array.isArray(message.chips) || !message.chips.length) return false;
  if (isTyping) return false;
  if (isAiAnimating && !talkNotifyOfferVisible(message)) return false;
  if (message.visualization?.type === "day_sheet_saved" && !message.savedAckRevealed) return false;
  if (messageHasLeaveScheduleVoice(message) && message.textAfter && !message.afterRevealed) return false;
  if (message.deferVisualization) {
    if (!message.vizRevealed) return false;
    if (chipsAreTalkNotifyOffer(message.chips)) {
      if (message.midRevealed === false) return false;
      if (message.sheetTableRevealed === false) return false;
      return true;
    }
    if (message.textMid && message.midReady === false) return false;
    if (message.midRevealed === false) return false;
    if (message.sheetTableRevealed === false) return false;
    if (Array.isArray(message.startDocLines) && message.startDocLines.length
      && message.startDocRevealed === false) return false;
    if (message.textAfterLead && message.leadRevealed === false) return false;
    if ((message.textAfter || message.textAfterRest) && !message.afterRevealed) return false;
    if (message.textPitch && !message.pitchRevealed) return false;
  }
  return true;
}

function isScheduleSheetVisualization(visualization) {
  return visualization?.type === "schedule_sheet"
    || visualization?.type === "today_quick_sheet";
}

/** Instant-reveal all deferred / typewriter stages for the current AI turn. */
function revealAiTurnFully(message) {
  if (!message || message.sender !== "ai") return message;
  return {
    ...message,
    refineRevealed: true,
    midReady: true,
    midRevealed: true,
    vizRevealed: true,
    sheetTableRevealed: true,
    leadRevealed: true,
    startDocRevealed: true,
    afterRevealed: true,
    pitchRevealed: true,
    savedAckRevealed: true,
    notifyGateRevealed: true,
    leaveAckDone: true,
  };
}

/** Build AI turn fields: datos → pie+folder bars → intro → horario cronológico → post text → chips. */
function buildAiTurnRevealState({
  aiText,
  textMid,
  textAfter,
  textAfterLead,
  textAfterRest,
  startDocLines,
  textPitch,
  visualization,
  voiceSequence = null,
}) {
  const mid = textMid != null ? String(textMid).trim() : "";
  const after = textAfter != null ? String(textAfter).trim() : "";
  const afterLead = textAfterLead != null ? String(textAfterLead).trim() : "";
  const afterRest = textAfterRest != null ? String(textAfterRest).trim() : "";
  const pitch = textPitch != null ? String(textPitch).trim() : "";
  const startLines = Array.isArray(startDocLines)
    ? startDocLines.filter((r) => r && String(r.label || "").trim())
    : [];
  const isTodayOverview = Boolean(visualization?.data?.todayOverview);
  const isDayReadySheet = Boolean(visualization?.data?.offerDayReady);
  const isDaySheetSaved = visualization?.type === "day_sheet_saved";
  const isTalkNotify = Boolean(visualization?.data?.talkRequestNotify);
  const leaveSchedule = voiceSequence === "leave_schedule" && Boolean(after);
  const hasAfterBlock = Boolean(after || afterRest || afterLead || startLines.length);
  const hasLeadText = Boolean(aiText && String(aiText).trim());
  const deferVisualization = Boolean(
    !isDaySheetSaved
    && (
      isTodayOverview
      || isDayReadySheet
      || visualization?.data?.recoveryWizard
      || isTalkNotify
    )
    && (hasLeadText || mid || hasAfterBlock || pitch),
  );
  const vizData = visualization?.data;
  const viz = visualization && vizData
    ? { ...visualization, data: vizData }
    : visualization;
  const hasChrono = Boolean(
    isTodayOverview
    && (
      vizData?.quickSheet
      || (Array.isArray(vizData?.documents) && vizData.documents.length > 0)
      || (Array.isArray(vizData?.groups) && vizData.groups.length > 0)
    ),
  );
  return {
    text: aiText || (visualization ? "" : " "),
    textMid: mid || null,
    textAfter: after || null,
    textAfterLead: afterLead || null,
    textAfterRest: afterRest || null,
    startDocLines: startLines.length ? startLines : null,
    textPitch: pitch || null,
    deferVisualization,
    // Empty pre-sheet message: reveal viz immediately (no typewriter onComplete to unlock it).
    // Talk-notify always waits for intro text before the day sheet.
    vizRevealed: isTalkNotify
      ? false
      : (!deferVisualization || !hasLeadText),
    // Today overview: pause after infographic before sheet intro (textMid).
    midReady: !mid || !isTodayOverview,
    midRevealed: !mid,
    // Talk-notify: highlights/todos/condition unlock immediately after intro (sheet waits).
    sheetTableRevealed: isTalkNotify ? true : (!mid || !hasChrono),
    leadRevealed: !afterLead,
    startDocRevealed: !startLines.length,
    afterRevealed: !hasAfterBlock,
    pitchRevealed: !pitch,
    // Checkmark ack first; typed copy waits for savedAckRevealed.
    savedAckRevealed: !isDaySheetSaved,
    voiceSequence: leaveSchedule ? "leave_schedule" : (voiceSequence || null),
    // Gate “qué sigue” until Listo typewriter (+ clip) finishes.
    leaveAckDone: !leaveSchedule,
    visualization: viz || null,
  };
}


/** Horario cronológico under the intro; fires onReady after first paint. */
function GinaTodayChronoSheet({ data, locale, onReady }) {
  const firedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    if (!onReadyRef.current || firedRef.current) return undefined;
    let timeoutId = 0;
    const raf1 = requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        if (firedRef.current) return;
        firedRef.current = true;
        onReadyRef.current?.();
      }, 120);
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);
  return (
    <GinaDataVisualization
      type="today_quick_sheet"
      data={{
        quickSheet: data?.quickSheet || null,
        documents: data?.documents || [],
        groups: data?.groups || [],
        locale: data?.locale || locale,
        folderProgress: data?.folderProgress || null,
        folderBars: data?.folderBars || null,
        dayProgress: data?.dayProgress || null,
        highlightPassedSlots: Boolean(
          Array.isArray(data?.quickSheet?.urgency) && data.quickSheet.urgency.length,
        ),
      }}
    />
  );
}

function chipsAreListRefine(chips) {
  if (!Array.isArray(chips) || !chips.length) return false;
  // nav_back-only results use the plain chip row
  if (chips.every((c) => c?.kind === "nav_back")) return false;
  return chips.some((c) => c?.group === "list_refine" && c?.kind !== "nav_back");
}

/**
 * Home opening: intro copy → schedule chips → explore/week line → Ver todo / week.
 */
function GinaHomeOpeningChips({ chips, locale = "es", disabled, onSubmit }) {
  const list = Array.isArray(chips) ? chips : [];
  const intro = list.find((c) => c.id === "home_intro");
  const weekLine = list.find((c) => c.id === "home_week_line");
  const explore = list.find((c) => c.id === "home_explore");
  const afterPrompt = weekLine || explore;
  const allSchedules = list.filter((c) => c.kind === "home_schedule");
  const mainSchedules = weekLine
    ? allSchedules.filter((c) => c.id !== "review_week")
    : allSchedules;
  const weekSchedules = weekLine
    ? allSchedules.filter((c) => c.id === "review_week")
    : [];
  const seeAll = list.filter((c) => c.kind === "home_all");
  const testLinks = getGinaTestQuickLinks({ locale });

  const send = (chip) => {
    if (disabled || !chip?.text) return;
    onSubmit?.(chip.text, chip.label);
  };

  const renderChipButton = (chip) => (
    <button
      key={chip.id || chip.label}
      type="button"
      className={
        "gina-chat-card__chip"
        + (chip.primary ? " is-primary" : "")
        + (chip.hint ? " gina-chat-card__chip--with-hint" : "")
      }
      disabled={disabled}
      onClick={() => send(chip)}
    >
      <span className="gina-chat-card__chip-head">
        {chip.icon ? (
          <img className="gina-chat-card__chip-icon" src={chip.icon} alt="" aria-hidden />
        ) : null}
        <span className="gina-chat-card__chip-label">{chip.label}</span>
      </span>
      {chip.hint ? (
        <span className="gina-chat-card__chip-hint">{chip.hint}</span>
      ) : null}
    </button>
  );

  return (
    <div className="gina-chat-card__home-opening" role="group" aria-label="Home options">
      {intro?.label ? (
        <p className="gina-chat-card__home-opening-body">{intro.label}</p>
      ) : null}
      {mainSchedules.length ? (
        <div className="gina-chat-card__chips" role="group">
          {mainSchedules.map((chip) => renderChipButton(chip))}
        </div>
      ) : null}
      {afterPrompt?.label ? (
        <p className="gina-chat-card__home-opening-body gina-chat-card__home-opening-body--after">
          {afterPrompt.label}
        </p>
      ) : null}
      {weekSchedules.length ? (
        <div className="gina-chat-card__chips" role="group">
          {weekSchedules.map((chip) => renderChipButton(chip))}
        </div>
      ) : null}
      {seeAll.length ? (
        <div className="gina-chat-card__chips" role="group">
          {seeAll.map((chip) => renderChipButton(chip))}
        </div>
      ) : null}
      {testLinks.length ? (
        <div className="gina-chat-card__chips gina-chat-card__chips--test" role="group" aria-label="Test">
          {testLinks.map((chip) => (
            <button
              key={chip.id || chip.label}
              type="button"
              className="gina-chat-card__chip gina-chat-card__chip--test"
              disabled={disabled}
              onClick={() => send(chip)}
            >
              <span className="gina-chat-card__chip-label">{chip.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Prefer chip label in the user bubble when the send text is an open/reveal protocol. */
function bubbleTextForProtocolSend(text, label) {
  const protocol = String(text || "").trim();
  if (!/^Gina(Open|Reveal)Document:/.test(protocol)) return null;
  const human = String(label || "").trim();
  return human || null;
}

/** Stash visible chips so the user can “Volver” to the option list. */
function stashMessageChips(message) {
  if (!message || !Array.isArray(message.chips) || !message.chips.length) return message;
  // Don't stash a lone back chip
  if (message.chips.every((c) => c?.kind === "nav_back")) return message;
  return {
    ...message,
    chips: null,
    chipsRestorable: message.chips,
    refineRevealed: true,
  };
}

/**
 * Ensure reply chips include “Volver” when a prior turn has restorable options.
 * @param {GinaChatMessage[] | null | undefined} messages
 * @param {object[] | null | undefined} chips
 * @param {string} [locale]
 */
function ensureNavBackChip(messages, chips, locale = "es", opts = {}) {
  if (opts.skipNavBack || (Array.isArray(chips) && chips.some((c) => c?.kind === "close_chat"))) {
    return Array.isArray(chips) && chips.length ? chips : null;
  }
  const canGoBack = Array.isArray(messages) && messages.some((m) => (
    m?.sender === "ai"
    && Array.isArray(m.chipsRestorable)
    && m.chipsRestorable.length > 0
    && !(Array.isArray(m.chips) && m.chips.length)
  ));
  if (!canGoBack) return Array.isArray(chips) && chips.length ? chips : null;
  const list = Array.isArray(chips) ? chips.filter((c) => c?.kind !== "nav_back") : [];
  const en = locale === "en";
  list.push({
    id: "nav_back",
    kind: "nav_back",
    label: en ? "Back" : "Volver",
  });
  return list;
}

/**
 * Multi-select refine palette under a full document list.
 * Sequence: rail explain → intent (bold) → schedule scopes → category hint + chips
 * → layer hint + chips.
 * @param {{ instant?: boolean }} props — skip typewriter (Volver = page already written)
 */
function GinaListRefineChips({ chips, locale = "es", disabled, instant = false, onSubmit, onDismiss }) {
  const [selectedCats, setSelectedCats] = useState(() => new Set());
  const [schedule, setSchedule] = useState(false);
  const [status, setStatus] = useState(false);
  const [omit, setOmit] = useState(false);
  const [closed, setClosed] = useState(false);
  const submitTimerRef = useRef(null);

  const prompts = Array.isArray(chips) ? chips.filter((c) => c.kind === "prompt") : [];
  const scheduleScopes = Array.isArray(chips)
    ? chips.filter((c) => c.kind === "schedule_scope")
    : [];
  const categories = Array.isArray(chips) ? chips.filter((c) => c.kind === "category") : [];
  const layers = Array.isArray(chips)
    ? chips.filter((c) => (
      c.kind === "layer_schedule" || c.kind === "layer_status" || c.kind === "omit"
    ))
    : [];
  const extras = Array.isArray(chips)
    ? chips.filter((c) => c.group !== "list_refine" || c.kind === "action")
    : [];

  /** Index of the prompt currently typing (0-based). Instant = all already shown. */
  const [promptIndex, setPromptIndex] = useState(() => (
    instant ? prompts.length : 0
  ));

  const intentPromptIdx = prompts.findIndex((p) => p.id === "hint_intent");
  const catPromptIdx = prompts.findIndex((p) => p.id === "hint_categories");
  const layerPromptIdx = prompts.findIndex((p) => p.id === "hint_layers");
  const scopesUnlocked = intentPromptIdx >= 0
    ? promptIndex > intentPromptIdx
    : (prompts.length === 0 || promptIndex > 0);
  const catsUnlocked = catPromptIdx >= 0 && promptIndex > catPromptIdx;
  const layersUnlocked = layerPromptIdx >= 0
    ? promptIndex > layerPromptIdx
    : catsUnlocked;
  const allPromptsDone = prompts.length === 0 || promptIndex >= prompts.length;
  const currentPromptLabel = prompts[promptIndex]?.label;

  useEffect(() => {
    if (instant) {
      setPromptIndex(prompts.length);
      return;
    }
    if (!prompts.length) return;
    if (promptIndex >= prompts.length) return;
    if (!currentPromptLabel) {
      setPromptIndex((i) => i + 1);
    }
  }, [instant, promptIndex, prompts.length, currentPromptLabel]);

  useEffect(() => () => {
    if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current);
  }, []);

  if (closed || !Array.isArray(chips) || !chips.length) return null;

  const commit = (resolved) => {
    setClosed(true);
    if (resolved.action === "dismiss") {
      onDismiss?.();
      return;
    }
    if (resolved.action === "send" && resolved.command) {
      onSubmit?.(resolved.command);
    }
  };

  const finish = (next) => {
    const resolved = resolveListRefineSelection({
      categories: [...(next.categories || selectedCats)],
      showSchedule: next.schedule ?? schedule,
      showStatus: next.status ?? status,
      omit: next.omit ?? omit,
      locale,
    });
    if (submitTimerRef.current) {
      window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
    if (resolved.action === "wait") return;
    if (resolved.action === "dismiss" || next.omit) {
      commit(resolved);
      return;
    }
    submitTimerRef.current = window.setTimeout(() => {
      submitTimerRef.current = null;
      commit(resolved);
    }, 700);
  };

  const toggleCategory = (name) => {
    if (disabled || !catsUnlocked) return;
    const next = new Set(selectedCats);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedCats(next);
    finish({
      categories: next,
      schedule,
      status,
      omit,
    });
  };

  const toggleSchedule = () => {
    if (disabled || !layersUnlocked) return;
    const nextSchedule = !schedule;
    const nextOmit = nextSchedule || status ? false : omit;
    setSchedule(nextSchedule);
    if (nextSchedule || status) setOmit(false);
    finish({
      categories: selectedCats,
      schedule: nextSchedule,
      status,
      omit: nextOmit,
    });
  };

  const toggleStatus = () => {
    if (disabled || !layersUnlocked) return;
    const nextStatus = !status;
    const nextOmit = schedule || nextStatus ? false : omit;
    setStatus(nextStatus);
    if (schedule || nextStatus) setOmit(false);
    finish({
      categories: selectedCats,
      schedule,
      status: nextStatus,
      omit: nextOmit,
    });
  };

  const toggleOmit = () => {
    if (disabled || !layersUnlocked) return;
    const nextOmit = !omit;
    setOmit(nextOmit);
    if (nextOmit) {
      setSchedule(false);
      setStatus(false);
    }
    finish({
      categories: selectedCats,
      schedule: nextOmit ? false : schedule,
      status: nextOmit ? false : status,
      omit: nextOmit,
    });
  };

  return (
    <div className="gina-chat-card__refine" role="group" aria-label="Refine list">
      {prompts.map((prompt, i) => {
        if (i > promptIndex) return null;
        const isTyping = !instant && i === promptIndex && !allPromptsDone;
        const intent = prompt.id === "hint_intent" || prompt.emphasis === "intent";
        const lineClass = "gina-chat-card__refine-line"
          + (intent ? " gina-chat-card__refine-line--intent" : "");
        const staticClass = "gina-chat-card__refine-static"
          + (intent ? " gina-chat-card__refine-intent" : "");
        return (
          <div key={prompt.id || `prompt-${i}`}>
            <div className={lineClass}>
              {isTyping ? (
                <GinaAiMessageText
                  text={prompt.label}
                  plainBody
                  onComplete={() => setPromptIndex((n) => Math.max(n, i + 1))}
                />
              ) : (
                <span className={staticClass}>{prompt.label}</span>
              )}
            </div>
            {prompt.id === "hint_intent" && scopesUnlocked && scheduleScopes.length ? (
              <div className="gina-chat-card__chips gina-chat-card__chips--refine">
                {scheduleScopes.map((chip) => (
                  <button
                    key={chip.id || chip.label}
                    type="button"
                    className="gina-chat-card__chip"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled || !chip.text) return;
                      setClosed(true);
                      onSubmit?.(chip.text, bubbleTextForProtocolSend(chip.text, chip.label));
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : null}
            {prompt.id === "hint_categories" && catsUnlocked && categories.length ? (
              <div className="gina-chat-card__chips gina-chat-card__chips--refine">
                {categories.map((chip) => {
                  const name = chip.value || chip.label;
                  const on = selectedCats.has(name);
                  return (
                    <button
                      key={chip.id || name}
                      type="button"
                      className={"gina-chat-card__chip" + (on ? " is-selected" : "")}
                      disabled={disabled}
                      aria-pressed={on}
                      onClick={() => toggleCategory(name)}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {prompt.id === "hint_layers" && layersUnlocked && layers.length ? (
              <div className="gina-chat-card__chips gina-chat-card__chips--refine">
                {layers.map((chip) => {
                  const on = chip.kind === "layer_schedule"
                    ? schedule
                    : (chip.kind === "layer_status" ? status : omit);
                  const onClick = chip.kind === "layer_schedule"
                    ? toggleSchedule
                    : (chip.kind === "layer_status" ? toggleStatus : toggleOmit);
                  return (
                    <button
                      key={chip.id || chip.label}
                      type="button"
                      className={"gina-chat-card__chip" + (on ? " is-selected" : "")}
                      disabled={disabled}
                      aria-pressed={on}
                      onClick={onClick}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
      {allPromptsDone && extras.length ? (
        <div className="gina-chat-card__chips">
          {extras.map((chip) => (
            <button
              key={chip.id || chip.label}
              type="button"
              className={"gina-chat-card__chip" + (chip.primary ? " is-primary" : "")}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                if (chip.text) {
                  onSubmit?.(chip.text, bubbleTextForProtocolSend(chip.text, chip.label));
                }
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SendIcon() {
  return (
    <svg className="gina-chat-card__send-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** First dictation step: park transcript in composer for edits. */
function InsertIcon() {
  return (
    <svg className="gina-chat-card__insert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="gina-chat-card__mic-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 19v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpeakerIcon({ on }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {on ? (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M23 9l-6 6M17 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** @param {{ active?: boolean }} props */
function DictationWaves({ active = false }) {
  return (
    <div
      className={`gina-chat-card__waves${active ? " is-active" : " is-idle"}`}
      aria-hidden="true"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} style={active ? { animationDelay: `${i * 0.08}s` } : undefined} />
      ))}
    </div>
  );
}

/**
 * @param {string} code
 * @param {Record<string, string>} labels
 */
function speechErrorMessage(code, labels) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return labels.micPermission || "Microphone permission denied. Allow mic access in the browser.";
    case "no-speech":
      return labels.micNoSpeech || "No speech detected. Tap the mic and try again.";
    case "audio-capture":
      return labels.micNoDevice || "No microphone found.";
    case "network":
      return labels.micNetwork || "Speech recognition needs a network connection.";
    case "unsupported":
      return labels.micUnsupported || "Voice input is not supported in this browser";
    case "start-failed":
      return labels.micStartFailed || "Could not start the microphone. Try again.";
    default:
      return labels.micError || "Voice input failed. Try again.";
  }
}

function joinTranscript(finalParts, interim) {
  const base = finalParts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const live = String(interim || "").trim();
  if (!base) return live;
  if (!live) return base;
  return `${base} ${live}`.replace(/\s+/g, " ").trim();
}

/**
 * @param {{
 *   className?: string,
 *   documentId?: string | null,
 *   assistantName?: string,
 *   openingMessage?: string,
 *   openingMode?: "first" | "return" | "progress",
 *   demoReply?: string,
 *   placeholder?: string,
 *   speechLang?: string,
 *   labels?: Record<string, string>,
 *   onClose?: () => void,
 *   onSendMessage?: (text: string, meta?: { meetingMode?: boolean }) => void | Promise<void | string | { message?: string, reply?: string, visualization?: object | null, searchSequence?: { preludeMessage?: string } | null }>,
 *   onDocumentAction?: (action: "organize" | "import_pdf" | "export_pdf" | "save_pdf_library" | "export_md" | "save_md_library") => void | Promise<void>,
 *   writingEmpty?: boolean,
 *   allowMeetingMode?: boolean,
 *   meetingDocumentTitle?: string,
 *   initialMeetingMode?: boolean,
 *   lockMeetingMode?: boolean,
 *   autoRunPrompt?: string | null,
 *   autoRunDisplayText?: string | null,
 * }} props
 */
export function GinaChatCard({
  className = "",
  documentId = null,
  assistantName = "Gina",
  openingMessage = "",
  openingMode = "first",
  demoReply = "Got it — I’ll use this chat once tools are connected.",
  placeholder = "Type a message…",
  speechLang = "es-ES",
  labels = {},
  onClose,
  onSendMessage,
  onDocumentAction,
  writingEmpty = false,
  allowMeetingMode = false,
  meetingDocumentTitle = "",
  initialMeetingMode = false,
  lockMeetingMode = false,
  autoRunPrompt = null,
  autoRunDisplayText = null,
}) {
  const chipLocale = String(speechLang || "").toLowerCase().startsWith("en") ? "en" : "es";
  /** Talk-notify / protocol open: skip generic greeting so autoRun can deliver immediately. */
  const skipOpeningForAutoRun = Boolean(
    typeof autoRunPrompt === "string"
    && autoRunPrompt.trim()
    && !String(openingMessage || "").trim(),
  );
  /** @type {[GinaChatMessage[], Function]} */
  const [messages, setMessages] = useState(() => []);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  /** True while the latest Gina reply typewriter is still running. */
  const [isAiAnimating, setIsAiAnimating] = useState(() => !skipOpeningForAutoRun);
  const [micError, setMicError] = useState(/** @type {string | null} */ (null));
  const [dictationFinals, setDictationFinals] = useState(/** @type {string[]} */ ([]));
  const [dictationInterim, setDictationInterim] = useState("");
  /** True while STT is actively producing speech (interim / recent result). */
  const [isHearing, setIsHearing] = useState(false);
  /** Mode B: “borrar” armed — next utterance is the phrase to remove. */
  const [deletePhraseArmed, setDeletePhraseArmed] = useState(false);
  const [deletePhraseHint, setDeletePhraseHint] = useState(/** @type {string | null} */ (null));
  const [meetingMode, setMeetingMode] = useState(Boolean(initialMeetingMode));
  /** Green “active” schedule-style dot — shown while Enable.wav plays / Gina is live. */
  const [enableDotVisible, setEnableDotVisible] = useState(false);
  /** In-doc: footer action button unlocks after chip «Algo más». */
  const [moreActionsEnabled, setMoreActionsEnabled] = useState(false);
  const [docActionsMenuOpen, setDocActionsMenuOpen] = useState(false);
  const isDocumentSurface = Boolean(documentId);
  const docActionsMenu = useMemo(
    () => (isDocumentSurface
      ? buildGinaDocActionsMenu({ locale: chipLocale, writingEmpty: Boolean(writingEmpty) })
      : []),
    [isDocumentSurface, chipLocale, writingEmpty],
  );

  useEffect(() => {
    setMeetingMode(Boolean(initialMeetingMode));
  }, [initialMeetingMode]);

  const {
    recognitionSupported,
    synthesisSupported,
    isListening,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
  } = useWebSpeech({ lang: speechLang });

  const [ttsEnabled, setTtsEnabled] = useState(false);
  const spokenCountRef = useRef(0);
  const skipOpeningSpeakRef = useRef(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const dictationRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const dictationFinalsRef = useRef(/** @type {string[]} */ ([]));
  const dictationInterimRef = useRef("");
  const deletePhraseArmedRef = useRef(false);
  const hearingTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const focusComposerAfterInsertRef = useRef(false);
  /** User texts waiting until Gina finishes typing the current reply. */
  const pendingQueueRef = useRef(/** @type {{ id: string, text: string }[]} */ ([]));
  const isTypingRef = useRef(false);
  const isAiAnimatingRef = useRef(!skipOpeningForAutoRun);
  const deliveringRef = useRef(false);
  const pendingAiAnimationTaskRef = useRef(/** @type {null | (() => Promise<void> | void)} */ (null));
  const doubleBipPlayedForMsgIdRef = useRef(/** @type {string | null} */ (null));
  const enablePlayedForSheetMsgIdRef = useRef(/** @type {string | null} */ (null));
  const highlightsPlayedForMsgIdRef = useRef(/** @type {string | null} */ (null));
  const notifyGateTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const notifyGateTimerMsgIdRef = useRef(/** @type {string | null} */ (null));
  const midReadyTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const midReadyTimerMsgIdRef = useRef(/** @type {string | null} */ (null));
  const rescheduleWaitTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const pendingRescheduleRef = useRef(/** @type {{ sendText: string, displayText: string } | null} */ (null));
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const deliverUserMessageRef = useRef(/** @type {(text: string, opts?: { existingId?: string }) => Promise<void>} */ (async () => {}));

  const makeMsgId = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // After todayOverview infographic: wait 5s, then unlock textMid (sheet intro).
  useEffect(() => {
    let targetIndex = -1;
    let targetId = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m?.sender !== "ai") continue;
      if (!m.textMid || !m.visualization?.data?.todayOverview) continue;
      if (!m.vizRevealed || m.midReady !== false) continue;
      targetIndex = i;
      targetId = m.id || `idx-${i}`;
      break;
    }
    if (targetIndex < 0 || !targetId) return;
    if (midReadyTimerMsgIdRef.current === targetId) return;

    if (midReadyTimerRef.current != null) {
      window.clearTimeout(midReadyTimerRef.current);
      midReadyTimerRef.current = null;
    }
    midReadyTimerMsgIdRef.current = targetId;
    const scheduledIndex = targetIndex;
    const scheduledId = targetId;
    midReadyTimerRef.current = window.setTimeout(() => {
      midReadyTimerRef.current = null;
      setMessages((prev) => prev.map((m, idx) => (
        (m.id && m.id === scheduledId) || idx === scheduledIndex
          ? { ...m, midReady: true }
          : m
      )));
    }, GINA_SHEET_INTRO_DELAY_MS);
  }, [messages]);

  // Enable.wav when the day / schedule sheet visualization appears (not on chat open).
  // Skip recovery overdue (red) sheet — that uses highlights.mp3 only.
  useEffect(() => {
    let targetId = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m?.sender !== "ai" || !isScheduleSheetVisualization(m.visualization)) continue;
      if (m.deferVisualization && !m.vizRevealed) continue;
      if (m.visualization?.data?.todayOverview && m.sheetTableRevealed === false) continue;
      const data = m.visualization?.data;
      if (data?.playHighlightsSound) continue;
      if (
        data?.recoveryWizard
        && data?.currentStep === "overdue_check"
        && Number(data?.urgencyCount) > 0
      ) continue;
      targetId = m.id || `idx-${i}`;
      break;
    }
    if (!targetId) return;
    if (enablePlayedForSheetMsgIdRef.current === targetId) return;
    enablePlayedForSheetMsgIdRef.current = targetId;
    void playGinaEnableSound();
  }, [messages]);

  // Recovery overdue (red) table reveal → highlights.mp3 once.
  useEffect(() => {
    let targetId = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m?.sender !== "ai") continue;
      if (m.deferVisualization && !m.vizRevealed) continue;
      const data = m.visualization?.data;
      if (!data?.playHighlightsSound && !(
        data?.recoveryWizard
        && data?.currentStep === "overdue_check"
        && (Number(data?.urgencyCount) > 0 || Number(data?.lateStartCount) > 0)
      )) continue;
      targetId = m.id || `idx-${i}`;
      break;
    }
    if (!targetId) return;
    if (highlightsPlayedForMsgIdRef.current === targetId) return;
    highlightsPlayedForMsgIdRef.current = targetId;
    void playGinaHighlightsSound();
  }, [messages]);

  // After the table is ready: wait 5s, then reveal notify gate + play double-bip.
  useEffect(() => {
    if (isTyping || isAiAnimating) return;

    let targetIndex = -1;
    let targetId = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (!messageHasNotifyGate(m)) continue;
      if (m.notifyGateRevealed) continue;
      if (!messageChipsReadyToShow(m, { isTyping: false, isAiAnimating: false })) continue;
      targetIndex = i;
      targetId = m.id || `idx-${i}`;
      break;
    }

    if (targetIndex < 0 || !targetId) return;
    if (notifyGateTimerMsgIdRef.current === targetId) return;
    if (doubleBipPlayedForMsgIdRef.current === targetId) return;

    if (notifyGateTimerRef.current != null) {
      window.clearTimeout(notifyGateTimerRef.current);
      notifyGateTimerRef.current = null;
    }
    notifyGateTimerMsgIdRef.current = targetId;
    const scheduledIndex = targetIndex;
    const scheduledId = targetId;
    notifyGateTimerRef.current = window.setTimeout(() => {
      notifyGateTimerRef.current = null;
      setMessages((prev) => prev.map((m, idx) => (
        (m.id && m.id === scheduledId) || idx === scheduledIndex
          ? { ...m, notifyGateRevealed: true }
          : m
      )));
      if (doubleBipPlayedForMsgIdRef.current !== scheduledId) {
        doubleBipPlayedForMsgIdRef.current = scheduledId;
        void playGinaDoubleBipSound();
      }
    }, GINA_NOTIFY_GATE_DELAY_MS);
  }, [messages, isTyping, isAiAnimating]);

  useEffect(() => () => {
    if (notifyGateTimerRef.current != null) {
      window.clearTimeout(notifyGateTimerRef.current);
      notifyGateTimerRef.current = null;
    }
    if (midReadyTimerRef.current != null) {
      window.clearTimeout(midReadyTimerRef.current);
      midReadyTimerRef.current = null;
    }
    if (rescheduleWaitTimerRef.current != null) {
      window.clearTimeout(rescheduleWaitTimerRef.current);
      rescheduleWaitTimerRef.current = null;
    }
    pendingRescheduleRef.current = null;
  }, []);

  // Open → silence → green dot → greeting (Enable.wav plays with the sheet instead).
  // Protocol auto-run (talk-notify Accept) skips this so we don't seed a blank “new chat”.
  useEffect(() => {
    let cancelled = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let soundTimer = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let textTimer = null;

    const autoRun = typeof autoRunPrompt === "string" ? autoRunPrompt.trim() : "";
    const openingText = String(openingMessage || "").trim();
    if (autoRun && !openingText) {
      isAiAnimatingRef.current = false;
      setIsAiAnimating(false);
      setEnableDotVisible(true);
      return () => {
        cancelled = true;
      };
    }

    const revealOpening = () => {
      if (cancelled) return;
      if (documentId) {
        const node = useNodesStore.getState().getNode?.(documentId)
          || useNodesStore.getState().nodes?.[documentId]
          || null;
        const { searchingText, greeting } = buildGinaDocumentSyncOpening({
          locale: chipLocale,
          documentTitle: node?.title,
        });
        const chips = buildGinaOpeningChips({
          locale: chipLocale,
          surface: "document",
          mode: "first",
        });
        setMessages((prev) => {
          if (prev.some((m) => m.sender === "ai")) return prev;
          return [
            {
              id: makeMsgId(),
              sender: "ai",
              text: searchingText,
              searching: true,
              refineRevealed: true,
              visualization: null,
              chips: null,
            },
          ];
        });
        isAiAnimatingRef.current = true;
        setIsAiAnimating(true);
        skipOpeningSpeakRef.current = true;
        void playGinaFilesMovementSound().then(() => {
          if (cancelled) return;
          setMessages((prev) => {
            const searchingIdx = prev.findIndex((m) => m.sender === "ai" && m.searching);
            const greetingMsg = {
              id: makeMsgId(),
              sender: "ai",
              text: greeting,
              chips,
            };
            if (searchingIdx < 0) {
              if (prev.some((m) => m.sender === "ai" && !m.searching)) return prev;
              return [greetingMsg];
            }
            return prev.map((m, idx) => (idx === searchingIdx ? greetingMsg : m));
          });
          isAiAnimatingRef.current = true;
          setIsAiAnimating(true);
        });
        return;
      }
      const chips = buildGinaOpeningChips({
        locale: chipLocale,
        surface: "dashboard",
        hasDaySheet: hasDaySheet(useAuthStore.getState().user?.id || "anon"),
        mode: openingMode || "first",
      });
      if (!openingText && chips.length === 0) {
        isAiAnimatingRef.current = false;
        setIsAiAnimating(false);
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.sender === "ai")) return prev;
        return [
          {
            id: makeMsgId(),
            sender: "ai",
            text: openingText,
            chips,
          },
        ];
      });
      if (!openingText) {
        isAiAnimatingRef.current = false;
        setIsAiAnimating(false);
      } else {
        isAiAnimatingRef.current = true;
        setIsAiAnimating(true);
      }
      skipOpeningSpeakRef.current = true;
    };

    soundTimer = window.setTimeout(() => {
      if (cancelled) return;
      setEnableDotVisible(true);
      textTimer = window.setTimeout(() => {
        revealOpening();
      }, GINA_POST_SOUND_TEXT_DELAY_MS);
    }, GINA_OPEN_SOUND_DELAY_MS);

    return () => {
      cancelled = true;
      if (soundTimer != null) window.clearTimeout(soundTimer);
      if (textTimer != null) window.clearTimeout(textTimer);
    };
  }, [openingMessage, openingMode, chipLocale, documentId, autoRunPrompt]);

  useEffect(() => () => {
    stopGinaFilesMovementSound();
  }, []);

  const liveDictation = joinTranscript(dictationFinals, dictationInterim);

  const markHearing = (active) => {
    if (hearingTimerRef.current) {
      clearTimeout(hearingTimerRef.current);
      hearingTimerRef.current = null;
    }
    if (active) {
      setIsHearing(true);
      // Linger briefly after last chunk so bars don't flicker between words.
      hearingTimerRef.current = setTimeout(() => {
        hearingTimerRef.current = null;
        setIsHearing(false);
      }, 520);
      return;
    }
    setIsHearing(false);
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  useEffect(() => {
    if (isListening || !focusComposerAfterInsertRef.current) return;
    focusComposerAfterInsertRef.current = false;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }, [isListening, input]);

  useEffect(() => {
    const el = dictationRef.current;
    if (!el || !isListening) return;
    el.scrollTop = el.scrollHeight;
  }, [liveDictation, isListening]);

  useEffect(() => () => {
    if (hearingTimerRef.current) clearTimeout(hearingTimerRef.current);
  }, []);

  const particles = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: `${(i * 17 + 11) % 100}%`,
      duration: 5 + (i % 4),
      delay: i * 0.45,
      x: ((i * 37) % 200) - 100,
    })),
    [],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, isTyping, isListening, liveDictation, micError]);

  // Opening greeting is never auto-spoken; later TTS waits for typewriter complete.
  useEffect(() => {
    const aiMessages = messages.filter((m) => m.sender === "ai");
    if (skipOpeningSpeakRef.current && aiMessages.length === 1) {
      spokenCountRef.current = 1;
      skipOpeningSpeakRef.current = false;
    }
  }, [messages]);

  useEffect(() => () => {
    cancelSpeak();
    stopListening({ mode: "abort" });
  }, [cancelSpeak, stopListening]);

  const resetDictationBuffers = () => {
    dictationFinalsRef.current = [];
    dictationInterimRef.current = "";
    deletePhraseArmedRef.current = false;
    setDictationFinals([]);
    setDictationInterim("");
    setDeletePhraseArmed(false);
    setDeletePhraseHint(null);
    markHearing(false);
  };

  const startDictation = () => {
    if (!recognitionSupported) {
      setMicError(speechErrorMessage("unsupported", labels));
      return;
    }
    setMicError(null);
    resetDictationBuffers();
    cancelSpeak();

    startListening({
      onResult: ({ finalText, interimText }) => {
        setMicError(null);
        if (finalText) {
          const existing = dictationFinalsRef.current.filter(Boolean).join(" ");
          const absorbed = absorbDictationFinal(existing, finalText, {
            deletePhraseArmed: deletePhraseArmedRef.current,
          });
          const normalized = normalizeDictationTranscript(absorbed.text);
          dictationFinalsRef.current = normalized ? [normalized] : [];
          setDictationFinals([...dictationFinalsRef.current]);

          deletePhraseArmedRef.current = Boolean(absorbed.deletePhraseArmed);
          setDeletePhraseArmed(deletePhraseArmedRef.current);

          if (absorbed.phraseMiss) {
            setDeletePhraseHint(
              labels.deletePhraseMiss
              || "No encontré ese texto. Di el fragmento otra vez o di cancelar.",
            );
          } else if (absorbed.phraseDeleted) {
            setDeletePhraseHint(null);
          } else if (absorbed.deletePhraseArmed) {
            setDeletePhraseHint(
              labels.deletePhraseArmed
              || "Borrar: di el texto que quieres quitar (o cancelar).",
            );
          } else {
            setDeletePhraseHint(null);
          }

          if (absorbed.didEdit || absorbed.deletePhraseArmed || absorbed.phraseMiss) {
            dictationInterimRef.current = "";
            setDictationInterim("");
            markHearing(true);
            return;
          }
        }
        dictationInterimRef.current = interimText || "";
        setDictationInterim(interimText || "");
        markHearing(Boolean(finalText || interimText));
      },
      onError: (code) => {
        setMicError(speechErrorMessage(String(code), labels));
        resetDictationBuffers();
      },
      onEnd: () => {
        markHearing(false);
      },
    });
  };

  const cancelDictation = () => {
    stopListening({ mode: "abort" });
    resetDictationBuffers();
    setMicError(null);
  };

  const isChatBusy = () => (
    isTypingRef.current || isAiAnimatingRef.current || deliveringRef.current
  );

  const flushPendingQueue = () => {
    if (isChatBusy()) return;
    const next = pendingQueueRef.current.shift();
    if (!next) return;
    setMessages((prev) => prev.map((m) => (
      m.id === next.id ? { ...m, queued: false } : m
    )));
    void deliverUserMessageRef.current(next.text, {
      existingId: next.id,
      displayText: next.displayText || next.text,
    });
  };

  /**
   * @param {string} text
   * @param {{ displayText?: string | null }} [opts]
   */
  const enqueueOrDeliver = (text, opts = {}) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    const displayText = opts.displayText != null ? String(opts.displayText).trim() : "";
    const bubbleText = displayText || trimmed;
    setInput("");
    setMicError(null);
    if (isChatBusy()) {
      const id = makeMsgId();
      pendingQueueRef.current.push({ id, text: trimmed, displayText: bubbleText });
      setMessages((prev) => [...prev, { id, sender: "user", text: bubbleText, queued: true }]);
      return;
    }
    void deliverUserMessageRef.current(trimmed, { displayText: bubbleText });
  };

  const handleAiAnimComplete = () => {
    isAiAnimatingRef.current = false;
    setIsAiAnimating(false);

    // Speak only after the bubble finished typing (never on message append).
    const aiMessages = messagesRef.current.filter((m) => m.sender === "ai");
    if (aiMessages.length > spokenCountRef.current) {
      const newest = aiMessages[aiMessages.length - 1];
      spokenCountRef.current = aiMessages.length;
      if (ttsEnabled && synthesisSupported && !isListening && newest?.text && !newest?.searching) {
        speak(newest.text, { lang: speechLang });
      }
    }

    const afterAnimTask = pendingAiAnimationTaskRef.current;
    if (afterAnimTask) {
      pendingAiAnimationTaskRef.current = null;
      void afterAnimTask();
      return;
    }
    queueMicrotask(() => flushPendingQueue());
  };

  /** Skip typewriter: show the whole ready turn at once. */
  const handleSkipText = () => {
    if (isTypingRef.current || !isAiAnimatingRef.current) return;
    if (midReadyTimerRef.current != null) {
      window.clearTimeout(midReadyTimerRef.current);
      midReadyTimerRef.current = null;
      midReadyTimerMsgIdRef.current = null;
    }
    if (rescheduleWaitTimerRef.current != null) {
      window.clearTimeout(rescheduleWaitTimerRef.current);
      rescheduleWaitTimerRef.current = null;
    }
    const pendingReschedule = pendingRescheduleRef.current;
    pendingRescheduleRef.current = null;
    if (pendingReschedule) {
      isAiAnimatingRef.current = false;
      setIsAiAnimating(false);
      void deliverUserMessageRef.current(pendingReschedule.sendText, {
        displayText: pendingReschedule.displayText,
      });
      return;
    }
    try { stopGinaTypingSound(); } catch { /* ignore */ }
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i]?.sender === "ai") {
          next[i] = revealAiTurnFully(next[i]);
          break;
        }
      }
      messagesRef.current = next;
      return next;
    });
    handleAiAnimComplete();
    // Instant onComplete cascades can briefly re-arm animating; pin it off after paint.
    queueMicrotask(() => {
      isAiAnimatingRef.current = false;
      setIsAiAnimating(false);
      queueMicrotask(() => flushPendingQueue());
    });
  };

  /**
   * @param {string} text
   * @param {{ existingId?: string, displayText?: string | null }} [opts]
   */
  const deliverUserMessage = async (text, opts = {}) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const displayText = opts.displayText != null ? String(opts.displayText).trim() : "";
    const bubbleText = displayText || trimmed;
    const isSilentProtocol = /^(GinaSilentMark(InProgress|Completed|PastDue)\b|GinaSilentSetDocStatus:|GinaCloseChat$)/i.test(trimmed);

    if (isSilentProtocol) {
      if (/^GinaCloseChat$/i.test(trimmed)) {
        onClose?.();
        return;
      }
      // Side-effect only — no user/AI bubbles, keep Easy Links on screen.
      if (typeof onSendMessage === "function") {
        try {
          await onSendMessage(trimmed, {
            meetingMode: Boolean(allowMeetingMode && (lockMeetingMode || meetingMode)),
            messages: [],
          });
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (isChatBusy()) {
      const id = opts.existingId || makeMsgId();
      if (!opts.existingId) {
        pendingQueueRef.current.push({ id, text: trimmed, displayText: bubbleText });
        setMessages((prev) => [...prev, { id, sender: "user", text: bubbleText, queued: true }]);
      } else {
        pendingQueueRef.current.push({ id, text: trimmed, displayText: bubbleText });
      }
      setInput("");
      return;
    }

    deliveringRef.current = true;
    if (!opts.existingId) {
      setMessages((prev) => [...prev, { id: makeMsgId(), sender: "user", text: bubbleText }]);
    }
    setInput("");
    isTypingRef.current = true;
    setIsTyping(true);
    const typingStartedAt = Date.now();
    const minTypingMs = 700;

    let startedAiAnim = false;
    let hasPendingSearchSequence = false;

    if (typeof onSendMessage === "function") {
      try {
        const history = [
          ...messagesRef.current
            .filter((m) => (
              m
              && typeof m.text === "string"
              && m.text.trim()
              && !m.queued
              && !(opts.existingId && m.id === opts.existingId)
            ))
            .map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.text,
            })),
          { role: "user", content: trimmed },
        ].slice(-12);

        const reply = await onSendMessage(trimmed, {
          meetingMode: Boolean(allowMeetingMode && (lockMeetingMode || meetingMode)),
          messages: history,
        });
        let aiText = "";
        let textMid = null;
        let textAfter = null;
        let textAfterLead = null;
        let textAfterRest = null;
        let startDocLines = null;
        let notifyTodoMock = null;
        let textPitch = null;
        let visualization = null;
        let learnProposal = null;
        let chips = null;
        let voiceSequence = null;
        if (typeof reply === "string") {
          aiText = reply.trim();
        } else if (reply && typeof reply === "object") {
          aiText = String(reply.message || reply.reply || "").trim();
          textMid = reply.textMid != null ? String(reply.textMid).trim() : null;
          if (textMid === "") textMid = null;
          textAfter = reply.textAfter != null ? String(reply.textAfter).trim() : null;
          if (textAfter === "") textAfter = null;
          textAfterLead = reply.textAfterLead != null ? String(reply.textAfterLead).trim() : null;
          if (textAfterLead === "") textAfterLead = null;
          textAfterRest = reply.textAfterRest != null ? String(reply.textAfterRest).trim() : null;
          if (textAfterRest === "") textAfterRest = null;
          startDocLines = Array.isArray(reply.startDocLines) ? reply.startDocLines : null;
          notifyTodoMock = reply.notifyTodoMock && typeof reply.notifyTodoMock === "object"
            ? reply.notifyTodoMock
            : null;
          textPitch = reply.textPitch != null ? String(reply.textPitch).trim() : null;
          if (textPitch === "") textPitch = null;
          visualization = reply.visualization || null;
          learnProposal = reply.learnProposal || null;
          chips = Array.isArray(reply.chips) ? reply.chips : null;
          voiceSequence = reply.voiceSequence != null ? String(reply.voiceSequence).trim() : null;
          if (voiceSequence === "") voiceSequence = null;
          if (reply.closeChat) {
            deliveringRef.current = false;
            isTypingRef.current = false;
            setIsTyping(false);
            onClose?.();
            return;
          }
          if (reply.resetChat) {
            setMessages([
              {
                id: makeMsgId(),
                sender: "ai",
                text: aiText,
                chips,
              },
            ]);
            isAiAnimatingRef.current = Boolean(aiText && aiText.trim());
            setIsAiAnimating(Boolean(aiText && aiText.trim()));
            startedAiAnim = Boolean(aiText && aiText.trim());
            return;
          }
          const preludeMessage = String(reply.searchSequence?.preludeMessage || "").trim();
          if (preludeMessage) {
            hasPendingSearchSequence = true;
            isAiAnimatingRef.current = true;
            setIsAiAnimating(true);
            startedAiAnim = true;
            setMessages((prev) => [
              ...prev,
              {
                id: makeMsgId(),
                sender: "ai",
                text: preludeMessage,
                searching: Boolean(reply.searchSequence?.searching),
                visualization: null,
                learnProposal: null,
                chips: null,
              },
            ]);
            pendingAiAnimationTaskRef.current = async () => {
              await playGinaFilesMovementSound();
              let keepAnimating = false;
              if (aiText || visualization || learnProposal) {
                const reveal = buildAiTurnRevealState({
                  aiText,
                  textMid,
                  textAfter,
                  textAfterLead,
                  textAfterRest,
                  startDocLines,
                  textPitch,
                  visualization,
                  voiceSequence,
                });
                const hasAnimatableText = Boolean(aiText && aiText.trim());
                keepAnimating = Boolean(
                  hasAnimatableText
                  || reveal.deferVisualization
                  || reveal.textMid
                  || reveal.textAfterLead
                  || (Array.isArray(reveal.startDocLines) && reveal.startDocLines.length)
                  || reveal.textAfterRest
                );
                if (keepAnimating) {
                  isAiAnimatingRef.current = true;
                  setIsAiAnimating(true);
                }
                setMessages((prev) => [
                  ...prev,
                  {
                    id: makeMsgId(),
                    sender: "ai",
                    ...reveal,
                    notifyTodoMock,
                    learnProposal,
                    chips: ensureNavBackChip(prev, chips, chipLocale, {
                      skipNavBack: visualization?.type === "schedule_slot_picker"
                        || (Array.isArray(chips) && chips.some((c) => c?.kind === "close_chat")),
                    }),
                  },
                ]);
              }
              deliveringRef.current = false;
              if (!keepAnimating) {
                queueMicrotask(() => flushPendingQueue());
              }
            };
          }
        }
        const waitMore = minTypingMs - (Date.now() - typingStartedAt);
        if (waitMore > 0) {
          await new Promise((r) => window.setTimeout(r, waitMore));
        }
        if (!hasPendingSearchSequence && (aiText || visualization || learnProposal)) {
          const hasAnimatableText = Boolean(aiText && aiText.trim());
          const reveal = buildAiTurnRevealState({
            aiText,
            textMid,
            textAfter,
            textAfterLead,
            textAfterRest,
            startDocLines,
            textPitch,
            visualization,
            voiceSequence,
          });
          // Keep animating through deferred viz / post-sheet stages even with empty lead text.
          if (
            hasAnimatableText
            || reveal.deferVisualization
            || reveal.textMid
            || reveal.textAfterLead
            || (Array.isArray(reveal.startDocLines) && reveal.startDocLines.length)
            || reveal.textAfterRest
          ) {
            isAiAnimatingRef.current = true;
            setIsAiAnimating(true);
            startedAiAnim = true;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: makeMsgId(),
              sender: "ai",
              ...reveal,
              notifyTodoMock,
              learnProposal,
              chips: ensureNavBackChip(prev, chips, chipLocale, {
                skipNavBack: visualization?.type === "schedule_slot_picker"
                  || (Array.isArray(chips) && chips.some((c) => c?.kind === "close_chat")),
              }),
            },
          ]);
        }
      } finally {
        isTypingRef.current = false;
        setIsTyping(false);
        if (!hasPendingSearchSequence) {
          deliveringRef.current = false;
        }
        if (!startedAiAnim && !hasPendingSearchSequence) {
          queueMicrotask(() => flushPendingQueue());
        }
      }
      return;
    }

    window.setTimeout(() => {
      isAiAnimatingRef.current = true;
      setIsAiAnimating(true);
      setMessages((prev) => [...prev, { id: makeMsgId(), sender: "ai", text: demoReply }]);
      isTypingRef.current = false;
      setIsTyping(false);
      deliveringRef.current = false;
    }, 1200);
  };
  deliverUserMessageRef.current = deliverUserMessage;

  /** Prompt string actually delivered — survives Strict Mode effect re-run (don't mark done before fire). */
  const autoRunDeliveredRef = useRef(/** @type {string | null} */ (null));
  useEffect(() => {
    const prompt = typeof autoRunPrompt === "string" ? autoRunPrompt.trim() : "";
    if (!prompt || autoRunDeliveredRef.current === prompt) return;
    const display = typeof autoRunDisplayText === "string" ? autoRunDisplayText.trim() : "";
    const t = window.setTimeout(() => {
      if (autoRunDeliveredRef.current === prompt) return;
      autoRunDeliveredRef.current = prompt;
      enqueueOrDeliver(prompt, display ? { displayText: display } : {});
    }, 280);
    return () => window.clearTimeout(t);
    // Intentionally once per distinct autoRunPrompt (Strict Mode safe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunPrompt, autoRunDisplayText]);

  const lastAiMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.sender === "ai") return i;
    }
    return -1;
  }, [messages]);

  /** Day sheet: checkbox = pending selection only (confirm chips apply status). */
  const handleToggleDaySheetDoc = (docId, nextSelected) => {
    if (!docId) return;
    setMessages((prev) => prev.map((m) => {
      if (m.sender !== "ai" || !m.visualization?.data?.isDaySheet) return m;
      const visualization = togglePendingDaySheetSelection(
        m.visualization,
        docId,
        nextSelected,
      );
      const pending = visualization?.data?.pendingSelectedIds || [];
      const docs = flattenDaySheetDocs(visualization);
      const talkRequestDocId = visualization?.data?.talkRequestDocId || null;
      const openId = pending.length === 1 ? pending[0] : (talkRequestDocId || pending[0]);
      const openDoc = docs.find((d) => String(d?.id) === String(openId));
      const notifyDoc = talkRequestDocId
        ? docs.find((d) => String(d?.id) === String(talkRequestDocId))
        : null;
      const chips = pending.length
        ? buildDaySheetPendingActionChips({
          locale: chipLocale,
          selectedIds: pending,
          talkRequestDocId,
          openTitle: openDoc?.title || "",
        })
        : (m.visualization?.data?.talkRequestNotify
          ? buildTalkRequestNotifyChips({
            locale: chipLocale,
            documentId: talkRequestDocId,
            title: notifyDoc?.title || "",
          })
          : buildInDocDaySheetIdleChips({ locale: chipLocale }));
      return { ...m, visualization, chips: Array.isArray(chips) && chips.length ? chips : null };
    }));
  };

  const handleDaySheetDiscardSelection = () => {
    if (!documentId && !messagesRef.current.some((m) => m.visualization?.data?.talkRequestNotify)) return;
    setMessages((prev) => prev.map((m) => {
      if (m.sender !== "ai" || !m.visualization?.data?.isDaySheet) return m;
      return {
        ...m,
        visualization: clearPendingDaySheetSelection(m.visualization),
        chips: m.visualization?.data?.talkRequestNotify
          ? (() => {
            const talkRequestDocId = m.visualization?.data?.talkRequestDocId || null;
            const docs = flattenDaySheetDocs(m.visualization);
            const notifyDoc = talkRequestDocId
              ? docs.find((d) => String(d?.id) === String(talkRequestDocId))
              : null;
            return buildTalkRequestNotifyChips({
              locale: chipLocale,
              documentId: talkRequestDocId,
              title: notifyDoc?.title || "",
            });
          })()
          : buildInDocDaySheetIdleChips({ locale: chipLocale }),
      };
    }));
  };

  const handleDaySheetApplyComplete = () => {
    const canApply = Boolean(documentId)
      || messagesRef.current.some((m) => m.visualization?.data?.talkRequestNotify);
    if (!canApply) return;
    const sheetMsg = [...messagesRef.current].reverse().find((m) => (
      m.sender === "ai" && m.visualization?.data?.isDaySheet
    ));
    if (!sheetMsg?.visualization) return;
    const pending = Array.isArray(sheetMsg.visualization.data.pendingSelectedIds)
      ? sheetMsg.visualization.data.pendingSelectedIds.map(String).filter(Boolean)
      : [];
    if (!pending.length) {
      handleDaySheetDiscardSelection();
      return;
    }

    const updateNode = useNodesStore.getState().updateNode;
    for (const id of pending) {
      updateNode(id, syncDocWorkStatusFields({ status: DOC_WORK_STATUS.COMPLETED }));
    }

    const visualization = applyDaySheetCompletionBatch(sheetMsg.visualization, pending);
    const docs = flattenDaySheetDocs(visualization);
    const talkRequestDocId = sheetMsg.visualization?.data?.talkRequestDocId || null;
    const talkNotify = Boolean(sheetMsg.visualization?.data?.talkRequestNotify);
    const notifiedStillOpen = talkRequestDocId
      ? docs.find((d) => String(d?.id) === String(talkRequestDocId) && !isDocCompleted(d))
      : null;
    const nextDoc = notifiedStillOpen || pickNextDaySheetDoc(docs);
    const ackText = buildDaySheetBatchCompleteAck({
      count: pending.length,
      nextTitle: nextDoc?.title || "",
      locale: chipLocale,
    });
    const ackChips = buildDaySheetBatchCompleteChips({
      locale: chipLocale,
      documentId: nextDoc?.id || null,
      title: nextDoc?.title || "",
      talkRequestNotify: talkNotify,
    });

    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.sender !== "ai" || !m.visualization?.data?.isDaySheet) return m;
        return { ...m, visualization, chips: null };
      });
      return [
        ...next,
        {
          id: makeMsgId(),
          sender: "ai",
          text: ackText,
          visualization: null,
          chips: ackChips.length ? ackChips : null,
        },
      ];
    });
    isAiAnimatingRef.current = true;
    setIsAiAnimating(true);
  };

  const handleDaySheetReschedule = (protocolText, chipIndex) => {
    const sendText = String(protocolText || "").trim();
    if (!sendText) return;
    if (rescheduleWaitTimerRef.current != null) {
      window.clearTimeout(rescheduleWaitTimerRef.current);
      rescheduleWaitTimerRef.current = null;
    }
    const displayText = chipLocale === "en" ? "Reschedule" : "Reagendar";
    pendingRescheduleRef.current = { sendText, displayText };
    const waitLabel = chipLocale === "en" ? "wait a moment…" : "espera un momento…";
    setMessages((prev) => [
      ...prev.map((m, idx) => (idx === chipIndex ? stashMessageChips(m) : m)),
      {
        id: makeMsgId(),
        sender: "ai",
        text: waitLabel,
        searching: true,
        refineRevealed: true,
        visualization: null,
        chips: null,
      },
    ]);
    isAiAnimatingRef.current = true;
    setIsAiAnimating(true);
    rescheduleWaitTimerRef.current = window.setTimeout(() => {
      rescheduleWaitTimerRef.current = null;
      const pending = pendingRescheduleRef.current;
      pendingRescheduleRef.current = null;
      if (!pending) return;
      isAiAnimatingRef.current = false;
      setIsAiAnimating(false);
      void deliverUserMessageRef.current(pending.sendText, {
        displayText: pending.displayText,
      });
    }, 2000);
  };

  /**
   * Step 1: stop mic and park transcript in the composer so the user can fix
   * STT mistakes before sending.
   */
  const insertDictation = () => {
    const raw = joinTranscript(dictationFinalsRef.current, dictationInterimRef.current);
    stopListening({ mode: "stop" });
    resetDictationBuffers();
    setMicError(null);
    if (!raw.trim()) {
      setMicError(labels.micNoSpeech || "No speech detected. Tap the mic and try again.");
      return;
    }
    const text = normalizeDictationTranscript(raw);
    focusComposerAfterInsertRef.current = true;
    setInput((prev) => {
      const existing = prev.trim();
      if (!existing) return text;
      return `${existing} ${text}`;
    });
  };

  /** Step 2: send whatever is in the composer (typed or voice + edits). */
  const handleSend = async () => {
    if (isListening) {
      insertDictation();
      return;
    }
    const text = input.trim();
    if (!text) return;
    enqueueOrDeliver(text);
  };

  const micTitle = !recognitionSupported
    ? (labels.micUnsupported || "Voice input not supported in this browser")
    : isListening
      ? (labels.listeningCancel || "Cancel dictation")
      : (labels.micAria || "Dictate with microphone");

  const ttsTitle = ttsEnabled
    ? (labels.ttsOn || "Speaking replies on")
    : (labels.ttsOff || "Speaking replies off");

  const dictationInsertTitle = labels.dictationInsert || "Insert to edit";

  return (
    <div
      className={`gina-chat-card ${docActionsMenuOpen ? "gina-chat-card--doc-menu-open" : ""} ${className}`.trim()}
      data-document-id={documentId || undefined}
    >
      <motion.div
        className="gina-chat-card__orbit"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      <div className="gina-chat-card__inner">
        <motion.div
          className="gina-chat-card__bg"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />

        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="gina-chat-card__particle"
            animate={{
              y: ["0%", "-140%"],
              x: [p.x, -p.x],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
            style={{ left: p.left, bottom: "-10%" }}
          />
        ))}

        <header className="gina-chat-card__header">
          <h2 className="gina-chat-card__title">
            {assistantName}
            {enableDotVisible ? (
              <span
                className="gina-chat-card__live-dot"
                title="Active"
                aria-label="Active"
              />
            ) : null}
          </h2>
          <div className="gina-chat-card__header-actions">
            {!documentId ? (
              <button
                type="button"
                className="gina-chat-card__reset-dev"
                disabled={isTyping || isAiAnimating}
                onClick={() => {
                  const links = getGinaTestQuickLinks({ locale: chipLocale });
                  const reset = links.find((l) => l.id === "test_reset_day_ritual") || {
                    text: GINA_RESET_DAY_RITUAL_PROTOCOL,
                    label: chipLocale === "en" ? "Reset today’s ritual" : "Reset ritual de hoy",
                  };
                  enqueueOrDeliver(reset.text, { displayText: reset.label });
                }}
              >
                {chipLocale === "en" ? "Reset ritual" : "Reset ritual"}
              </button>
            ) : null}
            <button
              type="button"
              className={`gina-chat-card__icon-btn${ttsEnabled ? " is-active" : ""}`}
              onClick={() => {
                if (ttsEnabled) cancelSpeak();
                setTtsEnabled((v) => !v);
              }}
              disabled={!synthesisSupported}
              aria-pressed={ttsEnabled}
              aria-label={ttsTitle}
              title={ttsTitle}
            >
              <SpeakerIcon on={ttsEnabled && synthesisSupported} />
            </button>
            {typeof onClose === "function" ? (
              <button
                type="button"
                className="gina-chat-card__icon-btn"
                onClick={() => {
                  cancelSpeak();
                  cancelDictation();
                  onClose();
                }}
                aria-label={labels.closeAria || "Close"}
                title={labels.closeAria || "Close"}
              >
                <span aria-hidden>×</span>
              </button>
            ) : null}
          </div>
        </header>

        {allowMeetingMode ? (
          <div className="gina-chat-card__meeting-bar">
            {lockMeetingMode ? (
              <span className="gina-chat-card__meeting-label is-on">
                {labels.meetingToggle || "Meeting"}
              </span>
            ) : (
              <label className={`gina-chat-card__meeting-toggle${meetingMode ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={meetingMode}
                  onChange={(e) => setMeetingMode(e.target.checked)}
                />
                <span className="gina-chat-card__meeting-label">
                  {labels.meetingToggle || "Meeting"}
                </span>
              </label>
            )}
            {(lockMeetingMode || meetingMode) ? (
              <span className="gina-chat-card__meeting-hint">
                {(labels.meetingActiveHint || "Reading: {title}").replace(
                  "{title}",
                  meetingDocumentTitle || labels.meetingThisDocument || "this document",
                )}
              </span>
            ) : (
              <span className="gina-chat-card__meeting-hint gina-chat-card__meeting-hint--dim">
                {labels.meetingOffHint || "Off — Gina won’t use this document as a brief"}
              </span>
            )}
          </div>
        ) : null}

        <div className="gina-chat-card__messages" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.sender}-${i}-${msg.text.slice(0, 12)}`}
              initial={msg.refineRevealed ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={
                msg.sender === "ai"
                  ? "gina-chat-card__turn gina-chat-card__turn--ai"
                  : "gina-chat-card__turn gina-chat-card__turn--user"
              }
            >
              {msg.sender === "ai" && msg.visualization?.type === "day_sheet_saved" ? (
                <>
                  <GinaDataVisualization
                    type={msg.visualization.type}
                    data={msg.visualization.data}
                    onReady={() => {
                      setMessages((prev) => prev.map((m, idx) => (
                        idx === i ? { ...m, savedAckRevealed: true } : m
                      )));
                    }}
                  />
                  {msg.savedAckRevealed ? (
                    <div className="gina-chat-card__bubble gina-chat-card__bubble--ai gina-chat-card__bubble--after-viz">
                      <GinaAiMessageText
                        text={msg.text}
                        plainBody
                        pace="slow"
                        instant={Boolean(msg.refineRevealed)}
                        onComplete={i === lastAiMessageIndex ? handleAiAnimComplete : undefined}
                      />
                    </div>
                  ) : null}
                </>
              ) : msg.sender === "ai" && msg.visualization?.type === "schedule_sheet" && (
                msg.visualization?.data?.hasRecoveryOffer
                || msg.visualization?.data?.recoveryPhase === "brief"
              ) && !msg.visualization?.data?.todayOverview && !msg.deferVisualization ? (
                <>
                  <GinaDataVisualization
                    type={msg.visualization.type}
                    data={msg.visualization.data}
                    onSelectDepartment={(deptName) => {
                      if (!deptName || isTyping || isAiAnimating) return;
                      const focusText = chipLocale === "en"
                        ? `Focus today on ${deptName}`
                        : `Enfocarme hoy en ${deptName}`;
                      setMessages((prev) => prev.map((m, idx) => (
                        idx === i ? stashMessageChips(m) : m
                      )));
                      enqueueOrDeliver(focusText);
                    }}
                    onSelectAction={(actionText, displayText) => {
                      if (!actionText || isTyping) return;
                      if (isAiAnimating && !isEnableTalkNotificationsIntent(actionText)) return;
                      if (/^(GinaSilentMark(InProgress|Completed|PastDue)\b|GinaSilentSetDocStatus:)/i.test(String(actionText))) {
                        void deliverUserMessage(actionText, {
                          displayText: displayText || null,
                        });
                        return;
                      }
                      if (/^GinaCloseChat$/i.test(String(actionText))) {
                        onClose?.();
                        return;
                      }
                      setMessages((prev) => prev.map((m, idx) => (
                        idx === i ? stashMessageChips(m) : m
                      )));
                      enqueueOrDeliver(actionText, {
                        displayText: displayText || bubbleTextForProtocolSend(actionText, displayText),
                      });
                    }}
                  />
                  <div className="gina-chat-card__bubble gina-chat-card__bubble--ai gina-chat-card__bubble--after-viz">
                    <GinaAiMessageText
                      text={msg.text}
                      plainBody
                      instant={Boolean(msg.refineRevealed)}
                      onComplete={i === lastAiMessageIndex ? handleAiAnimComplete : undefined}
                    />
                  </div>
                </>
              ) : (
                <>
                  {(msg.sender === "user" || String(msg.text || "").trim()) ? (
                  <div
                    className={
                      msg.sender === "ai"
                        ? "gina-chat-card__bubble gina-chat-card__bubble--ai"
                        : "gina-chat-card__bubble gina-chat-card__bubble--user"
                    }
                  >
                    {msg.sender === "ai" ? (
                      msg.searching ? (
                        <span className="gina-chat-card__searching" aria-live="polite">
                          <span className="gina-chat-card__searching-icon" aria-hidden="true" />
                          <GinaAiMessageText
                            text={msg.text}
                            plainBody
                            onComplete={i === lastAiMessageIndex ? handleAiAnimComplete : undefined}
                          />
                        </span>
                      ) : (
                      <GinaAiMessageText
                        text={msg.text}
                        plainBody={
                          Boolean(msg.plainBody)
                          || msg.visualization?.type === "recovery_preview"
                        }
                        instant={Boolean(msg.refineRevealed)}
                        headlineIcon={
                          /Aún no tienes ningún documento seleccionado|You don’t have any document selected yet/i
                            .test(String(msg.text || ""))
                            ? "search"
                            : null
                        }
                        onComplete={i === lastAiMessageIndex ? (() => {
                          if (msg.refineRevealed) {
                            handleAiAnimComplete();
                            return;
                          }
                          if (messageHasLeaveScheduleVoice(msg) && msg.textAfter && !msg.leaveAckDone) {
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            void (async () => {
                              await playGinaLeaveScheduleSound();
                              setMessages((prev) => prev.map((m, idx) => (
                                idx === i
                                  ? {
                                    ...m,
                                    leaveAckDone: true,
                                    afterRevealed: false,
                                  }
                                  : m
                              )));
                            })();
                            return;
                          }
                          if (msg.deferVisualization && !msg.vizRevealed) {
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            setMessages((prev) => prev.map((m, idx) => (
                              idx === i
                                ? (() => {
                                  const hasAfter = Boolean(
                                    m.textAfter
                                    || m.textAfterRest
                                    || m.textAfterLead
                                    || (Array.isArray(m.startDocLines) && m.startDocLines.length)
                                  );
                                  const recoveryWizard = Boolean(m.visualization?.data?.recoveryWizard);
                                  const talkNotify = Boolean(m.visualization?.data?.talkRequestNotify);
                                  // Recovery: finish step copy (“El documento…”) before sheet + Easy Links.
                                  if (recoveryWizard && hasAfter && !m.textMid) {
                                    return {
                                      ...m,
                                      vizRevealed: false,
                                      midRevealed: true,
                                      sheetTableRevealed: true,
                                      afterRevealed: false,
                                      pitchRevealed: !m.textPitch,
                                      recoveryCopyFirst: true,
                                    };
                                  }
                                  // Talk-notify: intro → highlights → todos/condition → day sheet.
                                  if (talkNotify) {
                                    return {
                                      ...m,
                                      vizRevealed: false,
                                      recoveryCopyFirst: true,
                                      sheetTableRevealed: true,
                                      startDocRevealed: !m.startDocLines?.length,
                                      afterRevealed: false,
                                      pitchRevealed: !m.textPitch,
                                    };
                                  }
                                  return {
                                    ...m,
                                    vizRevealed: true,
                                    // Chrono sheet still waits for intro (mid) to finish.
                                    sheetTableRevealed: !m.textMid || !m.visualization?.data?.todayOverview,
                                    midRevealed: !m.textMid,
                                    afterRevealed: !m.textMid && !hasAfter,
                                    pitchRevealed: !m.textMid && !hasAfter && !m.textPitch,
                                  };
                                })()
                                : m
                            )));
                            const hasAfter = Boolean(
                              msg.textAfter
                              || msg.textAfterRest
                              || msg.textAfterLead
                              || (Array.isArray(msg.startDocLines) && msg.startDocLines.length)
                            );
                            const recoveryWizard = Boolean(msg.visualization?.data?.recoveryWizard);
                            if (recoveryWizard && hasAfter && !msg.textMid) {
                              return;
                            }
                            if (!msg.textMid && !hasAfter && !msg.textPitch) {
                              handleAiAnimComplete();
                            }
                            return;
                          }
                          handleAiAnimComplete();
                        }) : undefined}
                      />
                      )
                    ) : msg.text}
                  </div>
                  ) : null}
                  {msg.sender === "user" && msg.queued ? (
                    <span className="gina-chat-card__queue-label">
                      {labels.queued || "queue"}
                    </span>
                  ) : null}
                  {msg.sender === "ai" && msg.visualization && (
                    !msg.deferVisualization || msg.vizRevealed
                  ) ? (
                    <GinaDataVisualization
                      type={msg.visualization.type}
                      data={{
                        ...msg.visualization.data,
                        ...(documentId && msg.visualization.data?.isDaySheet
                          ? { compact: true }
                          : null),
                        // Recovery easy-links type only after step copy (textAfter) finishes.
                        easyLinksReady: Boolean(
                          !msg.visualization.data?.recoveryWizard
                          || (
                            msg.vizRevealed
                            && msg.midRevealed !== false
                            && (!(msg.textAfter || msg.textAfterRest) || msg.afterRevealed)
                            && (!msg.startDocLines?.length || msg.startDocRevealed)
                          )
                        ),
                      }}
                      compact={Boolean(documentId)}
                      onToggleDaySheetDoc={
                        msg.visualization?.data?.isDaySheet
                        && (documentId || msg.visualization?.data?.talkRequestNotify)
                          ? handleToggleDaySheetDoc
                          : undefined
                      }
                      onSelectDepartment={(deptName) => {
                        if (!deptName || isTyping || isAiAnimating) return;
                        const focusText = chipLocale === "en"
                          ? `Focus today on ${deptName}`
                          : `Enfocarme hoy en ${deptName}`;
                        setMessages((prev) => prev.map((m, idx) => (
                          idx === i ? stashMessageChips(m) : m
                        )));
                        enqueueOrDeliver(focusText);
                      }}
                      onSelectAction={(actionText, displayText) => {
                        if (!actionText || isTyping) return;
                        if (isAiAnimating && !isEnableTalkNotificationsIntent(actionText)) return;
                        if (/^(GinaSilentMark(InProgress|Completed|PastDue)\b|GinaSilentSetDocStatus:)/i.test(String(actionText))) {
                          void deliverUserMessage(actionText, {
                            displayText: displayText || null,
                          });
                          return;
                        }
                        if (/^GinaCloseChat$/i.test(String(actionText))) {
                          onClose?.();
                          return;
                        }
                        setMessages((prev) => prev.map((m, idx) => (
                          idx === i ? stashMessageChips(m) : m
                        )));
                        enqueueOrDeliver(actionText, {
                          displayText: displayText || bubbleTextForProtocolSend(actionText, displayText),
                        });
                      }}
                    />
                  ) : null}
                  {msg.sender === "ai" && msg.textMid && msg.vizRevealed && msg.midReady !== false ? (
                    <div className="gina-chat-card__bubble gina-chat-card__bubble--ai gina-chat-card__bubble--after-viz">
                      <GinaAiMessageText
                        text={msg.textMid}
                        plainBody
                        pace="slow"
                        instant={Boolean(msg.refineRevealed)}
                        onComplete={() => {
                          if (msg.refineRevealed) return;
                          isAiAnimatingRef.current = true;
                          setIsAiAnimating(true);
                          setMessages((prev) => prev.map((m, idx) => (
                            idx === i
                              ? {
                                ...m,
                                midRevealed: true,
                                // Unlock post-table copy after chrono sheet paints (see below).
                                sheetTableRevealed: false,
                                afterRevealed: false,
                                pitchRevealed: false,
                              }
                              : m
                          )));
                          // Safety: never block copy if chrono sheet fails to mount.
                          window.setTimeout(() => {
                            setMessages((prev) => prev.map((m, idx) => {
                              if (idx !== i || m.sheetTableRevealed || m.refineRevealed) return m;
                              const hasAfter = Boolean(
                                m.textAfter
                                || m.textAfterRest
                                || m.textAfterLead
                                || (Array.isArray(m.startDocLines) && m.startDocLines.length)
                              );
                              return {
                                ...m,
                                sheetTableRevealed: true,
                                afterRevealed: !hasAfter,
                                pitchRevealed: !hasAfter && !m.textPitch,
                              };
                            }));
                          }, 900);
                        }}
                      />
                    </div>
                  ) : null}
                  {msg.sender === "ai"
                    && msg.visualization?.data?.todayOverview
                    && !msg.visualization?.data?.recoveryWizard
                    && msg.vizRevealed
                    && msg.midRevealed === true
                    && (
                      msg.visualization?.data?.quickSheet
                      || (Array.isArray(msg.visualization?.data?.documents)
                        && msg.visualization.data.documents.length > 0)
                      || (Array.isArray(msg.visualization?.data?.groups)
                        && msg.visualization.data.groups.length > 0)
                    ) ? (
                      <GinaTodayChronoSheet
                        data={msg.visualization.data}
                        locale={chipLocale}
                        onReady={msg.sheetTableRevealed ? undefined : () => {
                          setMessages((prev) => prev.map((m, idx) => (
                            idx === i
                              ? (() => {
                                const hasAfter = Boolean(
                                  m.textAfter
                                  || m.textAfterRest
                                  || m.textAfterLead
                                  || (Array.isArray(m.startDocLines) && m.startDocLines.length)
                                );
                                return {
                                  ...m,
                                  sheetTableRevealed: true,
                                  afterRevealed: !hasAfter,
                                  pitchRevealed: !hasAfter && !m.textPitch,
                                };
                              })()
                              : m
                          )));
                          const hasAfter = Boolean(
                            msg.textAfter
                            || msg.textAfterRest
                            || msg.textAfterLead
                            || (Array.isArray(msg.startDocLines) && msg.startDocLines.length)
                          );
                          if (!hasAfter && !msg.textPitch) {
                            handleAiAnimComplete();
                          }
                        }}
                      />
                    ) : null}
                  {msg.sender === "ai"
                    && (
                      msg.textAfterLead
                      || (Array.isArray(msg.startDocLines) && msg.startDocLines.length)
                      || msg.textAfter
                      || msg.textAfterRest
                    )
                    && (msg.vizRevealed || msg.recoveryCopyFirst)
                    && msg.midRevealed === true
                    && msg.sheetTableRevealed !== false
                    && (!messageHasLeaveScheduleVoice(msg) || msg.leaveAckDone) ? (
                    <div className="gina-chat-card__bubble gina-chat-card__bubble--ai gina-chat-card__bubble--after-viz">
                      {msg.textAfterLead ? (
                        <GinaAiMessageText
                          text={msg.textAfterLead}
                          plainBody
                          pace="slow"
                          instant={Boolean(msg.refineRevealed)}
                          onComplete={() => {
                            if (msg.refineRevealed) return;
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            setMessages((prev) => prev.map((m, idx) => (
                              idx === i
                                ? {
                                  ...m,
                                  leadRevealed: true,
                                  afterRevealed: !(
                                    m.startDocLines?.length
                                    || m.textAfterRest
                                    || (!m.startDocLines?.length && m.textAfter && !m.textAfterLead)
                                  ),
                                }
                                : m
                            )));
                            if (
                              !msg.startDocLines?.length
                              && !msg.textAfterRest
                              && !(msg.textAfter && !msg.textAfterLead)
                            ) {
                              if (!msg.textPitch) handleAiAnimComplete();
                            }
                          }}
                        />
                      ) : null}
                      {(!msg.textAfterLead || msg.leadRevealed === true)
                        && Array.isArray(msg.startDocLines)
                        && msg.startDocLines.length ? (
                        <GinaStartDocReveal
                          lines={msg.startDocLines}
                          instant={Boolean(msg.refineRevealed)}
                          onComplete={() => {
                            if (msg.refineRevealed) return;
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            const hasFollowUp = Boolean(
                              msg.textAfterRest || msg.textAfter || msg.notifyTodoMock
                            );
                            setMessages((prev) => prev.map((m, idx) => (
                              idx === i
                                ? {
                                  ...m,
                                  startDocRevealed: true,
                                  afterRevealed: !hasFollowUp,
                                  vizRevealed: m.visualization?.data?.talkRequestNotify
                                    ? !hasFollowUp
                                    : m.vizRevealed,
                                  recoveryCopyFirst: m.visualization?.data?.talkRequestNotify
                                    ? hasFollowUp
                                    : m.recoveryCopyFirst,
                                }
                                : m
                            )));
                            if (!hasFollowUp && !msg.textPitch) handleAiAnimComplete();
                          }}
                        />
                      ) : null}
                      {(!msg.textAfterLead || msg.leadRevealed === true)
                        && (
                          (!msg.startDocLines?.length)
                          || msg.startDocRevealed === true
                        )
                        && msg.notifyTodoMock
                        && Array.isArray(msg.notifyTodoMock.items)
                        && msg.notifyTodoMock.items.length ? (
                        <div className="gina-chat-card__notify-todos">
                          <p className="gina-chat-card__notify-todos-title">
                            {`☑️ ${msg.notifyTodoMock.title || "Pendientes en este documento (0/3):"}`}
                          </p>
                          <ul className="gina-chat-card__notify-todos-list">
                            {msg.notifyTodoMock.items.map((item) => (
                              <li key={item} className="gina-chat-card__notify-todos-item">
                                {`[ ] ${item}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {(
                        (!msg.textAfterLead || msg.leadRevealed === true)
                        && (
                          (!msg.startDocLines?.length)
                          || msg.startDocRevealed === true
                        )
                      ) && (msg.textAfterRest || msg.textAfter) ? (
                        <GinaAiMessageText
                          text={msg.textAfterRest || msg.textAfter}
                          plainBody
                          pace="slow"
                          instant={Boolean(msg.refineRevealed)}
                          onComplete={i === lastAiMessageIndex ? () => {
                            if (msg.refineRevealed) {
                              handleAiAnimComplete();
                              return;
                            }
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            if (messageHasLeaveScheduleVoice(msg)) {
                              void (async () => {
                                await playGinaWhatsNextSound();
                                setMessages((prev) => prev.map((m, idx) => (
                                  idx === i
                                    ? {
                                      ...m,
                                      afterRevealed: true,
                                      pitchRevealed: !m.textPitch,
                                    }
                                    : m
                                )));
                                if (!msg.textPitch) {
                                  handleAiAnimComplete();
                                }
                              })();
                              return;
                            }
                            setMessages((prev) => prev.map((m, idx) => (
                              idx === i
                                ? {
                                  ...m,
                                  // After recovery step copy: reveal sheet + Easy Links next.
                                  vizRevealed: true,
                                  recoveryCopyFirst: false,
                                  afterRevealed: true,
                                  pitchRevealed: !m.textPitch,
                                }
                                : m
                            )));
                            if (!msg.textPitch) {
                              handleAiAnimComplete();
                            }
                          } : undefined}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {msg.sender === "ai"
                    && msg.textPitch
                    && msg.vizRevealed
                    && msg.midRevealed !== false
                    && msg.afterRevealed !== false ? (
                    <div className="gina-chat-card__bubble gina-chat-card__bubble--ai gina-chat-card__bubble--after-viz">
                      <GinaAiMessageText
                        text={msg.textPitch}
                        plainBody
                        pace="slow"
                        instant={Boolean(msg.refineRevealed)}
                        onComplete={i === lastAiMessageIndex ? () => {
                          if (msg.refineRevealed) {
                            handleAiAnimComplete();
                            return;
                          }
                          setMessages((prev) => prev.map((m, idx) => (
                            idx === i ? { ...m, pitchRevealed: true } : m
                          )));
                          handleAiAnimComplete();
                        } : undefined}
                      />
                    </div>
                  ) : null}
                </>
              )}
              {msg.sender === "ai" && Array.isArray(msg.chips) && msg.chips.length && !isTyping
                && (!isAiAnimating || talkNotifyOfferVisible(msg))
                && (msg.visualization?.type !== "day_sheet_saved" || msg.savedAckRevealed)
                && (!messageHasNotifyGate(msg) || msg.notifyGateRevealed)
                && (!messageHasLeaveScheduleVoice(msg) || !msg.textAfter || msg.afterRevealed)
                && (!msg.deferVisualization || (
                  msg.vizRevealed
                  && msg.midRevealed !== false
                  && msg.sheetTableRevealed !== false
                  && (
                    chipsAreTalkNotifyOffer(msg.chips)
                    || (
                      (!msg.startDocLines?.length || msg.startDocRevealed)
                      && (!(msg.textAfter || msg.textAfterRest) || msg.afterRevealed)
                      && (!msg.textPitch || msg.pitchRevealed)
                    )
                  )
                )) ? (
                chipsAreHomeOpening(msg.chips) ? (
                  <GinaHomeOpeningChips
                    chips={msg.chips}
                    locale={chipLocale}
                    disabled={isTyping || isAiAnimating}
                    onSubmit={(text, displayText) => {
                      if (!text) return;
                      setMessages((prev) => prev.map((m, idx) => (
                        idx === i ? stashMessageChips(m) : m
                      )));
                      enqueueOrDeliver(text, {
                        displayText: displayText || bubbleTextForProtocolSend(text, displayText),
                      });
                    }}
                  />
                ) : chipsAreListRefine(msg.chips) ? (
                  <GinaListRefineChips
                    chips={msg.chips}
                    locale={chipLocale}
                    instant={Boolean(msg.refineRevealed)}
                    disabled={isTyping || isAiAnimating}
                    onSubmit={(text, displayText) => {
                      if (!text) return;
                      setMessages((prev) => prev.map((m, idx) => (
                        idx === i ? stashMessageChips(m) : m
                      )));
                      enqueueOrDeliver(text, {
                        displayText: displayText || bubbleTextForProtocolSend(text, displayText),
                      });
                    }}
                    onDismiss={() => {
                      setMessages((prev) => prev.map((m, idx) => (
                        idx === i ? stashMessageChips(m) : m
                      )));
                    }}
                  />
                ) : (
                  <div className="gina-chat-card__chips" role="group" aria-label="Suggested replies">
                    {msg.chips.map((chip) => {
                      const isNotify = chip.id === "recovery_notify";
                      const comingSoon = Boolean(chip.comingSoon);
                      return (
                      <button
                        key={chip.id || chip.label}
                        type="button"
                        className={
                          "gina-chat-card__chip"
                          + (chip.primary ? " is-primary" : "")
                          + (isNotify ? " gina-chat-card__chip--notify" : "")
                          + (comingSoon ? " is-coming-soon" : "")
                          + (chip.kind === "nav_back" ? " gina-chat-card__chip--back" : "")
                          + (chip.kind === "save_day" || chip.id === "save_day_sheet"
                            ? " gina-chat-card__chip--save-day"
                            : "")
                        }
                        disabled={comingSoon && !chip.text}
                        title={comingSoon ? (chipLocale === "en" ? "Coming soon" : "Próximamente") : undefined}
                        onClick={() => {
                          if (isTyping) return;
                          if (isAiAnimating && !chipsAreTalkNotifyOffer(msg.chips)) return;
                          if (comingSoon) {
                            // Deferred actions — show soft ack, no mutation path.
                            setMessages((prev) => [
                              ...prev.map((m, idx) => (idx === i ? stashMessageChips(m) : m)),
                              {
                                id: makeMsgId(),
                                sender: "ai",
                                text: chipLocale === "en"
                                  ? "Got it — that option is still being wired. Pick another for now, or skip."
                                  : "Va — esa opción todavía se está cableando. Elige otra por ahora, u omite.",
                                visualization: null,
                                chips: null,
                              },
                            ]);
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            return;
                          }
                          if (chip.id === "day_sheet_apply_complete") {
                            handleDaySheetApplyComplete();
                            return;
                          }
                          if (chip.id === "day_sheet_discard_selection") {
                            handleDaySheetDiscardSelection();
                            return;
                          }
                          if (chip.id === "day_sheet_reschedule") {
                            handleDaySheetReschedule(chip.text || chip.label, i);
                            return;
                          }
                          if (chip.kind === "close_chat" || chip.id === "gina_close") {
                            onClose?.();
                            return;
                          }
                          if (chip.kind === "more_actions" || chip.id === "doc_algo_mas") {
                            const label = chip.label || (chipLocale === "en" ? "Something else" : "Algo más");
                            const ack = labels.moreActionsAck
                              || (chipLocale === "en"
                                ? "What do you need to do with this document?\nSelect one of the options below:"
                                : "¿Qué necesitas hacer con este documento?\nSelecciona una de las opciones a continuación:");
                            const actionChips = buildGinaDocActionsMenu({
                              locale: chipLocale,
                              writingEmpty: Boolean(writingEmpty),
                            }).map((item) => ({
                              ...item,
                              text: item.label,
                            }));
                            setMoreActionsEnabled(true);
                            setDocActionsMenuOpen(true);
                            setMessages((prev) => [
                              ...prev.map((m, idx) => (idx === i ? stashMessageChips(m) : m)),
                              { id: makeMsgId(), sender: "user", text: label },
                              {
                                id: makeMsgId(),
                                sender: "ai",
                                text: ack,
                                visualization: null,
                                chips: actionChips,
                                refineRevealed: true,
                              },
                            ]);
                            isAiAnimatingRef.current = false;
                            setIsAiAnimating(false);
                            return;
                          }
                          if (chip.kind === "doc_action") {
                            const label = chip.label || chip.text || "";
                            setDocActionsMenuOpen(false);
                            setMessages((prev) => prev.map((m, idx) => (
                              idx === i ? stashMessageChips(m) : m
                            )));
                            if (chip.action === "organize_prompt") {
                              setMessages((prev) => [
                                ...prev,
                                { id: makeMsgId(), sender: "user", text: label },
                                {
                                  id: makeMsgId(),
                                  sender: "ai",
                                  text: buildGinaOrganizePromptMessage({ locale: chipLocale }),
                                  plainBody: true,
                                  visualization: null,
                                  chips: buildGinaOrganizeStyleChips({ locale: chipLocale }),
                                },
                              ]);
                              isAiAnimatingRef.current = true;
                              setIsAiAnimating(true);
                              return;
                            }
                            if (chip.action === "import_pdf") {
                              setMessages((prev) => [
                                ...prev,
                                { id: makeMsgId(), sender: "user", text: label },
                                {
                                  id: makeMsgId(),
                                  sender: "ai",
                                  text: buildGinaPdfToTextMessage({ locale: chipLocale }),
                                  plainBody: true,
                                  visualization: null,
                                  chips: buildGinaPdfUploadChip({ locale: chipLocale }),
                                },
                              ]);
                              isAiAnimatingRef.current = true;
                              setIsAiAnimating(true);
                              return;
                            }
                            if (chip.action === "export_prompt") {
                              setMessages((prev) => [
                                ...prev,
                                { id: makeMsgId(), sender: "user", text: label },
                                {
                                  id: makeMsgId(),
                                  sender: "ai",
                                  text: buildGinaExportPromptMessage({ locale: chipLocale }),
                                  plainBody: true,
                                  visualization: null,
                                  chips: buildGinaExportFormatChips({ locale: chipLocale }),
                                },
                              ]);
                              isAiAnimatingRef.current = true;
                              setIsAiAnimating(true);
                              return;
                            }
                            return;
                          }
                          if (chip.kind === "doc_export_format") {
                            const label = chip.label || chip.text || "";
                            setDocActionsMenuOpen(false);
                            setMessages((prev) => prev.map((m, idx) => (
                              idx === i ? stashMessageChips(m) : m
                            )));
                            if (chip.action === "learn_more") {
                              setMessages((prev) => [
                                ...prev,
                                { id: makeMsgId(), sender: "user", text: label },
                                {
                                  id: makeMsgId(),
                                  sender: "ai",
                                  text: buildGinaExportLearnMoreMessage({ locale: chipLocale }),
                                  plainBody: true,
                                  visualization: null,
                                  chips: buildGinaExportFormatChips({
                                    locale: chipLocale,
                                    includeLearnMore: false,
                                  }),
                                },
                              ]);
                              isAiAnimatingRef.current = true;
                              setIsAiAnimating(true);
                              return;
                            }
                            const format = chip.action === "markdown" ? "markdown" : "pdf";
                            setMessages((prev) => [
                              ...prev,
                              { id: makeMsgId(), sender: "user", text: label },
                              {
                                id: makeMsgId(),
                                sender: "ai",
                                text: buildGinaExportDestPromptMessage({
                                  locale: chipLocale,
                                  format,
                                }),
                                plainBody: true,
                                visualization: null,
                                chips: buildGinaExportFollowUpChips({
                                  locale: chipLocale,
                                  format,
                                }),
                              },
                            ]);
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            return;
                          }
                          if (chip.kind === "doc_pdf_upload") {
                            const label = chip.label || "Upload";
                            const waitId = makeMsgId();
                            setDocActionsMenuOpen(false);
                            setMessages((prev) => [
                              ...prev.map((m, idx) => (idx === i ? stashMessageChips(m) : m)),
                              { id: makeMsgId(), sender: "user", text: label },
                              {
                                id: waitId,
                                sender: "ai",
                                text: buildGinaPdfWaitMessage({ locale: chipLocale }),
                                searching: true,
                                refineRevealed: true,
                                visualization: null,
                                chips: null,
                              },
                            ]);
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            void (async () => {
                              try {
                                await Promise.resolve(onDocumentAction?.("import_pdf"));
                                setMessages((prev) => prev.map((m) => (
                                  m.id === waitId
                                    ? {
                                      ...m,
                                      searching: false,
                                      text: buildGinaPdfDoneMessage({ locale: chipLocale }),
                                      refineRevealed: true,
                                    }
                                    : m
                                )));
                                isAiAnimatingRef.current = true;
                                setIsAiAnimating(true);
                                window.setTimeout(() => {
                                  isAiAnimatingRef.current = false;
                                  setIsAiAnimating(false);
                                  onClose?.();
                                }, 1600);
                              } catch (err) {
                                const cancelled = String(err?.message || "") === "cancelled";
                                if (cancelled) {
                                  setMessages((prev) => prev.filter((m) => m.id !== waitId));
                                  isAiAnimatingRef.current = false;
                                  setIsAiAnimating(false);
                                  return;
                                }
                                setMessages((prev) => prev.map((m) => (
                                  m.id === waitId
                                    ? {
                                      ...m,
                                      searching: false,
                                      text: chipLocale === "en"
                                        ? "I couldn’t convert that PDF. Try another file."
                                        : "No pude convertir ese PDF. Probá con otro archivo.",
                                      refineRevealed: true,
                                    }
                                    : m
                                )));
                                isAiAnimatingRef.current = false;
                                setIsAiAnimating(false);
                              }
                            })();
                            return;
                          }
                          if (chip.kind === "doc_organize_style") {
                            const label = chip.label || chip.text || "";
                            const ack = buildGinaOrganizeAppliedAck({
                              locale: chipLocale,
                              styleId: chip.id,
                            });
                            setMessages((prev) => [
                              ...prev.map((m, idx) => (idx === i ? stashMessageChips(m) : m)),
                              { id: makeMsgId(), sender: "user", text: label },
                              {
                                id: makeMsgId(),
                                sender: "ai",
                                text: ack,
                                visualization: null,
                                chips: null,
                              },
                            ]);
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            const organizeAction = chip.id === "doc_organize_style_story"
                              ? "organize_script"
                              : "organize";
                            void Promise.resolve(onDocumentAction?.(organizeAction)).catch(() => {});
                            return;
                          }
                          if (chip.kind === "doc_export_dest") {
                            const label = chip.label || chip.text || "";
                            const raw = String(chip.action || "");
                            const action = (
                              raw === "save_pdf_library"
                              || raw === "export_pdf"
                              || raw === "save_md_library"
                              || raw === "export_md"
                            )
                              ? raw
                              : "export_pdf";
                            const ack = buildGinaExportAppliedAck({
                              locale: chipLocale,
                              action,
                            });
                            setMessages((prev) => [
                              ...prev.map((m, idx) => (idx === i ? stashMessageChips(m) : m)),
                              { id: makeMsgId(), sender: "user", text: label },
                              {
                                id: makeMsgId(),
                                sender: "ai",
                                text: ack,
                                plainBody: true,
                                visualization: null,
                                chips: null,
                              },
                            ]);
                            isAiAnimatingRef.current = true;
                            setIsAiAnimating(true);
                            void Promise.resolve(onDocumentAction?.(action)).catch(() => {});
                            return;
                          }
                          if (chip.kind === "nav_back") {
                            isAiAnimatingRef.current = false;
                            setIsAiAnimating(false);
                            setMessages((prev) => {
                              let next = [...prev];
                              // Drop trailing user + ai turn (the filtered result)
                              while (next.length) {
                                const last = next[next.length - 1];
                                if (last?.sender === "ai") {
                                  next = next.slice(0, -1);
                                  break;
                                }
                                if (last?.sender === "user") {
                                  next = next.slice(0, -1);
                                  continue;
                                }
                                break;
                              }
                              if (next.length && next[next.length - 1]?.sender === "user") {
                                next = next.slice(0, -1);
                              }
                              // Restore option chips on the previous AI message (already-written page)
                              for (let j = next.length - 1; j >= 0; j -= 1) {
                                if (next[j]?.sender === "ai" && Array.isArray(next[j].chipsRestorable)) {
                                  next[j] = {
                                    ...next[j],
                                    chips: next[j].chipsRestorable,
                                    chipsRestorable: null,
                                    refineRevealed: true,
                                  };
                                  break;
                                }
                              }
                              return next;
                            });
                            return;
                          }
                          setMessages((prev) => prev.map((m, idx) => (
                            idx === i ? stashMessageChips(m) : m
                          )));
                          const sendText = chip.text || chip.label;
                          enqueueOrDeliver(sendText, {
                            displayText: bubbleTextForProtocolSend(sendText, chip.label),
                          });
                        }}
                      >
                        {isNotify ? (
                          <span className="gina-chat-card__chip-notify-stroke" aria-hidden>
                            {Array.from({ length: 6 }, (_, n) => (
                              <span
                                key={n}
                                className="gina-chat-card__chip-notify-dot"
                                style={{ "--dot-i": n }}
                              />
                            ))}
                          </span>
                        ) : null}
                        {chip.icon ? (
                          <img className="gina-chat-card__chip-icon" src={chip.icon} alt="" aria-hidden />
                        ) : null}
                        <span className="gina-chat-card__chip-label">{chip.label}</span>
                      </button>
                      );
                    })}
                  </div>
                )
              ) : null}
              {msg.sender === "ai" && msg.learnProposal && allowMeetingMode ? (
                <button
                  type="button"
                  className="gina-chat-card__learn-save"
                  onClick={async () => {
                    if (typeof onSendMessage !== "function") return;
                    setIsTyping(true);
                    try {
                      const saved = await onSendMessage("guarda", {
                        meetingMode: true,
                        saveLearnProposal: true,
                        learnProposal: msg.learnProposal,
                      });
                      let confirmText = "";
                      if (typeof saved === "string") confirmText = saved.trim();
                      else if (saved && typeof saved === "object") {
                        confirmText = String(saved.message || saved.reply || "").trim();
                      }
                      setMessages((prev) => [
                        ...prev.map((m, idx) => (
                          idx === i ? { ...m, learnProposal: null } : m
                        )),
                        ...(confirmText
                          ? [{ sender: "ai", text: confirmText, learnProposal: null }]
                          : []),
                      ]);
                    } finally {
                      setIsTyping(false);
                    }
                  }}
                >
                  {labels.learnSave || "Save to Gina’s memory"}
                </button>
              ) : null}
            </motion.div>
          ))}

          {isTyping && (
            <GinaThinkingStatus
              locale={String(speechLang || "").toLowerCase().startsWith("en") ? "en" : "es"}
              ariaLabel={labels.typingAria || "Gina is thinking"}
              phrases={Array.isArray(labels.thinkingPhrases) ? labels.thinkingPhrases : undefined}
            />
          )}
          {!isTyping && isAiAnimating ? (
            <div className="gina-chat-card__skip-row">
              <button
                type="button"
                className="gina-chat-card__skip-text"
                onClick={handleSkipText}
                aria-label={chipLocale === "en" ? "Skip text" : "Saltar texto"}
              >
                {labels.skipText || (chipLocale === "en" ? "skip text" : "saltar texto")}
              </button>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        {micError && !isDocumentSurface ? (
          <p className="gina-chat-card__mic-banner is-error" role="status" aria-live="polite">
            {micError}
          </p>
        ) : null}

        {isDocumentSurface ? (
          <div className="gina-chat-card__actions-footer">
            {moreActionsEnabled && docActionsMenuOpen ? (
              <div
                className="gina-chat-card__doc-actions-menu"
                role="menu"
                aria-label={
                  labels.moreActionsMenuAria
                  || (chipLocale === "en" ? "Document actions" : "Acciones del documento")
                }
              >
                {docActionsMenu.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className="gina-chat-card__doc-action-item"
                    onClick={() => {
                      setDocActionsMenuOpen(false);
                      const label = item.label || "";
                      if (item.action === "organize_prompt") {
                        setMessages((prev) => [
                          ...prev,
                          { id: makeMsgId(), sender: "user", text: label },
                          {
                            id: makeMsgId(),
                            sender: "ai",
                            text: buildGinaOrganizePromptMessage({ locale: chipLocale }),
                            plainBody: true,
                            visualization: null,
                            chips: buildGinaOrganizeStyleChips({ locale: chipLocale }),
                          },
                        ]);
                        isAiAnimatingRef.current = true;
                        setIsAiAnimating(true);
                        return;
                      }
                      if (item.action === "import_pdf") {
                        setMessages((prev) => [
                          ...prev,
                          { id: makeMsgId(), sender: "user", text: label },
                          {
                            id: makeMsgId(),
                            sender: "ai",
                            text: buildGinaPdfToTextMessage({ locale: chipLocale }),
                            plainBody: true,
                            visualization: null,
                            chips: buildGinaPdfUploadChip({ locale: chipLocale }),
                          },
                        ]);
                        isAiAnimatingRef.current = true;
                        setIsAiAnimating(true);
                        return;
                      }
                      if (item.action === "export_prompt") {
                        setMessages((prev) => [
                          ...prev,
                          { id: makeMsgId(), sender: "user", text: label },
                          {
                            id: makeMsgId(),
                            sender: "ai",
                            text: buildGinaExportPromptMessage({ locale: chipLocale }),
                            plainBody: true,
                            visualization: null,
                            chips: buildGinaExportFormatChips({ locale: chipLocale }),
                          },
                        ]);
                        isAiAnimatingRef.current = true;
                        setIsAiAnimating(true);
                      }
                    }}
                  >
                    <span className="gina-chat-card__doc-action-item-label">{item.label}</span>
                    {item.hint ? (
                      <span className="gina-chat-card__doc-action-item-hint">{item.hint}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="gina-chat-card__actions-footer-row">
              <button
                type="button"
                className={
                  "gina-chat-card__more-actions"
                  + (moreActionsEnabled ? " is-enabled" : "")
                  + (docActionsMenuOpen ? " is-open" : "")
                }
                disabled={!moreActionsEnabled}
                aria-disabled={!moreActionsEnabled}
                aria-expanded={moreActionsEnabled ? docActionsMenuOpen : false}
                aria-haspopup="menu"
                aria-label={
                  labels.moreActionsAria
                  || (chipLocale === "en"
                    ? "Select document options"
                    : "Seleccionar opciones del documento")
                }
                title={
                  moreActionsEnabled
                    ? undefined
                    : (labels.moreActionsDisabledHint
                      || (chipLocale === "en"
                        ? "Choose “Something else” above to unlock options"
                        : "Elige «Algo más» arriba para desbloquear opciones"))
                }
                onClick={() => {
                  if (!moreActionsEnabled) return;
                  setDocActionsMenuOpen((open) => {
                    const next = !open;
                    if (next) {
                      const actionChips = buildGinaDocActionsMenu({
                        locale: chipLocale,
                        writingEmpty: Boolean(writingEmpty),
                      }).map((item) => ({
                        ...item,
                        text: item.label,
                      }));
                      setMessages((prev) => {
                        const lastAi = [...prev].reverse().find((m) => m.sender === "ai");
                        const hasDocActionChips = Array.isArray(lastAi?.chips)
                          && lastAi.chips.some((c) => c?.kind === "doc_action");
                        if (hasDocActionChips) {
                          // Restore chips on last AI turn if they were stashed.
                          return prev.map((m) => {
                            if (m !== lastAi) return m;
                            if (Array.isArray(m.chips) && m.chips.some((c) => c?.kind === "doc_action")) {
                              return m;
                            }
                            if (Array.isArray(m.chipsRestorable)
                              && m.chipsRestorable.some((c) => c?.kind === "doc_action")) {
                              return {
                                ...m,
                                chips: m.chipsRestorable,
                                chipsRestorable: null,
                                refineRevealed: true,
                              };
                            }
                            return {
                              ...m,
                              chips: actionChips,
                              refineRevealed: true,
                            };
                          });
                        }
                        return [
                          ...prev,
                          {
                            id: makeMsgId(),
                            sender: "ai",
                            text: chipLocale === "en"
                              ? "Here are the actions I can run on this document:"
                              : "Estas son las acciones que puedo correr en este documento:",
                            visualization: null,
                            chips: actionChips,
                            refineRevealed: true,
                          },
                        ];
                      });
                      isAiAnimatingRef.current = false;
                      setIsAiAnimating(false);
                    }
                    return next;
                  });
                }}
              >
                {labels.moreActions || (chipLocale === "en" ? "Select options" : "Seleccionar opciones")}
              </button>
              <div
                className="gina-chat-card__composer gina-chat-card__composer--locked"
                title={
                  labels.composerLockedHint
                  || (chipLocale === "en"
                    ? "Typing and dictation stay locked here — use Select options"
                    : "Escribir y dictar quedan bloqueados aquí — usa Seleccionar opciones")
                }
              >
                <textarea
                  ref={inputRef}
                  className="gina-chat-card__input"
                  placeholder={placeholder}
                  value=""
                  rows={1}
                  disabled
                  readOnly
                  tabIndex={-1}
                  aria-disabled="true"
                  aria-label={labels.messageAria || "Message Gina"}
                />
                <button
                  type="button"
                  className="gina-chat-card__mic"
                  disabled
                  tabIndex={-1}
                  aria-disabled="true"
                  aria-label={micTitle}
                  title={micTitle}
                >
                  <MicIcon />
                </button>
                <button
                  type="button"
                  className="gina-chat-card__send"
                  disabled
                  tabIndex={-1}
                  aria-disabled="true"
                  aria-label={labels.sendAria || "Send"}
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
        ) : isListening ? (
          <div
            ref={dictationRef}
            className={`gina-chat-card__dictation${deletePhraseArmed ? " is-delete-armed" : ""}`}
            role="status"
            aria-live="polite"
          >
            <button
              type="button"
              className="gina-chat-card__mic is-listening"
              onClick={cancelDictation}
              aria-label={micTitle}
              title={micTitle}
            >
              <MicIcon />
            </button>
            <div className="gina-chat-card__dictation-main">
              <DictationWaves active={isHearing} />
              {deletePhraseHint ? (
                <p className="gina-chat-card__dictation-hint">{deletePhraseHint}</p>
              ) : null}
              <p className="gina-chat-card__dictation-text">
                {liveDictation
                  || (deletePhraseArmed
                    ? (labels.deletePhraseArmed || "Borrar: di el texto que quieres quitar (o cancelar).")
                    : (labels.listeningHold || "Listening… speak freely. Say “borrar”, then the text to remove."))}
              </p>
            </div>
            <button
              type="button"
              className="gina-chat-card__insert gina-chat-card__insert--dictation"
              onClick={insertDictation}
              disabled={!liveDictation.trim()}
              aria-label={dictationInsertTitle}
              title={dictationInsertTitle}
            >
              <InsertIcon />
            </button>
          </div>
        ) : (
          <div className="gina-chat-card__composer">
            <textarea
              ref={inputRef}
              className="gina-chat-card__input"
              placeholder={placeholder}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                if (micError) setMicError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              aria-label={labels.messageAria || "Message Gina"}
            />
            <button
              type="button"
              className="gina-chat-card__mic"
              onClick={startDictation}
              disabled={!recognitionSupported}
              aria-label={micTitle}
              title={micTitle}
            >
              <MicIcon />
            </button>
            <button
              type="button"
              className="gina-chat-card__send"
              onClick={handleSend}
              aria-label={labels.sendAria || "Send"}
            >
              <SendIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GinaChatCard;
