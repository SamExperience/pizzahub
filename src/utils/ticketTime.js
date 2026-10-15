// Scheduled time helpers for the ticket form (time-only input on today's date).

const pad = (value) => String(value).padStart(2, "0");

/**
 * Default scheduled time: now + 30 minutes, as "HH:MM". The Order is on
 * today's date, so after 23:29 the default is capped at 23:59 instead of
 * wrapping to the early hours (a time in the past for today).
 * @param {Date} [now]
 * @returns {string}
 * @example
 * getDefaultScheduledTime(new Date(2026, 9, 15, 18, 40)); // "19:10"
 * getDefaultScheduledTime(new Date(2026, 9, 15, 23, 45)); // "23:59"
 */
export const getDefaultScheduledTime = (now = new Date()) => {
  const date = new Date(now.getTime() + 30 * 60 * 1000);

  if (date.getDate() !== now.getDate()) return "23:59";

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Converts a Firestore Timestamp or Date into the "HH:MM" value of the time
 * input (edit mode prefill); empty string when missing.
 * @param {(Timestamp|Date|null)} value
 * @returns {string}
 * @example
 * dateToTime(new Date(2026, 9, 15, 9, 5)); // "09:05"
 */
export const dateToTime = (value) => {
  const date = value?.toDate ? value.toDate() : value;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Converts an "HH:MM" value into a Date on today's day, because tickets are
 * always for the current day; null when the value is invalid.
 * @param {string} time
 * @param {Date} [now]
 * @returns {?Date}
 * @example
 * timeToDate("19:30"); // today at 19:30
 * timeToDate("25:00"); // null
 */
export const timeToDate = (time, now = new Date()) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time ?? "");

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
};
