import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CategoryForm from "../src/components/CategoryForm";
import { FIELD_LIMITS } from "../src/utils/fieldLimits";

describe("CategoryForm", () => {
  afterEach(cleanup);

  it("limits the category name input to FIELD_LIMITS.NAME", () => {
    render(<CategoryForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("New category name").getAttribute("maxlength")).toBe(
      String(FIELD_LIMITS.NAME),
    );
  });

  it("disables and ignores the submit while busy", () => {
    const onSubmit = vi.fn();
    render(<CategoryForm onSubmit={onSubmit} busy />);

    fireEvent.change(screen.getByLabelText("New category name"), {
      target: { value: "Dolci" },
    });
    const add = screen.getByRole("button", { name: "Add category" });
    expect(add.disabled).toBe(true);

    fireEvent.submit(add.closest("form"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
