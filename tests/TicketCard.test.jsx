import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketCard from "../src/components/TicketCard";

vi.mock("../src/services/firebase", () => ({ db: {} }));

const mocks = vi.hoisted(() => ({ getCustomer: vi.fn() }));

vi.mock("../src/services/customer.service", () => ({
  getCustomer: mocks.getCustomer,
}));

const baseOrder = {
  id: "o1",
  customerId: "c1",
  orderType: "takeaway",
  scheduledTime: new Date(2026, 9, 9, 19, 30),
  status: "Pending",
  total: 21,
  items: [
    {
      productId: "p1",
      productName: "Margherita",
      size: "Large",
      cookingLevel: "Well done",
      customizations: ["No basil"],
      quantity: 2,
      unitPrice: 10.5,
      subtotal: 21,
    },
  ],
};

const customer = {
  id: "c1",
  firstName: "Mario",
  lastName: "Rossi",
  phone: "333 1234567",
  address: { street: "Via Roma", streetNumber: "5", postalCode: "00100", city: "Roma" },
};

describe("TicketCard", () => {
  beforeEach(() => {
    mocks.getCustomer.mockReset();
    mocks.getCustomer.mockResolvedValue(customer);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows order type, items, total and status", async () => {
    render(<TicketCard order={baseOrder} />);

    expect(screen.getByText("Takeaway")).toBeTruthy();
    expect(screen.getByText("2 x Margherita")).toBeTruthy();
    expect(screen.getByText("Large · Well done · No basil")).toBeTruthy();
    expect(screen.getAllByText("€21.00")).toHaveLength(2);
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(await screen.findByText("Mario Rossi")).toBeTruthy();
    expect(mocks.getCustomer).toHaveBeenCalledWith("c1");
  });

  it("hides phone and address for takeaway", async () => {
    render(<TicketCard order={baseOrder} />);

    await screen.findByText("Mario Rossi");
    expect(screen.queryByText("333 1234567")).toBeNull();
    expect(screen.queryByText(/Via Roma/)).toBeNull();
  });

  it("shows phone and address for delivery", async () => {
    render(<TicketCard order={{ ...baseOrder, orderType: "delivery" }} />);

    expect(screen.getByText("Delivery")).toBeTruthy();
    expect(await screen.findByText("333 1234567")).toBeTruthy();
    expect(screen.getByText("Via Roma 5, 00100 Roma")).toBeTruthy();
  });

  it("shows a fallback when the customer is missing", async () => {
    mocks.getCustomer.mockResolvedValue(null);
    render(<TicketCard order={baseOrder} />);

    expect(await screen.findByText("Customer unavailable")).toBeTruthy();
  });

  it("shows a fallback when the customer cannot be loaded", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.getCustomer.mockRejectedValue(new Error("boom"));
    render(<TicketCard order={baseOrder} />);

    expect(await screen.findByText("Customer unavailable")).toBeTruthy();
  });
});
