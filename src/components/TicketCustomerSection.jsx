import { filterCustomersByFirstName } from "../services/customer.service";
import { ORDER_TYPE } from "../services/order.service";
import LoadingState from "./LoadingState";
import { alert, button, ghostButton, input, label, muted } from "../utils/styles";
import FieldError from "./FieldError";

const ADDRESS_INPUTS = [
  { field: "street", label: "Street", required: true, span: "sm:col-span-2" },
  { field: "streetNumber", label: "Street number", required: true },
  { field: "postalCode", label: "Postal code", required: true },
  { field: "city", label: "City", required: true },
  { field: "country", label: "Country", required: false, span: "sm:col-span-2" },
];

const fieldInput = `${input} min-h-11`;

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
    <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
      <legend className="mb-3 flex w-full items-center justify-between text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        <span>Customer</span>
        {selectedCustomer && (
          <button
            type="button"
            className={`${ghostButton} min-h-10 font-medium tracking-normal text-brand-700 normal-case`}
            onClick={onClear}
          >
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
        <label htmlFor="customerFirstName" className={`${label} mb-1 block`}>
          First name
          <span aria-hidden="true"> *</span>
        </label>
        <input
          id="customerFirstName"
          type="text"
          autoComplete="off"
          className={fieldInput}
          placeholder="Search or enter a new customer"
          value={form.firstName}
          aria-invalid={Boolean(errors.firstName)}
          aria-describedby={errors.firstName ? "customerFirstName-error" : undefined}
          onChange={(event) => setField("firstName", event.target.value)}
        />
        <FieldError id="customerFirstName-error" message={errors.firstName} />

        {searching && loading && (
          <LoadingState text="Loading customers…" className="mt-1" />
        )}

        {searching && !loading && !error && (
          <ul
            aria-label="Matching customers"
            className="m-0 mt-1 max-h-56 list-none divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-0 shadow-sm"
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
                  className="block min-h-11 w-full px-3 py-2 text-left text-sm transition-colors hover:bg-brand-50 focus:outline-none focus-visible:bg-brand-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                  onClick={() => onSelect(customer)}
                >
                  <span className="font-medium text-neutral-900">{customer.firstName}</span>
                  <span className={`${muted} block`}>{describeCustomer(customer)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label htmlFor="customerLastName" className={`${label} mb-1 block`}>
          Last name
        </label>
        <input
          id="customerLastName"
          type="text"
          className={fieldInput}
          value={form.lastName}
          onChange={(event) => setField("lastName", event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="customerPhone" className={`${label} mb-1 block`}>
          Phone
          {isDelivery && <span aria-hidden="true"> *</span>}
        </label>
        <input
          id="customerPhone"
          type="tel"
          className={fieldInput}
          value={form.phone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "customerPhone-error" : undefined}
          onChange={(event) => setField("phone", event.target.value)}
        />
        <FieldError id="customerPhone-error" message={errors.phone} />
      </div>

      {isDelivery && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ADDRESS_INPUTS.map(({ field, label: text, required, span }) => (
            <div key={field} className={span}>
              <label htmlFor={`customer-${field}`} className={`${label} mb-1 block`}>
                {text}
                {required && <span aria-hidden="true"> *</span>}
              </label>
              <input
                id={`customer-${field}`}
                type="text"
                className={fieldInput}
                value={form.address[field]}
                aria-invalid={Boolean(errors[field])}
                aria-describedby={errors[field] ? `customer-${field}-error` : undefined}
                onChange={(event) => setAddressField(field, event.target.value)}
              />
              <FieldError id={`customer-${field}-error`} message={errors[field]} />
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
