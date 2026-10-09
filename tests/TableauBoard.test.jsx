import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TableauBoard from "../src/components/TableauBoard";

vi.mock("../src/services/firebase", () => ({ db: {} }));

describe("TableauBoard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the three status columns in order", () => {
    render(<TableauBoard />);

    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual(["Pending", "In progress", "Completed"]);
  });

  it("shows an empty message and a zero count in every empty column", () => {
    render(<TableauBoard />);

    expect(screen.getAllByText("No tickets")).toHaveLength(3);
    expect(screen.getByLabelText("Pending tickets").textContent).toBe("0");
  });

  it("groups orders by status", () => {
    render(
      <TableauBoard
        orders={[
          { id: "a", status: "Pending" },
          { id: "b", status: "Completed" },
          { id: "c", status: "Pending" },
        ]}
      />,
    );

    expect(screen.getByLabelText("Pending tickets").textContent).toBe("2");
    expect(screen.getByLabelText("In progress tickets").textContent).toBe("0");
    expect(screen.getByLabelText("Completed tickets").textContent).toBe("1");
    const pending = screen.getByRole("heading", { name: "Pending" })
      .closest("section");
    expect(within(pending).getAllByRole("article")).toHaveLength(2);
  });

  it("keeps the received chronological order inside each column", () => {
    const ticket = (id, status, productName) => ({
      id,
      status,
      items: [{ productId: id, productName, quantity: 1, subtotal: 5 }],
    });
    render(
      <TableauBoard
        orders={[
          ticket("a", "Pending", "First"),
          ticket("b", "In progress", "Other"),
          ticket("c", "Pending", "Second"),
          ticket("d", "Pending", "Third"),
        ]}
      />,
    );

    const pending = screen
      .getByRole("heading", { name: "Pending" })
      .closest("section");
    const names = within(pending)
      .getAllByRole("article")
      .map((article) => /1 x (\w+)/.exec(article.textContent)[1]);

    expect(names).toEqual(["First", "Second", "Third"]);
  });

  it("shows only the loading message while loading", () => {
    render(<TableauBoard loading />);

    expect(screen.getByText("Loading ...")).toBeTruthy();
    expect(screen.queryByText("Pending")).toBeNull();
  });

  it("shows a Create Ticket button that calls onCreateTicket", async () => {
    const onCreateTicket = vi.fn();
    render(<TableauBoard onCreateTicket={onCreateTicket} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Create Ticket" }),
    );
    expect(onCreateTicket).toHaveBeenCalledOnce();
  });

  it("keeps the Create Ticket button when orders are present", () => {
    render(<TableauBoard orders={[{ id: "a", status: "Pending" }]} />);

    expect(screen.getByRole("button", { name: "Create Ticket" })).toBeTruthy();
  });

  it("shows the error with a working retry button", async () => {
    const onRetry = vi.fn();
    render(<TableauBoard error={new Error("boom")} onRetry={onRetry} />);

    expect(screen.getByText(/Unable to load the tickets/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
