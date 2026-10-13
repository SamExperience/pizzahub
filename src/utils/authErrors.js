// Maps Firebase Auth errors to user-facing messages.
// Returns null when nothing should be shown (e.g. the user closed the popup).

const MESSAGES = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/user-not-found": "Invalid email or password.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed":
    "Network error. Check your connection and try again.",
  "auth/popup-closed-by-user": null,
  "auth/cancelled-popup-request": null,
};

const DEFAULT_MESSAGE = "Something went wrong. Please try again.";

export function getAuthErrorMessage(error) {
  const code = error?.code;
  if (typeof code === "string" && Object.hasOwn(MESSAGES, code)) {
    return MESSAGES[code];
  }
  return DEFAULT_MESSAGE;
}
