import { describe, expect, it } from "vitest";
import { validateTicketForm } from "../src/utils/ticketValidation";

const NOW = new Date(2026, 9, 12, 12, 10, 30);
const ITEMS = [{ productId: "p1", subtotal: 2 }];
const EMPTY_ADDRESS = { street: "", streetNumber: "", postalCode: "", city: "", country: "" };
const FORM = { firstName: "Anna", lastName: "", phone: "", address: EMPTY_ADDRESS };

const validate = (overrides = {}) =>
  validateTicketForm({
    orderType: "takeaway",
    form: FORM,
    scheduledTime: "12:40",
    items: ITEMS,
    now: NOW,
    ...overrides,
  });

describe("validateTicketForm", () => {
  it("accepts a takeaway ticket with only the first name", () => {
    expect(validate()).toEqual({});
  });

  it("requires the first name", () => {
    expect(validate({ form: { ...FORM, firstName: "  " } }).firstName).toBeTruthy();
  });

  it("requires phone and address for delivery, but not the country", () => {
    const errors = validate({ orderType: "delivery" });

    expect(Object.keys(errors).sort()).toEqual(
      ["city", "phone", "postalCode", "street", "streetNumber"].sort(),
    );
  });

  it("accepts a complete delivery ticket", () => {
    const form = {
      ...FORM,
      phone: "333",
      address: { ...EMPTY_ADDRESS, street: "Via Roma", streetNumber: "1", postalCode: "1", city: "Roma" },
    };

    expect(validate({ orderType: "delivery", form })).toEqual({});
  });

  it("requires at least one item", () => {
    expect(validate({ items: [] }).items).toBeTruthy();
  });

  it("rejects an invalid or past scheduled time and accepts the current minute", () => {
    expect(validate({ scheduledTime: "" }).scheduledTime).toBe("Scheduled time is required");
    expect(validate({ scheduledTime: "12:09" }).scheduledTime).toBe(
      "Scheduled time is in the past",
    );
    expect(validate({ scheduledTime: "12:10" }).scheduledTime).toBeUndefined();
  });
});
