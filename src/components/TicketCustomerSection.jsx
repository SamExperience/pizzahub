import { filterCustomersByFirstName } from "../services/customer.service";
import { ORDER_TYPE } from "../services/order.service";
import { alert, button, ghostButton, input, muted } from "../utils/styles";
import FieldError from "./FieldError";

const ADDRESS_INPUTS = [
  { field: "street", label: "Street", required: true },
  { field: "streetNumber", label: "Street number", required: true },
  { field: "postalCode", label: "Postal code", required: true },
  { field: "city", label: "City", required: true },
  { field: "country", label: "Country", required: false },
];

const describeCustomer = ({ lastName, phone, address }) =>
  [
    lastName,
    phone,
    [address?.street, address?.streetNumber].filter(Boolean).join(" "),
    address?.city,
  ]
    .filter(Boolean)
    .join(" · ");

// Customer part of the ticket: the first name input also searches the
// Company's Customers; selecting one fills the form.
export default function TicketCustomerSection({
  orderType,
  customers,
  loading,
  error,
  onRetry,
  form,
  onFormChange,
  selectedCustomer,
  onSelect,
  onClear,
  errors = {},
}) {
  const isDelivery = orderType === ORDER_TYPE.DELIVERY;
  const results = selectedCustomer
    ? []
    : filterCustomersByFirstName(customers, form.firstName);
  const searching = !selectedCustomer && form.firstName.trim() !== "";

  const setField = (field, value) => onFormChange({ ...form, [field]: value });
  const setAddressField = (field, value) =>
    onFormChange({ ...form, address: { ...form.address, [field]: value } });

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
        <span>Customer</span>
        {selectedCustomer && (
          <button type="button" className={ghostButton} onClick={onClear}>
            New customer
          </button>
        )}
      </legend>

      {error && (
        <div role="alert" className={`${alert} flex items-center justify-between gap-2`}>
          <span>Could not load customers.</span>
          <button type="button" className={button} onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      <div className="relative">
        <label htmlFor="customerFirstName" className="mb-1 block text-sm font-medium">
          First name
          <span aria-hidden="true"> *</span>
        </label>
        <input
          id="customerFirstName"
          type="text"
          autoComplete="off"
          className={input}
          placeholder="Search or enter a new customer"
          value={form.firstName}
          aria-invalid={Boolean(errors.firstName)}
          aria-describedby={errors.firstName ? "customerFirstName-error" : undefined}
          onChange={(event) => setField("firstName", event.target.value)}
        />
        <FieldError id="customerFirstName-error" message={errors.firstName} />

        {searching && loading && <p className={`${muted} mt-1`}>Loading customers…</p>}

        {searching && !loading && !error && (
          <ul
            aria-label="Matching customers"
            className="m-0 mt-1 max-h-48 list-none divide-y divide-neutral-200 overflow-y-auto rounded-lg border border-neutral-200 p-0"
          >
            {results.length === 0 && (
              <li className={`${muted} px-3 py-2`}>
                No matching customer: a new one will be created.
              </li>
            )}
            {results.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 focus:outline-none focus-visible:bg-neutral-100"
                  onClick={() => onSelect(customer)}
                >
                  <span className="font-medium">{customer.firstName}</span>
                  <span className={`${muted} block`}>{describeCustomer(customer)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label htmlFor="customerLastName" className="mb-1 block text-sm font-medium">
          Last name
        </label>
        <input
          id="customerLastName"
          type="text"
          className={input}
          value={form.lastName}
          onChange={(event) => setField("lastName", event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="customerPhone" className="mb-1 block text-sm font-medium">
          Phone
          {isDelivery && <span aria-hidden="true"> *</span>}
        </label>
        <input
          id="customerPhone"
          type="tel"
          className={input}
          value={form.phone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "customerPhone-error" : undefined}
          onChange={(event) => setField("phone", event.target.value)}
        />
        <FieldError id="customerPhone-error" message={errors.phone} />
      </div>

      {isDelivery &&
        ADDRESS_INPUTS.map(({ field, label, required }) => (
          <div key={field}>
            <label
              htmlFor={`customer-${field}`}
              className="mb-1 block text-sm font-medium"
            >
              {label}
              {required && <span aria-hidden="true"> *</span>}
            </label>
            <input
              id={`customer-${field}`}
              type="text"
              className={input}
              value={form.address[field]}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `customer-${field}-error` : undefined}
              onChange={(event) => setAddressField(field, event.target.value)}
            />
            <FieldError id={`customer-${field}-error`} message={errors[field]} />
          </div>
        ))}
    </fieldset>
  );
}
