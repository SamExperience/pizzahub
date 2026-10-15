/**
 * Picks the message to show for an error. Validation errors of the services
 * are readable messages (plain Errors); Firebase and Storage errors carry a
 * code and get the fallback text instead, so raw SDK messages never reach
 * the UI.
 * @param {*} err
 * @param {string} [fallback]
 * @returns {string}
 * @example
 * getErrorMessage(new Error("Product name is required")); // "Product name is required"
 * getErrorMessage({ code: "permission-denied" }); // "Something went wrong. Please try again."
 */
export const getErrorMessage = (
  err,
  fallback = "Something went wrong. Please try again.",
) => (err instanceof Error && !err.code ? err.message : fallback);
