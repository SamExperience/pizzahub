// Scheduled time helpers for the ticket form (time-only input on today's date).

const pad = (value) => String(value).padStart(2, "0");

// Default scheduled time: now + 30 minutes, as "HH:MM". The Order is on
// today's date, so after 23:29 the default is capped at 23:59 instead of
// wrapping to the early hours (a time in the past for today).
export const getDefaultScheduledTime = (now = new Date()) => {
  const date = new Date(now.getTime() + 30 * 60 * 1000);

  if (date.getDate() !== now.getDate()) return "23:59";

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// "HH:MM" of a Firestore Timestamp or Date; empty string when missing.
export const dateToTime = (value) => {
  const date = value?.toDate ? value.toDate() : value;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Date on today's day for an "HH:MM" value; null when the value is invalid.
export const timeToDate = (time, now = new Date()) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time ?? "");

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
};
