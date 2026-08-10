/**
 * React hook: whether Gina unlocked occupied-hour strikethrough for today.
 */

import { useSyncExternalStore } from "react";
import {
  isOccupiedStrikethroughActive,
  subscribeOccupiedStrikethrough,
} from "../lib/gina/ginaOccupiedHoursStore.js";

/**
 * @param {string} [userId]
 * @returns {boolean}
 */
export function useGinaOccupiedStrikethroughActive(userId) {
  const uid = String(userId || "anon").trim() || "anon";
  return useSyncExternalStore(
    subscribeOccupiedStrikethrough,
    () => isOccupiedStrikethroughActive(uid),
    () => false,
  );
}
