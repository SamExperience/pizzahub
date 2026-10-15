import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketCard from "../src/components/TicketCard";

vi.mock("../src/services/firebase", () => ({ db: {} }));

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn(), emit: null }));

vi.mock("../src/services/customer.service", () => ({
  subscribeToCustomer: mocks.subscribe,
}));

// Fake Customer listener: delivers value (or the error) asynchronously and
// keeps the callback in mocks.emit to push later changes.
const listenWith = (value, error = null) =>
  mocks.subscribe.mockImplementation((customerId, onChange, onError) => {
    mocks.emit = onChange;
    queueMicrotask(() => (error ? onError(error) : onChange(value)));
    return mocks.unsubscribe;
  });

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

const showDetails = () =>
  fireEvent.click(screen.getByRole("button", { name: "Show details" }));

const openMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));

const customer = {
  id: "c1",
  firstName: "Mario",
  lastName: "Rossi",
  phone: "333 1234567",
  address: { street: "Via Roma", streetNumber: "5", postalCode: "00100", city: "Roma" },
};

describe("TicketCard", () => {
  beforeEach(() => {
    mocks.subscribe.mockReset();
    listenWith(customer);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a compact summary: order type, customer, item count and total", async () => {
    render(<TicketCard order={baseOrder} />);

    expect(screen.getByText("Takeaway")).toBeTruthy();
    expect(screen.getByText("2 items")).toBeTruthy();
    expect(screen.getByText("€21.00")).toBeTruthy();
    expect(screen.queryByText("2 x Margherita")).toBeNull();
    expect(await screen.findByText("Mario Rossi")).toBeTruthy();
    expect(mocks.subscribe.mock.calls[0][0]).toBe("c1");
  });

  it("expands in place to show the items and collapses again", async () => {
    render(<TicketCard order={baseOrder} />);
    await screen.findByText("Mario Rossi");

    showDetails();

    expect(screen.getByText("2 x Margherita")).toBeTruthy();
    expect(screen.getByText("Large · Well done · No basil")).toBeTruthy();
    expect(screen.getAllByText("€21.00")).toHaveLength(2);
    const toggle = screen.getByRole("button", { name: "Hide details" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);

    expect(screen.queryByText("2 x Margherita")).toBeNull();
  });

  it("expands when the card summary is clicked", async () => {
    render(<TicketCard order={baseOrder} />);

    fireEvent.click(await screen.findByText("Mario Rossi"));

    expect(screen.getByText("2 x Margherita")).toBeTruthy();
  });

  it("colours the card by status and shows the order type badge", async () => {
    render(<TicketCard order={{ ...baseOrder, status: "In progress", orderType: "delivery" }} />);

    expect(screen.getByRole("article").className).toMatch(/border-l-blue-400/);
    expect(screen.getByText("Delivery")).toBeTruthy();
    await screen.findByText("Mario Rossi");
  });

  it("hides phone and address for takeaway", async () => {
    render(<TicketCard order={baseOrder} />);

    await screen.findByText("Mario Rossi");
    showDetails();
    expect(screen.queryByText("333 1234567")).toBeNull();
    expect(screen.queryByText(/Via Roma/)).toBeNull();
  });

  it("shows the street when collapsed and phone and address when expanded for delivery", async () => {
    render(<TicketCard order={{ ...baseOrder, orderType: "delivery" }} />);

    expect(screen.getByText("Delivery")).toBeTruthy();
    expect(await screen.findByText("2 items · Via Roma 5")).toBeTruthy();
    expect(screen.queryByText("333 1234567")).toBeNull();

    showDetails();

    expect(screen.getByText("333 1234567")).toBeTruthy();
    expect(screen.getByText("Via Roma 5, 00100 Roma")).toBeTruthy();
  });

  it("shows customer changes made from any ticket in real time", async () => {
    render(<TicketCard order={{ ...baseOrder, orderType: "delivery" }} />);
    await screen.findByText("Mario Rossi");
    showDetails();

    act(() => mocks.emit({ ...customer, firstName: "Luigi", phone: "333 0000000" }));

    expect(screen.getByText("Luigi Rossi")).toBeTruthy();
    expect(screen.getByText("333 0000000")).toBeTruthy();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  });

  it("stops listening when unmounted", async () => {
    const { unmount } = render(<TicketCard order={baseOrder} />);
    await screen.findByText("Mario Rossi");

    unmount();

    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it("shows a fallback when the customer is missing", async () => {
    listenWith(null);
    render(<TicketCard order={baseOrder} />);

    expect(await screen.findByText("Customer unavailable")).toBeTruthy();
  });

  it("shows a load error, not a missing customer, when the listener fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    listenWith(null, new Error("boom"));
    render(<TicketCard order={baseOrder} />);

    expect(await screen.findByText("Could not load customer")).toBeTruthy();
    expect(screen.queryByText("Customer unavailable")).toBeNull();
  });
});

describe("TicketCard status arrows", () => {
  beforeEach(() => {
    mocks.subscribe.mockReset();
    listenWith(customer);
  });

  afterEach(() => {
    cleanup();
  });

  const renderCard = (status, onChangeStatus = vi.fn().mockResolvedValue()) => {
    render(
      <TicketCard order={{ ...baseOrder, status }} onChangeStatus={onChangeStatus} />,
    );
    return onChangeStatus;
  };

  it("shows only Start for Pending", async () => {
    renderCard("Pending");

    expect(screen.getByRole("button", { name: "Start" }).title).toBe("Move to In progress");
    expect(screen.queryByRole("button", { name: /Move to Pending/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("shows the back arrow and Complete for In progress", async () => {
    renderCard("In progress");

    expect(screen.getByRole("button", { name: "Move to Pending" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Complete" }).title).toBe("Move to Completed");
    await screen.findByText("Mario Rossi");
  });

  it("shows only Reopen for Completed", async () => {
    renderCard("Completed");

    expect(screen.getByRole("button", { name: "Reopen" }).title).toBe("Move to In progress");
    expect(screen.queryByRole("button", { name: /Start|Complete/ })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("hides the status buttons without a status handler", async () => {
    render(<TicketCard order={baseOrder} />);

    expect(screen.queryByRole("button", { name: /Move to|Start|Complete|Reopen/ })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("calls the handler with the order and the new status", async () => {
    const onChangeStatus = renderCard("In progress");

    fireEvent.click(screen.getByRole("button", { name: "Complete" }));

    expect(onChangeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: "o1" }),
      "Completed",
    );
    await screen.findByText("Mario Rossi");
  });

  it("disables the arrows while saving", async () => {
    let resolve;
    renderCard("In progress", vi.fn(() => new Promise((r) => (resolve = r))));

    fireEvent.click(screen.getByRole("button", { name: "Move to Pending" }));

    expect(screen.getByRole("button", { name: "Move to Pending" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Complete" }).disabled).toBe(true);

    resolve();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move to Pending" }).disabled).toBe(false),
    );
  });

  it("cancels the ticket after confirmation", async () => {
    const onCancel = vi.fn().mockResolvedValue();
    render(<TicketCard order={baseOrder} onCancel={onCancel} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel ticket" }));
    expect(screen.queryByRole("menu")).toBeNull();
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Cancel this ticket?")).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel ticket" }));

    expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ id: "o1" }));
    await screen.findByText("Mario Rossi");
  });

  it("does not cancel when the confirmation is dismissed", async () => {
    const onCancel = vi.fn();
    render(<TicketCard order={baseOrder} onCancel={onCancel} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel ticket" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Keep ticket" }),
    );

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("disables the actions menu while saving and shows an error when it fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let reject;
    const onCancel = vi.fn(() => new Promise((_, r) => (reject = r)));
    render(<TicketCard order={baseOrder} onCancel={onCancel} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel ticket" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel ticket" }),
    );
    expect(screen.getByRole("button", { name: "More actions" }).disabled).toBe(true);

    reject(new Error("denied"));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      "Could not update the ticket",
    );
    expect(screen.getByRole("button", { name: "More actions" }).disabled).toBe(false);
  });

  it("opens the edit mode with the order from the actions menu", async () => {
    const onEdit = vi.fn();
    render(<TicketCard order={baseOrder} onEdit={onEdit} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit ticket" }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "o1" }));
    expect(screen.queryByRole("menu")).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("closes the actions menu on Escape and on outside clicks", async () => {
    render(<TicketCard order={baseOrder} onEdit={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByText("Mario Rossi");

    openMenu();
    expect(
      screen.getByRole("button", { name: "More actions" }).getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    openMenu();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not expand the card when an action is used", async () => {
    render(<TicketCard order={baseOrder} onEdit={vi.fn()} />);
    await screen.findByText("Mario Rossi");

    openMenu();

    expect(screen.queryByText("2 x Margherita")).toBeNull();
  });

  it("hides cancel without a cancel handler", async () => {
    render(<TicketCard order={baseOrder} onEdit={vi.fn()} />);

    openMenu();
    expect(screen.queryByRole("menuitem", { name: "Cancel ticket" })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("hides the actions menu without edit and cancel handlers", async () => {
    render(<TicketCard order={baseOrder} />);

    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("shows an error and re-enables the arrows when the update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderCard("Pending", vi.fn().mockRejectedValue(new Error("denied")));

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      "Could not update the ticket",
    );
    expect(screen.getByRole("button", { name: "Start" }).disabled).toBe(false);
  });
});
