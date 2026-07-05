import { create } from "zustand";

/**
 * @typedef {Object} ConfirmRequest
 * @property {string} title
 * @property {string} message
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 * @property {'danger'|'default'} [tone]
 * @property {(value: boolean) => void} resolve
 */

/** @type {import('zustand').UseBoundStore<import('zustand').StoreApi<{ payload: ConfirmRequest|null, ask: (options: object) => Promise<boolean>, answer: (confirmed: boolean) => void }>>} */
export const useConfirmStore = create((set, get) => ({
  payload: null,

  /**
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.confirmLabel]
   * @param {string} [options.cancelLabel]
   * @param {'danger'|'default'} [options.tone]
   * @returns {Promise<boolean>}
   */
  ask: ({
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "danger",
  }) => new Promise((resolve) => {
    set({
      payload: {
        title,
        message,
        confirmLabel,
        cancelLabel,
        tone,
        resolve,
      },
    });
  }),

  /** @param {boolean} confirmed */
  answer: (confirmed) => {
    const { payload } = get();
    if (!payload) return;
    payload.resolve(confirmed);
    set({ payload: null });
  },
}));
