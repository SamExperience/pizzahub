import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Tableau from "../src/pages/Tableau";

vi.mock("../src/services/firebase", () => ({ db: {} }));

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  store: { selectedStore: { id: "store-1" } },
}));

vi.mock("../src/services/order.service", async (importOriginal) => ({
  ...(await importOriginal()),
  subscribeToTodayOrders: mocks.subscribe,
}));

vi.mock("../src/contexts/StoreContext", () => ({
  useStore: () => mocks.store,
}));

describe("Tableau page wiring", () => {
  let unsubscribes;

  beforeEach(() => {
    unsubscribes = [];
    mocks.store.selectedStore = { id: "store-1" };
    mocks.subscribe.mockReset();
    mocks.subscribe.mockImplementation(() => {
      const unsubscribe = vi.fn();
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("subscribes for the active Store and groups the received orders", () => {
    render(<Tableau />);

    expect(mocks.subscribe).toHaveBeenCalledOnce();
    expect(mocks.subscribe.mock.calls[0][0]).toBe("store-1");
    expect(screen.getByText("Loading ...")).toBeTruthy();

    act(() =>
      mocks.subscribe.mock.calls[0][1]([
        { id: "a", status: "Pending" },
        { id: "b", status: "In progress" },
      ]),
    );

    expect(screen.getByLabelText("Pending tickets").textContent).toBe("1");
    expect(screen.getByLabelText("In progress tickets").textContent).toBe("1");
    expect(screen.getByLabelText("Completed tickets").textContent).toBe("0");
  });

  it("moves a ticket to another column when a new snapshot arrives", () => {
    render(<Tableau />);
    const onChange = mocks.subscribe.mock.calls[0][1];

    act(() => onChange([{ id: "a", status: "Pending" }]));
    expect(screen.getByLabelText("Pending tickets").textContent).toBe("1");
    expect(screen.getByLabelText("In progress tickets").textContent).toBe("0");

    act(() => onChange([{ id: "a", status: "In progress" }]));
    expect(screen.getByLabelText("Pending tickets").textContent).toBe("0");
    expect(screen.getByLabelText("In progress tickets").textContent).toBe("1");

    act(() => onChange([]));
    expect(screen.getByLabelText("In progress tickets").textContent).toBe("0");
    expect(screen.getAllByText("No tickets")).toHaveLength(3);
  });

  it("goes from loading to the empty board when there are no orders", () => {
    render(<Tableau />);
    expect(screen.getByText("Loading ...")).toBeTruthy();

    act(() => mocks.subscribe.mock.calls[0][1]([]));

    expect(screen.queryByText("Loading ...")).toBeNull();
    expect(screen.getAllByText("No tickets")).toHaveLength(3);
  });

  it("goes from loading to the error state", () => {
    render(<Tableau />);

    act(() => mocks.subscribe.mock.calls[0][2](new Error("boom")));

    expect(screen.queryByText("Loading ...")).toBeNull();
    expect(screen.getByText(/Unable to load the tickets/)).toBeTruthy();
    expect(screen.queryByText("No tickets")).toBeNull();
  });

  it("recovers from an error: retry shows loading, then the tickets", async () => {
    render(<Tableau />);
    act(() => mocks.subscribe.mock.calls[0][2](new Error("boom")));

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Loading ...")).toBeTruthy();
    expect(screen.queryByText(/Unable to load the tickets/)).toBeNull();

    act(() =>
      mocks.subscribe.mock.calls[1][1]([{ id: "a", status: "Completed" }]),
    );

    expect(screen.queryByText("Loading ...")).toBeNull();
    expect(screen.getByLabelText("Completed tickets").textContent).toBe("1");
  });

  it("shows the error and resubscribes on retry", async () => {
    render(<Tableau />);

    act(() => mocks.subscribe.mock.calls[0][2](new Error("boom")));
    expect(screen.getByText(/Unable to load the tickets/)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(unsubscribes[0]).toHaveBeenCalledOnce();
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = render(<Tableau />);

    unmount();

    expect(unsubscribes[0]).toHaveBeenCalledOnce();
  });

  it("resubscribes when the active Store changes", () => {
    const { rerender } = render(<Tableau />);

    mocks.store.selectedStore = { id: "store-2" };
    rerender(<Tableau />);

    expect(unsubscribes[0]).toHaveBeenCalledOnce();
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
    expect(mocks.subscribe.mock.calls[1][0]).toBe("store-2");
  });

  it("renews the listener at midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 23, 59, 0));
    render(<Tableau />);

    act(() => {
      vi.advanceTimersByTime(61 * 1000);
    });

    expect(unsubscribes[0]).toHaveBeenCalledOnce();
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  });
});
