import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketSidebar from "../src/components/TicketSidebar";
import { getCategoriesByMenuId } from "../src/services/category.service";
import { getCustomer, getCustomersByCompanyId } from "../src/services/customer.service";
import { getMenuByStoreId } from "../src/services/menu.service";
import { createOrder, updateOrder } from "../src/services/order.service";
import { getItemProduct, getProductsByCategoryId } from "../src/services/product.service";
import { formatPrice } from "../src/utils/format";

vi.mock("../src/services/firebase", () => ({ db: {} }));
vi.mock("../src/services/menu.service", () => ({ getMenuByStoreId: vi.fn() }));
vi.mock("../src/services/category.service", () => ({
  getCategoriesByMenuId: vi.fn(),
}));
vi.mock("../src/services/product.service", () => ({
  ITEM_PRODUCT_STATUS: { SELLABLE: "sellable", UNAVAILABLE: "unavailable", DELETED: "deleted" },
  getItemProduct: vi.fn(),
  getProductsByCategoryId: vi.fn(),
}));
vi.mock("../src/services/customer.service", async (importOriginal) => ({
  ...(await importOriginal()),
  getCustomer: vi.fn(),
  getCustomersByCompanyId: vi.fn(),
}));

vi.mock("../src/services/order.service", async (importOriginal) => ({
  ...(await importOriginal()),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
}));

const WATER = {
  id: "p1",
  name: "Water",
  price: 2,
  sizes: null,
  availableCookingLevels: [],
  defaultCookingLevel: null,
  isAvailable: true,
};

// Opens the menu panel and adds Water to the ticket.
const addWater = async () => {
  getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
  getCategoriesByMenuId.mockResolvedValue([{ id: "cat1", name: "Drinks" }]);
  getProductsByCategoryId.mockResolvedValue([WATER]);
  await userEvent.click(screen.getByRole("button", { name: "Add product" }));
  await userEvent.click(await screen.findByRole("button", { name: /Water/ }));
  await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));
  await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
};

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
    expect(screen.getByText("Mario Rossi")).toBeTruthy();
    expect(screen.getByText("Via Roma 1, 00100 Roma")).toBeTruthy();
    expect(screen.queryByLabelText(/First name/)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));

    expect(screen.getByLabelText(/First name/).value).toBe("Mario");
    expect(screen.getByLabelText("Last name").value).toBe("Rossi");
    expect(screen.getByLabelText(/Phone/).value).toBe("333");
    expect(screen.getByLabelText(/^Street \*/).value).toBe("Via Roma");
  });

  it("opens the customer form by itself when a required field is missing", async () => {
    getCustomersByCompanyId.mockResolvedValue([
      { id: "c2", firstName: "Anna", lastName: "Neri", phone: "444", address: null },
    ]);
    render(<TicketSidebar companyId="co1" onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/First name/), "ann");
    await userEvent.click(await screen.findByRole("button", { name: /Anna/ }));
    expect(screen.getByRole("button", { name: "Edit details" })).toBeTruthy();

    await userEvent.click(screen.getByLabelText("Delivery"));

    expect(screen.queryByRole("button", { name: "Edit details" })).toBeNull();
    expect(screen.getByLabelText(/^Street \*/).value).toBe("");

    // Completing the address keeps the form open while it is being edited.
    await userEvent.type(screen.getByLabelText(/^Street \*/), "Via Po");
    await userEvent.type(screen.getByLabelText(/^Street number/), "2");
    await userEvent.type(screen.getByLabelText(/^Postal code/), "10100");
    await userEvent.type(screen.getByLabelText(/^City/), "Torino");

    expect(screen.getByLabelText(/^City/).value).toBe("Torino");
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

  it("configures a product, adds it to the ticket and keeps the menu panel open", async () => {
    const onClose = vi.fn();
    getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
    getCategoriesByMenuId.mockResolvedValue([{ id: "cat1", name: "Drinks" }]);
    getProductsByCategoryId.mockResolvedValue([
      {
        id: "p1",
        name: "Water",
        price: 2,
        sizes: null,
        availableCookingLevels: [],
        defaultCookingLevel: null,
        isAvailable: true,
      },
    ]);
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Add product" }));
    await userEvent.click(await screen.findByRole("button", { name: /Water/ }));

    expect(screen.getByRole("dialog", { name: "Configure Water" })).toBeTruthy();

    // Escape closes only the configuration modal.
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Configure Water" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Add product" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /Water/ }));
    await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));

    expect(screen.queryByRole("dialog", { name: "Configure Water" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Add product" })).toBeTruthy();
    expect(screen.getByLabelText("Quantity of Water").textContent).toBe("1");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("changes quantities, removes items and updates the total automatically", async () => {
    getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
    getCategoriesByMenuId.mockResolvedValue([{ id: "cat1", name: "Drinks" }]);
    getProductsByCategoryId.mockResolvedValue(
      [
        { id: "p1", name: "Water", price: 2.5 },
        { id: "p2", name: "Cola", price: 3 },
      ].map((product) => ({
        ...product,
        sizes: null,
        availableCookingLevels: [],
        defaultCookingLevel: null,
        isAvailable: true,
      })),
    );
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={vi.fn()} />);

    expect(screen.getByText("No products added yet.")).toBeTruthy();
    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(0));

    await userEvent.click(screen.getByRole("button", { name: "Add product" }));
    for (const name of ["Water", "Cola"]) {
      await userEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
      await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));
    }

    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(5.5));

    await userEvent.click(screen.getByRole("button", { name: "Increase quantity of Water" }));
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity of Water" }));

    expect(screen.getByLabelText("Quantity of Water").textContent).toBe("3");
    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(10.5));

    await userEvent.click(screen.getByRole("button", { name: "Decrease quantity of Water" }));

    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(8));
    expect(
      screen.getByRole("button", { name: "Decrease quantity of Cola" }).disabled,
    ).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Remove Water" }));

    expect(screen.queryByLabelText("Quantity of Water")).toBeNull();
    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(3));

    await userEvent.click(screen.getByRole("button", { name: "Remove Cola" }));

    expect(screen.getByText("No products added yet.")).toBeTruthy();
    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(0));
  });

  it("shows the item count in the summary header and the footer", async () => {
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Items" })).toBeTruthy();

    await addWater();
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity of Water" }));

    expect(screen.getByRole("heading", { name: "Items · 2" })).toBeTruthy();
    expect(screen.getByText("Total · 2 items")).toBeTruthy();
    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(4));
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

  it("shows inline errors and does not save an invalid ticket", async () => {
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Delivery"));
    await userEvent.click(screen.getByRole("button", { name: "Save ticket" }));

    expect(screen.getByText("First name is required")).toBeTruthy();
    expect(screen.getByText("Phone is required for delivery")).toBeTruthy();
    expect(screen.getByText("City is required")).toBeTruthy();
    expect(screen.getByText("Add at least one product")).toBeTruthy();
    expect(screen.getByLabelText(/First name/).getAttribute("aria-invalid")).toBe("true");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("clears an inline error as soon as the field is fixed", async () => {
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Save ticket" }));
    expect(screen.getByText("First name is required")).toBeTruthy();

    await userEvent.type(screen.getByLabelText(/First name/), "Anna");

    expect(screen.queryByText("First name is required")).toBeNull();
    expect(screen.getByText("Add at least one product")).toBeTruthy();
  });

  it("saves a valid ticket and closes the sidebar", async () => {
    const onClose = vi.fn();
    createOrder.mockResolvedValue("order-1");
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/First name/), "Anna");
    await addWater();
    await userEvent.click(screen.getByRole("button", { name: "Save ticket" }));

    expect(createOrder).toHaveBeenCalledTimes(1);

    const args = createOrder.mock.calls[0][0];

    expect(args).toMatchObject({
      companyId: "co1",
      storeId: "store-1",
      orderType: "takeaway",
      existingCustomer: null,
    });
    expect(args.customerData.firstName).toBe("Anna");
    expect(args.items).toHaveLength(1);
    expect(args.scheduledTime).toBeInstanceOf(Date);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("passes the selected existing customer to createOrder", async () => {
    createOrder.mockResolvedValue("order-1");
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/First name/), "mar");
    await userEvent.click(await screen.findByRole("button", { name: /Mario/ }));
    await addWater();
    await userEvent.click(screen.getByRole("button", { name: "Save ticket" }));

    expect(createOrder.mock.calls[0][0].existingCustomer).toEqual(CUSTOMERS[0]);
  });

  it("blocks a scheduled time in the past", async () => {
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/First name/), "Anna");
    await addWater();
    fireEvent.change(screen.getByLabelText("Pickup time"), { target: { value: "00:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Save ticket" }));

    expect(screen.getByText("Scheduled time is in the past")).toBeTruthy();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("shows the saving state and keeps the sidebar open when saving fails", async () => {
    const onClose = vi.fn();
    let rejectSave;
    createOrder.mockReturnValue(new Promise((_, reject) => (rejectSave = reject)));
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/First name/), "Anna");
    await addWater();
    await userEvent.click(screen.getByRole("button", { name: "Save ticket" }));

    expect(screen.getByRole("button", { name: "Saving…" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Cancel" }).disabled).toBe(true);

    rejectSave(new Error("boom"));

    expect(await screen.findByText("Could not save the ticket. Try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save ticket" }).disabled).toBe(false);
    expect(screen.getByLabelText(/First name/).value).toBe("Anna");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("TicketSidebar item reconfiguration", () => {
  beforeEach(() => {
    getCustomersByCompanyId.mockResolvedValue(CUSTOMERS);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderWithWater = async (onClose = vi.fn()) => {
    render(<TicketSidebar companyId="co1" storeId="store-1" onClose={onClose} />);
    await addWater();
  };

  it("reopens the full configuration step for a sellable product, keeping the price", async () => {
    const onClose = vi.fn();
    // The menu price changed from 2 to 2.5 since the Item was added.
    getItemProduct.mockResolvedValue({ status: "sellable", product: { ...WATER, price: 2.5 } });
    await renderWithWater(onClose);

    await userEvent.click(screen.getByRole("button", { name: "Edit Water" }));

    expect(getItemProduct).toHaveBeenCalledWith("p1");
    expect(await screen.findByRole("dialog", { name: "Configure Water" })).toBeTruthy();

    // Escape closes only the configuration step.
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Configure Water" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Edit Water" }));
    await userEvent.click(await screen.findByRole("button", { name: "Increase quantity" }));
    expect(screen.getByLabelText("Line total").textContent).toBe(formatPrice(4));
    await userEvent.click(screen.getByRole("button", { name: "Update item" }));

    expect(screen.getAllByLabelText("Quantity of Water")).toHaveLength(1);
    expect(screen.getByLabelText("Quantity of Water").textContent).toBe("2");
    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(4));
  });

  it("opens the restricted edit for an unavailable product and caps the quantity", async () => {
    getItemProduct.mockResolvedValue({
      status: "unavailable",
      product: { ...WATER, isAvailable: false },
    });
    await renderWithWater();

    await userEvent.click(screen.getByRole("button", { name: "Edit Water" }));

    expect(await screen.findByText(/no longer sellable/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Increase quantity" }).disabled).toBe(true);

    await userEvent.keyboard("{Escape}");

    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Increase quantity of Water" }).disabled).toBe(true);
  });

  it("opens the restricted edit for a deleted product", async () => {
    getItemProduct.mockResolvedValue({ status: "deleted", product: null });
    await renderWithWater();

    await userEvent.click(screen.getByRole("button", { name: "Edit Water" }));

    expect(await screen.findByRole("dialog", { name: "Configure Water" })).toBeTruthy();
    expect(screen.getByText(/no longer sellable/)).toBeTruthy();
    expect(screen.getByText("No longer on the menu")).toBeTruthy();
  });

  it("shows a load error when the product cannot be read", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    getItemProduct.mockRejectedValue(new Error("offline"));
    await renderWithWater();

    await userEvent.click(screen.getByRole("button", { name: "Edit Water" }));

    expect(await screen.findByText("Could not load the product. Try again.")).toBeTruthy();
  });
});

describe("TicketSidebar edit mode", () => {
  // Delivery Order scheduled today at 20:30 for Mario (CUSTOMERS[0]).
  const scheduled = new Date();
  scheduled.setHours(20, 30, 0, 0);
  const ORDER = {
    id: "o1",
    customerId: "c1",
    orderType: "delivery",
    scheduledTime: { toDate: () => scheduled },
    status: "In progress",
    items: [
      {
        productId: "p1",
        productName: "Water",
        size: null,
        unitPrice: 2,
        quantity: 3,
        cookingLevel: null,
        customizations: [],
        subtotal: 6,
      },
    ],
    total: 6,
  };

  const renderEdit = (props = {}) =>
    render(
      <TicketSidebar
        companyId="co1"
        storeId="store-1"
        order={ORDER}
        onClose={vi.fn()}
        {...props}
      />,
    );

  beforeEach(() => {
    getCustomersByCompanyId.mockResolvedValue(CUSTOMERS);
    getCustomer.mockResolvedValue(CUSTOMERS[0]);
    getItemProduct.mockResolvedValue({ status: "sellable", product: WATER });
  });

  it("loads the Products' status and caps Items no longer sellable", async () => {
    getItemProduct.mockResolvedValue({ status: "unavailable", product: WATER });
    renderEdit();

    expect(await screen.findByText("Unavailable")).toBeTruthy();
    expect(getItemProduct).toHaveBeenCalledWith("p1");

    const increase = screen.getByRole("button", { name: "Increase quantity of Water" });

    expect(increase.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Decrease quantity of Water" }));
    expect(increase.disabled).toBe(false);
    await userEvent.click(increase);
    expect(screen.getByLabelText("Quantity of Water").textContent).toBe("3");
    expect(increase.disabled).toBe(true);
  });

  it("does not cap Items whose Product is sellable", async () => {
    renderEdit();

    await screen.findByText("Mario Rossi");
    await waitFor(() => expect(getItemProduct).toHaveBeenCalled());
    expect(screen.queryByText("Unavailable")).toBeNull();
    expect(screen.getByRole("button", { name: "Increase quantity of Water" }).disabled).toBe(
      false,
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("prefills the sidebar from the Order and its Customer", async () => {
    renderEdit();

    expect(screen.getByRole("dialog", { name: "Edit ticket" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Edit Ticket" })).toBeTruthy();
    expect(screen.getByLabelText("Delivery").checked).toBe(true);
    expect(screen.getByLabelText("Delivery time").value).toBe("20:30");
    expect(screen.getByLabelText("Quantity of Water").textContent).toBe("3");
    expect(screen.getByLabelText("Total").textContent).toBe(formatPrice(6));
    expect(await screen.findByText("Mario Rossi")).toBeTruthy();
    expect(getCustomer).toHaveBeenCalledWith("c1");
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(screen.getByLabelText(/Phone/).value).toBe("333");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });

  it("saves the changes with updateOrder on the Order's day and closes", async () => {
    const onClose = vi.fn();
    updateOrder.mockResolvedValue();
    renderEdit({ onClose });

    await screen.findByText("Mario Rossi");
    await userEvent.click(screen.getByLabelText("Takeaway"));
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity of Water" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(createOrder).not.toHaveBeenCalled();
    expect(updateOrder).toHaveBeenCalledTimes(1);

    const args = updateOrder.mock.calls[0][0];

    expect(args).toMatchObject({
      companyId: "co1",
      orderId: "o1",
      orderType: "takeaway",
      existingCustomer: CUSTOMERS[0],
    });
    expect(args.items[0]).toMatchObject({ quantity: 4, subtotal: 8 });
    expect(args.scheduledTime).toEqual(scheduled);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("accepts an unchanged past time but rejects a changed one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(scheduled.getTime() + 2 * 60 * 60 * 1000));
    updateOrder.mockResolvedValue();
    renderEdit();

    await screen.findByText("Mario Rossi");
    fireEvent.change(screen.getByLabelText("Delivery time"), { target: { value: "20:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Scheduled time is in the past")).toBeTruthy();
    expect(updateOrder).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Delivery time"), { target: { value: "20:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.queryByText("Scheduled time is in the past")).toBeNull();
    expect(updateOrder).toHaveBeenCalledTimes(1);
  });

  it("blocks saving until the Customer loads and retries after an error", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    getCustomer.mockRejectedValueOnce(new Error("boom"));
    renderEdit();

    expect(screen.getByText("Loading customer ...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" }).disabled).toBe(true);
    expect(await screen.findByText("Could not load the ticket's customer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" }).disabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Mario Rossi")).toBeTruthy();
    expect(getCustomer).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Save changes" }).disabled).toBe(false);
  });

  it("keeps the sidebar open and shows an error when the update fails", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const onClose = vi.fn();
    updateOrder.mockRejectedValue(new Error("denied"));
    renderEdit({ onClose });

    await screen.findByText("Mario Rossi");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Could not save the ticket. Try again.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
