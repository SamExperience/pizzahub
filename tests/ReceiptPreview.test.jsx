import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReceiptPreview from "../src/components/ReceiptPreview";

const RECEIPT = "   Pizzeria Bella\n--------\nTOTAL   €5.00";

describe("ReceiptPreview", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the receipt text as is in a dialog with focus on Print", () => {
    render(<ReceiptPreview receipt={RECEIPT} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Print preview" })).toBeTruthy();
    expect(screen.getByTestId("receipt").textContent).toBe(RECEIPT);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Print" }));
  });

  it("closes from Print, Close, the close icon, Escape and the backdrop", () => {
    const onClose = vi.fn();
    render(<ReceiptPreview receipt={RECEIPT} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog").parentElement);

    expect(onClose).toHaveBeenCalledTimes(5);
  });

  it("does not close when the receipt itself is clicked", () => {
    const onClose = vi.fn();
    render(<ReceiptPreview receipt={RECEIPT} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("receipt"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
