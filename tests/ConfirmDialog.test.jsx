import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../src/components/ConfirmDialog";

const renderDialog = (props = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Delete item?"
      message="This cannot be undone."
      confirmLabel="Delete"
      cancelLabel="Keep"
      destructive
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
};

describe("ConfirmDialog", () => {
  afterEach(cleanup);

  it("renders nothing when closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("is a labelled modal alert dialog", () => {
    renderDialog();

    const dialog = screen.getByRole("alertdialog", { name: "Delete item?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
  });

  it("focuses the cancel button when opened", () => {
    renderDialog();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep" }));
  });

  it("cancels on Escape and on backdrop click", () => {
    const { onCancel } = renderDialog();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("alertdialog").parentElement);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("confirms with the confirm button only", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("restores focus to the previous element on close", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const { rerender } = render(
      <ConfirmDialog open title="T" confirmLabel="Yes" cancelLabel="No" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "No" }));

    rerender(
      <ConfirmDialog open={false} title="T" confirmLabel="Yes" cancelLabel="No" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
