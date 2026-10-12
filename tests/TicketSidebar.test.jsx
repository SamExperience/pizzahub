import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TicketSidebar from "../src/components/TicketSidebar";

vi.mock("../src/services/firebase", () => ({ db: {} }));

describe("TicketSidebar", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
