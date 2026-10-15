// Shared text checks used by the services. Services trim and compare the
// trimmed length, so the limits match what the Firestore rules receive.

/**
 * Throws when a text is longer than `max` characters. Null and non-strings
 * are allowed: optional fields are checked by the caller.
 * @param {*} value
 * @param {number} max
 * @param {string} label - Field name used in the message.
 * @returns {void}
 * @example
 * assertMaxLength("Margherita", FIELD_LIMITS.NAME, "Product name");
 */
export const assertMaxLength = (value, max, label) => {
  if (typeof value === "string" && value.length > max)
    throw new Error(`${label} must be at most ${max} characters`);
};

/**
 * Returns the trimmed non-empty string; throws when blank or longer than
 * `max`, so "   " never passes as a valid name.
 * @param {*} value
 * @param {number} max
 * @param {string} label
 * @returns {string}
 * @example
 * requireText("  Lugano ", 100, "City"); // "Lugano"
 */
export const requireText = (value, max, label) => {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) throw new Error(`${label} is required`);
  assertMaxLength(text, max, label);

  return text;
};

/**
 * Returns the trimmed string, or null when blank or not a string (stored as
 * null rather than ""); throws when longer than `max`.
 * @param {*} value
 * @param {number} max
 * @param {string} label
 * @returns {?string}
 * @example
 * optionalText("  ", 20, "Street number"); // null
 */
export const optionalText = (value, max, label) => {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) return null;
  assertMaxLength(text, max, label);

  return text;
};

/**
 * Throws when a list has more than `max` elements (the rules cap lists too).
 * @param {Array} list
 * @param {number} max
 * @param {string} label
 * @returns {void}
 * @example
 * assertMaxItems(items, FIELD_LIMITS.LIST_SIZE, "Order");
 */
export const assertMaxItems = (list, max, label) => {
  if (list.length > max)
    throw new Error(`${label} must have at most ${max} elements`);
};
