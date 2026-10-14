import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TicketCustomerSection from "../src/components/TicketCustomerSection";
import { FIELD_LIMITS } from "../src/utils/fieldLimits";
import { ORDER_TYPE } from "../src/services/order.service";
import { customerToForm, EMPTY_CUSTOMER_FORM } from "../src/utils/customerForm";

vi.mock("../src/services/firebase", () => ({ db: {} }));

const CUSTOMERS = [
  { id: "c1", firstName: "Mario", lastName: "Rossi", phone: "333", address: null },
  { id: "c2", firstName: "Maria", phone: null, address: { city: "Roma", street: "Via Po" } },
  { id: "c3", firstName: "Luigi" },
];

// Holds the form state like TicketSidebar does.
function Harness({ orderType = ORDER_TYPE.TAKEAWAY, ...props }) {
  const [form, setForm] = useState(EMPTY_CUSTOMER_FORM);
  const [selected, setSelected] = useState(null);

  return (
    <TicketCustomerSection
      orderType={orderType}
      customers={CUSTOMERS}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      form={form}
      onFormChange={setForm}
      selectedCustomer={selected}
      onSelect={(customer) => {
        setSelected(customer);
        setForm(customerToForm(customer));
      }}
      onClear={() => {
        setSelected(null);
        setForm(EMPTY_CUSTOMER_FORM);
      }}
      {...props}
    />
  );
}

describe("TicketCustomerSection", () => {
  afterEach(cleanup);

  it("shows no results for an empty search", () => {
    render(<Harness />);

    expect(screen.queryByRole("list")).toBeNull();
  });

  it("filters results case-insensitively while typing", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText(/First name/), "MAR");

    expect(screen.getByRole("button", { name: /Mario/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Maria/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Luigi/ })).toBeNull();
  });

  it("tells that a new customer will be created when nothing matches", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText(/First name/), "zzz");

    expect(screen.getByText(/a new one will be created/)).toBeTruthy();
  });

  it("populates the fields on select and resets them on New customer", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText(/First name/), "mario");
    await userEvent.click(screen.getByRole("button", { name: /Mario/ }));
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));

    expect(screen.getByLabelText(/First name/).value).toBe("Mario");
    expect(screen.getByLabelText("Last name").value).toBe("Rossi");
    expect(screen.getByLabelText(/Phone/).value).toBe("333");
    expect(screen.queryByRole("list")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "New customer" }));

    expect(screen.getByLabelText(/First name/).value).toBe("");
    expect(screen.getByLabelText("Last name").value).toBe("");
    expect(screen.queryByRole("button", { name: "New customer" })).toBeNull();
  });

  it("shows the selected customer as a card with name and phone", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText(/First name/), "mario");
    await userEvent.click(screen.getByRole("button", { name: /Mario/ }));

    expect(screen.getByText("Mario Rossi")).toBeTruthy();
    expect(screen.getByText("333")).toBeTruthy();
    expect(screen.queryByLabelText(/First name/)).toBeNull();
  });

  it("keeps the form open for an incomplete customer, also once completed", async () => {
    const { rerender } = render(<Harness incomplete />);

    await userEvent.type(screen.getByLabelText(/First name/), "maria");
    await userEvent.click(screen.getByRole("button", { name: /Maria/ }));

    expect(screen.queryByRole("button", { name: "Edit details" })).toBeNull();
    await userEvent.type(screen.getByLabelText(/Phone/), "555");

    rerender(<Harness incomplete={false} />);

    expect(screen.getByLabelText(/Phone/).value).toBe("555");
    expect(screen.queryByRole("button", { name: "Edit details" })).toBeNull();
  });

  it("shows the card again when another customer is selected", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText(/First name/), "mario");
    await userEvent.click(screen.getByRole("button", { name: /Mario/ }));
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    await userEvent.click(screen.getByRole("button", { name: "New customer" }));
    await userEvent.type(screen.getByLabelText(/First name/), "luigi");
    await userEvent.click(screen.getByRole("button", { name: /Luigi/ }));

    expect(screen.getByRole("button", { name: "Edit details" })).toBeTruthy();
  });

  it("shows address fields only for Delivery and keeps their values", async () => {
    const { rerender } = render(<Harness orderType={ORDER_TYPE.DELIVERY} />);

    await userEvent.type(screen.getByLabelText(/^City/), "Roma");
    expect(screen.getByLabelText(/^Street \*/)).toBeTruthy();
    expect(screen.getByLabelText("Country")).toBeTruthy();

    rerender(<Harness orderType={ORDER_TYPE.TAKEAWAY} />);
    expect(screen.queryByLabelText(/^City/)).toBeNull();

    rerender(<Harness orderType={ORDER_TYPE.DELIVERY} />);
    expect(screen.getByLabelText(/^City/).value).toBe("Roma");
  });

  it("shows the loading and error states", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<Harness loading />);

    await userEvent.type(screen.getByLabelText(/First name/), "m");
    expect(screen.getByText(/Loading customers/)).toBeTruthy();

    rerender(<Harness error={new Error("x")} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("TicketCustomerSection field limits", () => {
  afterEach(cleanup);

  it("limits the customer and address inputs to FIELD_LIMITS", () => {
    render(<Harness orderType={ORDER_TYPE.DELIVERY} />);

    const limits = [
      [/First name/, FIELD_LIMITS.NAME],
      ["Last name", FIELD_LIMITS.NAME],
      [/Phone/, FIELD_LIMITS.PHONE],
      [/^Street \*/, FIELD_LIMITS.ADDRESS_LINE],
      [/^Street number/, FIELD_LIMITS.STREET_NUMBER],
      [/^Postal code/, FIELD_LIMITS.POSTAL_CODE],
      [/^City/, FIELD_LIMITS.ADDRESS_LINE],
      [/^Country/, FIELD_LIMITS.ADDRESS_LINE],
    ];

    limits.forEach(([name, max]) => {
      expect(screen.getByLabelText(name).getAttribute("maxlength")).toBe(String(max));
    });
  });
});
