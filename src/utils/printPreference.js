// "Print on save" switch of the Create Ticket footer, remembered per device.
// Storage can be unavailable (private mode, blocked data), so every access is
// guarded and the switch falls back to on.

const PRINT_ON_SAVE_KEY = "pizzahub.printOnSave";

/**
 * Reads the "Print on save" preference of this device; on by default and
 * when storage is unavailable.
 * @returns {boolean}
 * @example
 * const [printOnSave, setPrintOnSave] = useState(readPrintOnSave);
 */
export const readPrintOnSave = () => {
  try {
    return localStorage.getItem(PRINT_ON_SAVE_KEY) !== "false";
  } catch {
    return true;
  }
};

/**
 * Remembers the "Print on save" preference on this device (localStorage,
 * not Firestore: each till may have its own printer).
 * @param {boolean} value
 * @returns {void}
 * @example
 * writePrintOnSave(false);
 */
export const writePrintOnSave = (value) => {
  try {
    localStorage.setItem(PRINT_ON_SAVE_KEY, String(Boolean(value)));
  } catch {
    // Persistence is a convenience: ignore storage failures.
  }
};
