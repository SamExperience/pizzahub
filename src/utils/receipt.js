import { ORDER_TYPE } from "../services/order.service";
import { formatAddress, formatPrice } from "./format";
import { ORDER_TYPE_LABEL } from "./orderType";

// Plain-text receipt for a 58mm thermal printer (32 characters per line),
// shown in the print preview until a real printer is connected.

export const RECEIPT_WIDTH = 32;

const SEPARATOR = "-".repeat(RECEIPT_WIDTH);
// Indent of the option and customization lines under an item.
const DETAIL_INDENT = "  ";

const toDate = (value) => (value?.toDate ? value.toDate() : value);

const pad2 = (value) => String(value).padStart(2, "0");

// Fixed formats instead of the device locale, so the receipt width is
// predictable on every printer.
const formatClock = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const formatDay = (date) =>
  `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

// Splits text into lines of at most width characters, on spaces when
// possible; words longer than a line are cut.
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

const center = (text) => {
  const space = Math.max(0, RECEIPT_WIDTH - text.length);

  return `${" ".repeat(Math.floor(space / 2))}${text}`.trimEnd();
};

// Left text wrapped next to a right-aligned value on the first line.
const leftRight = (left, right) => {
  const [first = "", ...rest] = wrapText(left, RECEIPT_WIDTH - right.length - 1);
  const gap = RECEIPT_WIDTH - first.length - right.length;

  return [`${first}${" ".repeat(gap)}${right}`, ...rest];
};

const indented = (text) =>
  wrapText(text, RECEIPT_WIDTH - DETAIL_INDENT.length).map((line) => `${DETAIL_INDENT}${line}`);

const headerLines = (storeName, printedAt) => [
  ...wrapText(storeName).map(center),
  ...(isValidDate(printedAt) ? [center(`${formatDay(printedAt)} ${formatClock(printedAt)}`)] : []),
];

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

const itemLines = (item) => {
  const options = [item.size, item.cookingLevel].filter(Boolean).join(" · ");

  return [
    ...leftRight(`${item.quantity} x ${item.productName}`, formatPrice(item.subtotal)),
    ...(options ? indented(options) : []),
    ...(item.customizations ?? []).flatMap((text) => indented(`+ ${text}`)),
  ];
};

// Receipt text of an Order: store, print time, order type and scheduled
// time, customer, items with options and customizations, total.
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
