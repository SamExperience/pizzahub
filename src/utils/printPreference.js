// "Print on save" switch of the Create Ticket footer, remembered per device.
// Storage can be unavailable (private mode, blocked data), so every access is
// guarded and the switch falls back to on.

const PRINT_ON_SAVE_KEY = "pizzahub.printOnSave";

export const readPrintOnSave = () => {
  try {
    return localStorage.getItem(PRINT_ON_SAVE_KEY) !== "false";
  } catch {
    return true;
  }
};

export const writePrintOnSave = (value) => {
  try {
    localStorage.setItem(PRINT_ON_SAVE_KEY, String(Boolean(value)));
  } catch {
    // Persistence is a convenience: ignore storage failures.
  }
};
