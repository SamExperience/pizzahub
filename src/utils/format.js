// Display helpers shared by the UI.

/**
 * Formats a price with two decimals; a missing value shows as €0.00 rather
 * than "NaN".
 * @param {?number} value
 * @returns {string}
 * @example
 * formatPrice(12.5); // "€12.50"
 */
export const formatPrice = (value) => `€${Number(value ?? 0).toFixed(2)}`;

/**
 * Formats HH:mm from a Firestore Timestamp (or Date) in the device locale;
 * empty string when missing, so a pending server timestamp renders nothing.
 * @param {(Timestamp|Date|null)} timestamp
 * @returns {string}
 * @example
 * formatTime(order.scheduledTime); // "19:30"
 */
export const formatTime = (timestamp) => {
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/**
 * Formats street and number of an address, skipping missing parts; empty
 * string when missing.
 * @param {?object} address
 * @returns {string}
 * @example
 * formatStreet({ street: "Via Nassa", streetNumber: "5" }); // "Via Nassa 5"
 */
export const formatStreet = (address) =>
  [address?.street, address?.streetNumber].filter(Boolean).join(" ");

/**
 * Formats an address on one line (country omitted: deliveries are local),
 * skipping missing parts.
 * @param {?object} address
 * @returns {string}
 * @example
 * formatAddress({ street: "Via Nassa", streetNumber: "5", postalCode: "6900", city: "Lugano" });
 * // "Via Nassa 5, 6900 Lugano"
 */
export const formatAddress = (address) =>
  [formatStreet(address), [address?.postalCode, address?.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

/**
 * Formats a localized long date from a Firestore Timestamp (or Date); empty
 * string when missing.
 * @param {(Timestamp|Date|null)} timestamp
 * @returns {string}
 * @example
 * formatDate(new Date(2026, 9, 15)); // "15 October 2026" (en-GB)
 */
export const formatDate = (timestamp) => {
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
};
