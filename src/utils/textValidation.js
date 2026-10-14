// Shared text checks used by the services. Services trim and compare the
// trimmed length, so the limits match what the Firestore rules receive.

// Throws when a text is longer than `max` characters. Null is allowed.
export const assertMaxLength = (value, max, label) => {
  if (typeof value === "string" && value.length > max)
    throw new Error(`${label} must be at most ${max} characters`);
};

// Trimmed non-empty string; throws when blank or longer than `max`.
export const requireText = (value, max, label) => {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) throw new Error(`${label} is required`);
  assertMaxLength(text, max, label);

  return text;
};

// Trimmed string, or null when blank or not a string; throws when longer
// than `max`.
export const optionalText = (value, max, label) => {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) return null;
  assertMaxLength(text, max, label);

  return text;
};

// Throws when a list has more than `max` elements.
export const assertMaxItems = (list, max, label) => {
  if (list.length > max)
    throw new Error(`${label} must have at most ${max} elements`);
};
