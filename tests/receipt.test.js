import { describe, expect, it, vi } from "vitest";
import { formatReceipt, RECEIPT_WIDTH, wrapText } from "../src/utils/receipt";

vi.mock("../src/services/firebase", () => ({ db: {} }));

const printedAt = new Date(2026, 9, 15, 19, 5);

const takeawayOrder = {
  orderType: "takeaway",
  scheduledTime: new Date(2026, 9, 15, 19, 30),
  total: 25,
  items: [
    {
      productName: "Margherita",
      size: "Large",
      cookingLevel: "Well done",
      customizations: ["No basil"],
      quantity: 2,
      subtotal: 21,
    },
    { productName: "Water", customizations: [], quantity: 2, subtotal: 4 },
  ],
};

const customer = {
  firstName: "Mario",
  lastName: "Rossi",
  phone: "333 1234567",
  address: { street: "Via Roma", streetNumber: "5", postalCode: "00100", city: "Roma" },
};

const receiptLines = (props) =>
  formatReceipt({ storeName: "Pizzeria Bella", printedAt, customer, ...props }).split("\n");

describe("wrapText", () => {
  it("wraps on spaces and cuts words longer than a line", () => {
    expect(wrapText("one two three", 8)).toEqual(["one two", "three"]);
    expect(wrapText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
    expect(wrapText("", 8)).toEqual([]);
  });
});

describe("formatReceipt", () => {
  it("keeps every line within the 58mm width", () => {
    const lines = receiptLines({
      order: {
        ...takeawayOrder,
        orderType: "delivery",
        items: [
          {
            productName: "Extraordinarily long special pizza of the house",
            customizations: ["A very long customization that needs several lines"],
            quantity: 10,
            subtotal: 1234.5,
          },
        ],
      },
    });

    lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(RECEIPT_WIDTH));
  });

  it("starts with the centered store name and the print time", () => {
    const [store, time] = receiptLines({ order: takeawayOrder });

    expect(store.trim()).toBe("Pizzeria Bella");
    expect(store.startsWith(" ".repeat(9))).toBe(true);
    expect(time.trim()).toBe("15.10.2026 19:05");
  });

  it("shows the order type with the pickup time and only the takeaway customer's name", () => {
    const lines = receiptLines({ order: takeawayOrder });

    expect(lines).toContain(`TAKEAWAY${" ".repeat(12)}Pickup 19:30`);
    expect(lines).toContain("Mario Rossi");
    expect(lines.join("\n")).not.toContain("333 1234567");
    expect(lines.join("\n")).not.toContain("Via Roma");
  });

  it("adds phone and address for a delivery", () => {
    const lines = receiptLines({ order: { ...takeawayOrder, orderType: "delivery" } });

    expect(lines.some((line) => line.startsWith("DELIVERY") && line.endsWith("Delivery 19:30"))).toBe(
      true,
    );
    expect(lines).toContain("Tel. 333 1234567");
    expect(lines).toContain("Via Roma 5, 00100 Roma");
  });

  it("lists items with right-aligned prices, options and customizations, then the total", () => {
    const lines = receiptLines({ order: takeawayOrder });

    expect(lines).toContain(`2 x Margherita${" ".repeat(12)}€21.00`);
    expect(lines).toContain("  Large · Well done");
    expect(lines).toContain("  + No basil");
    expect(lines).toContain(`2 x Water${" ".repeat(18)}€4.00`);
    expect(lines.at(-1)).toBe(`TOTAL${" ".repeat(21)}€25.00`);
  });

  it("wraps a long product name and keeps the price on the first line", () => {
    const lines = receiptLines({
      order: {
        ...takeawayOrder,
        items: [
          {
            productName: "Quattro stagioni with extra toppings",
            customizations: [],
            quantity: 1,
            subtotal: 14,
          },
        ],
      },
    });
    const first = lines.findIndex((line) => line.startsWith("1 x"));

    expect(lines[first]).toMatch(/^1 x Quattro stagioni with +€14\.00$/);
    expect(lines[first + 1]).toBe("extra toppings");
  });

  it("leaves out the customer block when the Customer is unavailable", () => {
    const lines = receiptLines({ order: takeawayOrder, customer: null });

    expect(lines.join("\n")).not.toContain("Mario");
    expect(lines[4]).toBe("-".repeat(RECEIPT_WIDTH));
  });

  it("accepts a Firestore Timestamp as scheduled time", () => {
    const lines = receiptLines({
      order: { ...takeawayOrder, scheduledTime: { toDate: () => takeawayOrder.scheduledTime } },
    });

    expect(lines.some((line) => line.endsWith("Pickup 19:30"))).toBe(true);
  });
});
