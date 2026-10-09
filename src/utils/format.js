// Display helpers shared by the UI.

export const formatPrice = (value) => `€${Number(value ?? 0).toFixed(2)}`;

// HH:mm from a Firestore Timestamp (or Date); empty string when missing.
export const formatTime = (timestamp) => {
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
