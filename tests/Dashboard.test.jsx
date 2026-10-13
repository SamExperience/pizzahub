import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../src/pages/Dashboard";

vi.mock("../src/services/firebase", () => ({ db: {} }));

const mocks = vi.hoisted(() => ({
  getOrders: vi.fn(),
  getCustomers: vi.fn(),
  store: { selectedStore: { id: "store-1", companyId: "company-1" } },
}));

vi.mock("../src/services/order.service", async (importOriginal) => ({
  ...(await importOriginal()),
  getOrdersByDay: mocks.getOrders,
}));

vi.mock("../src/services/customer.service", async (importOriginal) => ({
  ...(await importOriginal()),
  getCustomersByCompanyId: mocks.getCustomers,
}));

vi.mock("../src/contexts/StoreContext", () => ({
  useStore: () => mocks.store,
}));

const pad = (value) => String(value).padStart(2, "0");
const toValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const today = new Date();
const todayValue = toValue(today);
const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

const at = (hours, minutes) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);

const customers = [
  { id: "c1", firstName: "Mario", lastName: "Rossi" },
  { id: "c2", firstName: "Anna", lastName: "Verdi" },
];

// Newest first, as returned by the service.
const orders = [
  { id: "o2", customerId: "c2", orderType: "delivery", status: "Cancelled", total: 20, createdAt: at(12, 45) },
  { id: "o1", customerId: "c1", orderType: "takeaway", status: "Pending", total: 12.5, createdAt: at(11, 5) },
];

const orderRows = () =>
  within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");

const flush = () => act(async () => {});

const renderDashboard = async () => {
  render(<Dashboard />);
  await flush();
};

const changeDay = (value) =>
  fireEvent.change(screen.getByLabelText("Day"), { target: { value } });

describe("Dashboard page", () => {
  beforeEach(() => {
    mocks.store.selectedStore = { id: "store-1", companyId: "company-1" };
    mocks.getOrders.mockReset();
    mocks.getOrders.mockResolvedValue(orders);
    mocks.getCustomers.mockReset();
    mocks.getCustomers.mockResolvedValue(customers);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the section sidebar with Order history selected by default", async () => {
    await renderDashboard();

    const nav = screen.getByRole("navigation", { name: "Dashboard sections" });
    const item = within(nav).getByRole("button", { name: "Order history" });
    expect(item.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Order history" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Orders" })).toBeTruthy();
  });

  it("defaults the day field to today and limits it to today", async () => {
    await renderDashboard();

    const field = screen.getByLabelText("Day");
    expect(field.value).toBe(todayValue);
    expect(field.max).toBe(todayValue);
  });

  it("reads the orders of the active Store for today on mount", async () => {
    await renderDashboard();

    expect(mocks.getOrders).toHaveBeenCalledOnce();
    const [storeId, date] = mocks.getOrders.mock.calls[0];
    expect(storeId).toBe("store-1");
    expect(toValue(date)).toBe(todayValue);
  });

  it("reads the orders again with the local date when the day changes", async () => {
    await renderDashboard();

    changeDay(toValue(yesterday));
    await flush();

    expect(mocks.getOrders).toHaveBeenCalledTimes(2);
    expect(mocks.getOrders.mock.calls[1][1].getTime()).toBe(yesterday.getTime());
  });

  it("ignores future and empty days", async () => {
    await renderDashboard();

    changeDay(toValue(tomorrow));
    changeDay("");
    await flush();

    expect(screen.getByLabelText("Day").value).toBe(todayValue);
    expect(mocks.getOrders).toHaveBeenCalledOnce();
  });

  it("shows time, customer, order type, status and total, newest first", async () => {
    await renderDashboard();

    const rows = within(screen.getByRole("list", { name: "Orders" })).getAllByRole(
      "listitem",
    );
    expect(rows).toHaveLength(2);

    expect(within(rows[0]).getByText("Anna Verdi")).toBeTruthy();
    expect(within(rows[0]).getByText("Delivery")).toBeTruthy();
    expect(within(rows[0]).getByText("€20.00")).toBeTruthy();
    expect(rows[0].querySelector("time").textContent).not.toBe("");

    expect(within(rows[1]).getByText("Mario Rossi")).toBeTruthy();
    expect(within(rows[1]).getByText("Takeaway")).toBeTruthy();
    expect(within(rows[1]).getByText("Pending")).toBeTruthy();
    expect(within(rows[1]).getByText("€12.50")).toBeTruthy();
  });

  it("greys out a Cancelled row and labels it Cancelled", async () => {
    await renderDashboard();

    const rows = orderRows();
    expect(within(rows[0]).getByText("Cancelled")).toBeTruthy();
    expect(rows[0].className).toContain("opacity-60");
    expect(rows[1].className).not.toContain("opacity-60");
  });

  it("shows the loading state while the orders are read", async () => {
    mocks.getOrders.mockReturnValue(new Promise(() => {}));
    await renderDashboard();

    expect(screen.getByText("Loading ...")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Orders" })).toBeNull();
  });

  it("shows the empty state when there are no orders", async () => {
    mocks.getOrders.mockResolvedValue([]);
    await renderDashboard();

    expect(screen.getByText("No orders on this day.")).toBeTruthy();
  });

  it("shows the error and reads the orders again on Retry", async () => {
    mocks.getOrders.mockRejectedValueOnce(new Error("boom"));
    await renderDashboard();

    expect(screen.getByRole("alert").textContent).toContain("Unable to load the orders");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flush();

    expect(mocks.getOrders).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(orderRows()).toHaveLength(2);
  });

  it("reads the customers once per Company, not on day change", async () => {
    await renderDashboard();

    changeDay(toValue(yesterday));
    await flush();

    expect(mocks.getCustomers).toHaveBeenCalledOnce();
    expect(mocks.getCustomers).toHaveBeenCalledWith("company-1");
  });

  it("shows Customer unavailable for a missing customer", async () => {
    mocks.getOrders.mockResolvedValue([{ ...orders[1], customerId: "ghost" }]);
    await renderDashboard();

    expect(screen.getByText("Customer unavailable")).toBeTruthy();
  });

  it("shows Customer unavailable when the customers fail to load", async () => {
    mocks.getCustomers.mockRejectedValue(new Error("boom"));
    await renderDashboard();

    expect(console.log).toHaveBeenCalledWith(
      "Error loading customers -> ",
      expect.any(Error),
    );
    expect(screen.getAllByText("Customer unavailable")).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores a stale response that arrives after a newer one", async () => {
    let resolveFirst;
    mocks.getOrders.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve)),
    );
    await renderDashboard();

    changeDay(toValue(yesterday));
    await flush();
    expect(orderRows()).toHaveLength(2);

    await act(async () => resolveFirst([orders[1]]));

    expect(orderRows()).toHaveLength(2);
  });
});
