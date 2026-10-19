import { ORDER_TYPE } from "../services/order.service";
import { formatAddress, formatPrice } from "./format";
import { ORDER_TYPE_LABEL } from "./orderType";

// Plain-text receipt for a 58mm thermal printer (32 characters per line),
// shown in the print preview until a real printer is connected.

/**
 * Characters per line of a 58mm thermal printer.
 * @type {number}
 * @example
 * "-".repeat(RECEIPT_WIDTH);
 */
export const RECEIPT_WIDTH = 32;

const SEPARATOR = "-".repeat(RECEIPT_WIDTH);
// Indent of the option and customization lines under an item.
const DETAIL_INDENT = "  ";

/**
 * Converts a Firestore Timestamp into a Date; any other value is returned
 * unchanged.
 * @private
 * @param {(Timestamp|Date|null)} value
 * @returns {(Date|null)}
 * @example
 * toDate(order.scheduledTime); // Date
 */
const toDate = (value) => (value?.toDate ? value.toDate() : value);

/**
 * Converts a value to a string padded to two digits with leading zeros.
 * @private
 * @param {(number|string)} value
 * @returns {string}
 * @example
 * pad2(5); // "05"
 */
const pad2 = (value) => String(value).padStart(2, "0");

// Fixed formats instead of the device locale, so the receipt width is
// predictable on every printer.
/**
 * Formats the time of a Date as "HH:MM".
 * @private
 * @param {Date} date
 * @returns {string}
 * @example
 * formatClock(new Date(2026, 9, 15, 9, 5)); // "09:05"
 */
const formatClock = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/**
 * Formats the day of a Date as "DD.MM.YYYY".
 * @private
 * @param {Date} date
 * @returns {string}
 * @example
 * formatDay(new Date(2026, 9, 5)); // "05.10.2026"
 */
const formatDay = (date) =>
  `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;

/**
 * Checks whether a value is a Date holding a valid time.
 * @private
 * @param {*} date
 * @returns {boolean}
 * @example
 * isValidDate(new Date("invalid")); // false
 */
const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

/**
 * Splits text into lines of at most width characters, on spaces when
 * possible; words longer than a line are cut, because a thermal printer
 * would otherwise wrap them unpredictably.
 * @param {string} text
 * @param {number} [width]
 * @returns {string[]}
 * @example
 * wrapText("Pizza Margherita", 8); // ["Pizza", "Margheri", "ta"]
 */
export const wrapText = (text, width = RECEIPT_WIDTH) => {
  const lines = [];
  let line = "";

  for (const word of String(text ?? "").split(/\s+/).filter(Boolean)) {
    let rest = word;

    while (rest.length > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }

    if (!line) line = rest;
    else if (line.length + 1 + rest.length <= width) line = `${line} ${rest}`;
    else {
      lines.push(line);
      line = rest;
    }
  }

  if (line) lines.push(line);

  return lines;
};

/**
 * Centers text on a RECEIPT_WIDTH line by padding it on the left; trailing
 * spaces are removed, and text longer than a line is left unpadded.
 * @private
 * @param {string} text
 * @returns {string}
 * @example
 * center("TOTAL"); // "             TOTAL"
 */
const center = (text) => {
  const space = Math.max(0, RECEIPT_WIDTH - text.length);

  return `${" ".repeat(Math.floor(space / 2))}${text}`.trimEnd();
};

// Left text wrapped next to a right-aligned value on the first line.
/**
 * Wraps the left text so the right value fits after it, then right-aligns
 * the value on the first line; further lines hold the rest of the text.
 * @private
 * @param {string} left
 * @param {string} right
 * @returns {string[]}
 * @example
 * leftRight("TOTAL", "€12.50"); // ["TOTAL                     €12.50"]
 */
const leftRight = (left, right) => {
  const [first = "", ...rest] = wrapText(left, RECEIPT_WIDTH - right.length - 1);
  const gap = RECEIPT_WIDTH - first.length - right.length;

  return [`${first}${" ".repeat(gap)}${right}`, ...rest];
};

/**
 * Wraps text into detail lines indented by DETAIL_INDENT, each at most
 * RECEIPT_WIDTH long.
 * @private
 * @param {string} text
 * @returns {string[]}
 * @example
 * indented("Large · Well done"); // ["  Large · Well done"]
 */
const indented = (text) =>
  wrapText(text, RECEIPT_WIDTH - DETAIL_INDENT.length).map((line) => `${DETAIL_INDENT}${line}`);

/**
 * Builds the centered header lines: the store name, then the print day and
 * time; the time line is omitted when printedAt is not a valid Date.
 * @private
 * @param {string} storeName
 * @param {Date} printedAt
 * @returns {string[]}
 * @example
 * headerLines("Bella Napoli", new Date());
 */
const headerLines = (storeName, printedAt) => [
  ...wrapText(storeName).map(center),
  ...(isValidDate(printedAt) ? [center(`${formatDay(printedAt)} ${formatClock(printedAt)}`)] : []),
];

/**
 * Builds the order type line in upper case, with the Delivery or Pickup
 * scheduled time right-aligned; only the label when the time is missing or
 * invalid.
 * @private
 * @param {object} order
 * @returns {string[]}
 * @example
 * orderLines(order); // ["DELIVERY          Delivery 19:30"]
 */
const orderLines = (order) => {
  const isDelivery = order.orderType === ORDER_TYPE.DELIVERY;
  const label = (ORDER_TYPE_LABEL[order.orderType] ?? order.orderType ?? "").toUpperCase();
  const scheduled = toDate(order.scheduledTime);

  return isValidDate(scheduled)
    ? leftRight(label, `${isDelivery ? "Delivery" : "Pickup"} ${formatClock(scheduled)}`)
    : wrapText(label);
};

// Customer name, plus phone and address for a Delivery; nothing when the
// Customer is unavailable.
/**
 * Builds the wrapped Customer lines: full name, plus phone (when present)
 * and address for a Delivery; empty when the Customer is null.
 * @private
 * @param {?object} customer
 * @param {string} orderType
 * @returns {string[]}
 * @example
 * customerLines(null, "takeaway"); // []
 */
const customerLines = (customer, orderType) => {
  if (!customer) return [];

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
  const lines = wrapText(name);

  if (orderType === ORDER_TYPE.DELIVERY) {
    if (customer.phone) lines.push(...wrapText(`Tel. ${customer.phone}`));
    lines.push(...wrapText(formatAddress(customer.address)));
  }

  return lines;
};

/**
 * Builds the lines of an Order item: quantity and product name with the
 * right-aligned subtotal, then indented size and cooking level, then one
 * indented "+ " line per customization.
 * @private
 * @param {object} item
 * @returns {string[]}
 * @example
 * order.items.flatMap(itemLines);
 */
const itemLines = (item) => {
  const options = [item.size, item.cookingLevel].filter(Boolean).join(" · ");

  return [
    ...leftRight(`${item.quantity} x ${item.productName}`, formatPrice(item.subtotal)),
    ...(options ? indented(options) : []),
    ...(item.customizations ?? []).flatMap((text) => indented(`+ ${text}`)),
  ];
};

/**
 * Builds the plain-text receipt of an Order: store, print time, order type
 * and scheduled time, customer, items with options and customizations,
 * total. Pure function (no printer, no DOM), so the same text can be shown
 * in the preview today and sent to a printer later.
 * @param {object} data
 * @param {string} data.storeName
 * @param {object} data.order
 * @param {?object} [data.customer] - Customer, or null when unavailable.
 * @param {Date} data.printedAt
 * @returns {string} Lines joined by "\n", each at most RECEIPT_WIDTH long.
 * @example
 * const text = formatReceipt({ storeName: "Bella Napoli", order, customer, printedAt: new Date() });
 */
export const formatReceipt = ({ storeName, order, customer = null, printedAt }) => {
  const customerBlock = customerLines(customer, order.orderType);

  return [
    ...headerLines(storeName ?? "", printedAt),
    SEPARATOR,
    ...orderLines(order),
    ...customerBlock,
    SEPARATOR,
    ...(order.items ?? []).flatMap(itemLines),
    SEPARATOR,
    ...leftRight("TOTAL", formatPrice(order.total)),
  ].join("\n");
};
