// Error details help during development but can expose User/Store data in
// production consoles, so they are printed only in dev builds.
export function logError(message, error) {
  if (import.meta.env.DEV) console.error(message, error);
}
