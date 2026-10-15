// Validation errors of the services are readable messages (plain Errors);
// Firebase and Storage errors carry a code and get the fallback text instead,
// so raw SDK messages never reach the UI.
export const getErrorMessage = (
  err,
  fallback = "Something went wrong. Please try again.",
) => (err instanceof Error && !err.code ? err.message : fallback);
