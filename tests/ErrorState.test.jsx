import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorState from "../src/components/ErrorState";

describe("ErrorState", () => {
  afterEach(cleanup);

  it("shows the message and calls onRetry on Try again", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Unable to load." onRetry={onRetry} />);

    expect(screen.getByRole("alert").textContent).toContain("Unable to load.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders extra actions and no retry button without onRetry", () => {
    render(
      <ErrorState message="Unable to load.">
        <button type="button">Logout</button>
      </ErrorState>,
    );

    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
  });
});
