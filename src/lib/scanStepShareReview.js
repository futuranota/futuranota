/**
 * Quick local review for step-playbook share snapshots.
 * Does NOT change status — admin Accept/Reject stays manual.
 *

 * @typedef {'ok' | 'warn' | 'flag'} ScanLevel
 * @typedef {{ id: string, level: ScanLevel, message: string }} ScanFinding
 * @typedef {{ level: ScanLevel, findings: ScanFinding[], summary: string }} ScanReport
 */

const OFFENSIVE_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|cunt|nazi|rape|pedo|nigg)/i,
  /\b(puto|puta|mierda|verga|pendejo|hijueputa|maric[oó]n)/i,
  /\b(kill\s+yourself|kys)\b/i,
];

const LEVEL_RANK = { ok: 0, warn: 1, flag: 2 };

function worstLevel(a, b) {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

function textBlobFromSteps(steps) {
  const parts = [];
  for (const step of steps || []) {
    if (step?.meta) parts.push(String(step.meta));
    if (step?.prompt) parts.push(String(step.prompt));
    if (step?.text) parts.push(String(step.text));
    if (step?.description) parts.push(String(step.description));
  }
  return parts.join("\n");
}

/**
 * @param {{ title?: string, steps?: any[] }} snapshot
 * @returns {ScanReport}
 */
export function scanStepShareSnapshot(snapshot) {
  /** @type {ScanFinding[]} */
  const findings = [];
  const title = String(snapshot?.title ?? "").trim();
  const steps = Array.isArray(snapshot?.steps) ? snapshot.steps : [];
  const blob = `${title}\n${textBlobFromSteps(steps)}`;

  if (!title) {
    findings.push({ id: "empty_title", level: "warn", message: "Title is empty." });
  }

  if (steps.length === 0) {
    findings.push({ id: "no_steps", level: "flag", message: "No steps in the snapshot." });
  }

  let emptyPrompt = 0;
  let emptyMeta = 0;
  let withImages = 0;
  for (const step of steps) {
    const prompt = String(step?.prompt ?? step?.text ?? "").trim();
    const meta = String(step?.meta ?? step?.description ?? "").trim();
    const images = [
      ...(Array.isArray(step?.images) ? step.images : []),
      step?.imageUrl,
      step?.beforeUrl,
      step?.afterUrl,
    ].filter(Boolean);
    if (!prompt) emptyPrompt += 1;
    if (!meta) emptyMeta += 1;
    if (images.length > 0) withImages += 1;
  }

  if (steps.length > 0 && emptyPrompt === steps.length) {
    findings.push({ id: "all_prompts_empty", level: "flag", message: "Every step prompt is empty." });
  } else if (emptyPrompt > 0) {
    findings.push({
      id: "some_prompts_empty",
      level: "warn",
      message: `${emptyPrompt} of ${steps.length} steps have an empty prompt.`,
    });
  }

  if (steps.length > 0 && emptyMeta === steps.length) {
    findings.push({ id: "all_meta_empty", level: "warn", message: "Every step description is empty." });
  }

  if (steps.length > 0 && withImages === 0) {
    findings.push({ id: "no_images", level: "warn", message: "No images attached to any step." });
  }

  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(blob)) {
      findings.push({
        id: "offensive_language",
        level: "flag",
        message: "Possible offensive or prohibited language detected in title/body.",
      });
      break;
    }
  }

  if (/https?:\/\/\S+/i.test(blob) && /password|passwd|api[_-]?key|secret|token\s*[:=]/i.test(blob)) {
    findings.push({
      id: "secrets_hint",
      level: "flag",
      message: "Possible secrets or credentials mentioned near a URL.",
    });
  }

  let level = /** @type {ScanLevel} */ ("ok");
  for (const f of findings) level = worstLevel(level, f.level);

  if (findings.length === 0) {
    findings.push({
      id: "clean",
      level: "ok",
      message: "Quick scan found no obvious policy issues. Still review manually before Accept.",
    });
  }

  const summary =
    level === "ok"
      ? "Looks clear for a quick pass — still eyeball content before Accept."
      : level === "warn"
        ? "Warnings found — review the snapshot before Accept."
        : "Flags found — do not Accept until you check the content.";

  return { level, findings, summary };
}
