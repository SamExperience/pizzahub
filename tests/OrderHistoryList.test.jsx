import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrderHistoryList from "../src/components/OrderHistoryList";

vi.mock("../src/services/firebase", () => ({ db: {} }));

const at = (hours, minutes) => new Date(2026, 9, 9, hours, minutes);

const customers = new Map([
  [
    "c1",
    {
      id: "c1",
      firstName: "Mario",
      lastName: "Rossi",
      phone: "333 1234567",
      address: {
        street: "Via Roma",
        streetNumber: "12",
        postalCode: "09100",
        city: "Cagliari",
      },
    },
  ],
]);

const orders = [
  {
    id: "o2",
    customerId: "c1",
    orderType: "delivery",
    status: "Cancelled",
    total: 20,
    createdAt: at(12, 45),
    scheduledTime: at(13, 30),
    completedAt: null,
    items: [],
  },
  {
    id: "o1",
    customerId: "c1",
    orderType: "takeaway",
    status: "Completed",
    total: 12.5,
    createdAt: at(11, 5),
    scheduledTime: at(11, 40),
    completedAt: at(11, 55),
    items: [
      {
        productId: "p1",
        productName: "Margherita",
        quantity: 2,
        size: "Large",
        cookingLevel: "Well done",
        customizations: ["Extra cheese", "No basil"],
        subtotal: 12.5,
      },
    ],
  },
  {
    id: "o3",
    customerId: "ghost",
    orderType: "takeaway",
    status: "Pending",
    total: 5,
    createdAt: at(10, 0),
    scheduledTime: at(10, 30),
    items: [],
  },
];

const renderList = () =>
  render(<OrderHistoryList orders={orders} customers={customers} />);
const toggles = () => screen.getAllByRole("button");
const detailOf = (toggle) =>
  within(document.getElementById(toggle.getAttribute("aria-controls")));

describe("OrderHistoryList detail", () => {
  afterEach(cleanup);

  it("keeps every row collapsed by default", () => {
    renderList();

    toggles().forEach((toggle) =>
      expect(toggle.getAttribute("aria-expanded")).toBe("false"),
    );
    expect(screen.queryByText("2 x Margherita")).toBeNull();
  });

  it("expands the items, customer, times and total of a row", async () => {
    renderList();

    await userEvent.click(toggles()[1]);

    expect(toggles()[1].getAttribute("aria-expanded")).toBe("true");
    const view = detailOf(toggles()[1]);
    expect(view.getByText("2 x Margherita")).toBeTruthy();
    expect(
      view.getByText("Large · Well done · Extra cheese · No basil"),
    ).toBeTruthy();
    expect(view.getAllByText("€12.50")).toHaveLength(2);
    expect(view.getByText("Mario Rossi")).toBeTruthy();
    expect(view.getByText("333 1234567")).toBeTruthy();
    expect(view.queryByText(/Via Roma/)).toBeNull();
    expect(view.getByText("Created")).toBeTruthy();
    expect(view.getByText("Scheduled")).toBeTruthy();
    expect(view.getByText("Completed")).toBeTruthy();
    expect(view.queryByText("—")).toBeNull();
    expect(view.getByText("Total")).toBeTruthy();
  });

  it("shows the Delivery address and a dash for a missing completion time", async () => {
    renderList();

    await userEvent.click(toggles()[0]);

    const view = detailOf(toggles()[0]);
    expect(view.getByText("Via Roma 12, 09100 Cagliari")).toBeTruthy();
    expect(view.getByText("—")).toBeTruthy();
    expect(view.getByText("€20.00")).toBeTruthy();
  });

  it("keeps a Cancelled row greyed and expandable", async () => {
    renderList();

    await userEvent.click(toggles()[0]);

    expect(toggles()[0].getAttribute("aria-expanded")).toBe("true");
    expect(toggles()[0].closest("li").className).toContain("opacity-60");
  });

  it("opens one row at a time and collapses on a second click", async () => {
    renderList();

    await userEvent.click(toggles()[0]);
    await userEvent.click(toggles()[1]);

    expect(toggles()[0].getAttribute("aria-expanded")).toBe("false");
    expect(toggles()[1].getAttribute("aria-expanded")).toBe("true");

    await userEvent.click(toggles()[1]);

    expect(toggles()[1].getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("2 x Margherita")).toBeNull();
  });

  it("shows Customer unavailable in the detail of a missing customer", async () => {
    renderList();

    await userEvent.click(toggles()[2]);

    expect(detailOf(toggles()[2]).getAllByText("Customer unavailable")).toHaveLength(1);
  });
});
