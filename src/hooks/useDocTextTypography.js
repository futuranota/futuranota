import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DOC_TEXT_TYPOGRAPHY_ID,
  docTextTypographyCssVars,
  getDocTextTypographyPreset,
} from "../lib/docTextTypography.js";

const STORAGE_PREFIX = "futuranota:text-typography:";

function readStoredTypographyId(storageKey) {
  if (!storageKey || typeof localStorage === "undefined") {
    return DEFAULT_DOC_TEXT_TYPOGRAPHY_ID;
  }
  const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
  return stored === "legacy" || stored === "normal" ? stored : DEFAULT_DOC_TEXT_TYPOGRAPHY_ID;
}

export function useDocTextTypography(storageKey = null) {
  const [typographyId, setTypographyId] = useState(() => readStoredTypographyId(storageKey));

  useEffect(() => {
    setTypographyId(readStoredTypographyId(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof localStorage === "undefined") return;
    localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, typographyId);
  }, [storageKey, typographyId]);

  const typographyStyle = useMemo(
    () => docTextTypographyCssVars(getDocTextTypographyPreset(typographyId)),
    [typographyId],
  );

  return { typographyId, setTypographyId, typographyStyle };
}
