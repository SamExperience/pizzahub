/**
 * Logs an error in development builds only. Error details help during
 * development but can expose User/Store data in production consoles (and
 * console calls are forbidden by the lint rules elsewhere).
 * @param {string} message
 * @param {*} error
 * @returns {void}
 * @example
 * logError("Error loading the menu -> ", error);
 */
export function logError(message, error) {
  if (import.meta.env.DEV) console.error(message, error);
}
