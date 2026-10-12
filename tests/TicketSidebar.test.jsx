import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketSidebar from "../src/components/TicketSidebar";
import { getCategoriesByMenuId } from "../src/services/category.service";
import { getCustomersByCompanyId } from "../src/services/customer.service";
import { getMenuByStoreId } from "../src/services/menu.service";
import { getProductsByCategoryId } from "../src/services/product.service";

vi.mock("../src/services/firebase", () => ({ db: {} }));
vi.mock("../src/services/menu.service", () => ({ getMenuByStoreId: vi.fn() }));
vi.mock("../src/services/category.service", () => ({
  getCategoriesByMenuId: vi.fn(),
}));
vi.mock("../src/services/product.service", () => ({
  getProductsByCategoryId: vi.fn(),
}));
vi.mock("../src/services/customer.service", async (importOriginal) => ({
  ...(await importOriginal()),
  getCustomersByCompanyId: vi.fn(),
}));

const CUSTOMERS = [
  {
    id: "c1",
    firstName: "Mario",
    lastName: "Rossi",
    phone: "333",
    address: { street: "Via Roma", streetNumber: "1", postalCode: "00100", city: "Roma" },
  },
];

describe("TicketSidebar", () => {
  beforeEach(() => {
    getCustomersByCompanyId.mockResolvedValue(CUSTOMERS);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("loads the Company's customers and fills the form from a search result", async () => {
    render(<TicketSidebar companyId="co1" onClose={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Delivery"));
    await userEvent.type(screen.getByLabelText(/First name/), "mar");
    await userEvent.click(await screen.findByRole("button", { name: /Mario/ }));

    expect(getCustomersByCompanyId).toHaveBeenCalledWith("co1");
    expect(screen.getByLabelText(/First name/).value).toBe("Mario");
    expect(screen.getByLabelText("Last name").value).toBe("Rossi");
    expect(screen.getByLabelText(/Phone/).value).toBe("333");
    expect(screen.getByLabelText(/^Street \*/).value).toBe("Via Roma");
  });

  it("shows an error and retries loading the customers", async () => {
    getCustomersByCompanyId.mockRejectedValueOnce(new Error("boom"));
    render(<TicketSidebar companyId="co1" onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(getCustomersByCompanyId).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the dialog with Takeaway selected by default", () => {
    render(<TicketSidebar onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Create ticket" })).toBeTruthy();
    expect(screen.getByLabelText("Takeaway").checked).toBe(true);
    expect(screen.getByLabelText("Delivery").checked).toBe(false);
  });

  it("switches the order type", async () => {
    render(<TicketSidebar onClose={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Delivery"));

    expect(screen.getByLabelText("Delivery").checked).toBe(true);
    expect(screen.getByLabelText("Takeaway").checked).toBe(false);
    expect(screen.getByLabelText("Delivery time")).toBeTruthy();
  });

  it("defaults the scheduled time to now + 30 minutes and lets it be edited", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 12, 10));
    render(<TicketSidebar onClose={vi.fn()} />);

    const time = screen.getByLabelText("Pickup time");

    expect(time.value).toBe("12:40");

    fireEvent.change(time, { target: { value: "13:15" } });

    expect(time.value).toBe("13:15");
  });

  it("opens the menu panel from Add product and closes only the panel on Escape", async () => {
    const onClose = vi.fn();
    getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
    getCategoriesByMenuId.mockResolvedValue([{ id: "cat1", name: "Pizzas" }]);
    getProductsByCategoryId.mockResolvedValue([]);
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Add product" }));

    expect(await screen.findByRole("dialog", { name: "Add product" })).toBeTruthy();
    expect(getMenuByStoreId).toHaveBeenCalledWith("store-1");

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Add product" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the close button, Cancel, Escape and the backdrop", async () => {
    const onClose = vi.fn();
    render(<TicketSidebar onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByTestId("ticket-backdrop"));

    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
