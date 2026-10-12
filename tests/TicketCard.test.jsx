import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("shows order type, items, total and status", async () => {
    render(<TicketCard order={baseOrder} />);

    expect(screen.getByText("Takeaway")).toBeTruthy();
    expect(screen.getByText("2 x Margherita")).toBeTruthy();
    expect(screen.getByText("Large · Well done · No basil")).toBeTruthy();
    expect(screen.getAllByText("€21.00")).toHaveLength(2);
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(await screen.findByText("Mario Rossi")).toBeTruthy();
    expect(mocks.subscribe.mock.calls[0][0]).toBe("c1");
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

  it("shows customer changes made from any ticket in real time", async () => {
    render(<TicketCard order={{ ...baseOrder, orderType: "delivery" }} />);
    await screen.findByText("Mario Rossi");

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

  it("shows a fallback when the customer cannot be loaded", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    listenWith(null, new Error("boom"));
    render(<TicketCard order={baseOrder} />);

    expect(await screen.findByText("Customer unavailable")).toBeTruthy();
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

  it("shows only the forward arrow for Pending", async () => {
    renderCard("Pending");

    expect(screen.getByRole("button", { name: "Move to In progress" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Move to Pending/ })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("shows both arrows for In progress", async () => {
    renderCard("In progress");

    expect(screen.getByRole("button", { name: "Move to Pending" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move to Completed" })).toBeTruthy();
    await screen.findByText("Mario Rossi");
  });

  it("shows only the back arrow for Completed", async () => {
    renderCard("Completed");

    expect(screen.getByRole("button", { name: "Move to In progress" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Move to Completed/ })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("hides the arrows without a status handler", async () => {
    render(<TicketCard order={baseOrder} />);

    expect(screen.queryByRole("button", { name: /Move to/ })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("calls the handler with the order and the new status", async () => {
    const onChangeStatus = renderCard("In progress");

    fireEvent.click(screen.getByRole("button", { name: "Move to Completed" }));

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
    expect(screen.getByRole("button", { name: "Move to Completed" }).disabled).toBe(true);

    resolve();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move to Pending" }).disabled).toBe(false),
    );
  });

  it("cancels the ticket after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onCancel = vi.fn().mockResolvedValue();
    render(<TicketCard order={baseOrder} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel ticket" }));

    expect(confirm).toHaveBeenCalledWith("Cancel this ticket? This cannot be undone.");
    expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ id: "o1" }));
    await screen.findByText("Mario Rossi");
    confirm.mockRestore();
  });

  it("does not cancel when the confirmation is dismissed", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onCancel = vi.fn();
    render(<TicketCard order={baseOrder} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel ticket" }));

    expect(onCancel).not.toHaveBeenCalled();
    await screen.findByText("Mario Rossi");
    confirm.mockRestore();
  });

  it("disables cancel while saving and shows an error when it fails", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    let reject;
    const onCancel = vi.fn(() => new Promise((_, r) => (reject = r)));
    render(<TicketCard order={baseOrder} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel ticket" }));
    expect(screen.getByRole("button", { name: "Cancel ticket" }).disabled).toBe(true);

    reject(new Error("denied"));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      "Could not update the ticket",
    );
    expect(screen.getByRole("button", { name: "Cancel ticket" }).disabled).toBe(false);
    confirm.mockRestore();
  });

  it("opens the edit mode with the order", async () => {
    const onEdit = vi.fn();
    render(<TicketCard order={baseOrder} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit ticket" }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "o1" }));
    await screen.findByText("Mario Rossi");
  });

  it("hides cancel without a cancel handler", async () => {
    render(<TicketCard order={baseOrder} />);

    expect(screen.queryByRole("button", { name: "Cancel ticket" })).toBeNull();
    await screen.findByText("Mario Rossi");
  });

  it("shows an error and re-enables the arrows when the update fails", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    renderCard("Pending", vi.fn().mockRejectedValue(new Error("denied")));

    fireEvent.click(screen.getByRole("button", { name: "Move to In progress" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      "Could not update the ticket",
    );
    expect(screen.getByRole("button", { name: "Move to In progress" }).disabled).toBe(false);
  });
});
