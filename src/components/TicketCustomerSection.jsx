import { useState } from "react";
import { MapPin, Pencil, Phone } from "lucide-react";
import { filterCustomersByFirstName } from "../services/customer.service";
import { ORDER_TYPE } from "../services/order.service";
import LoadingState from "./LoadingState";
import { alert, button, ghostButton, input, label, muted } from "../utils/styles";
import FieldError from "./FieldError";

// Address grid: street + number, then postal code + city, then country
// (postal code, city and country share one row from sm).
const ADDRESS_INPUTS = [
  { field: "street", label: "Street", required: true, span: "col-span-4" },
  { field: "streetNumber", label: "Street number", required: true, span: "col-span-2" },
  { field: "postalCode", label: "Postal code", required: true, span: "col-span-2" },
  { field: "city", label: "City", required: true, span: "col-span-4 sm:col-span-2" },
  { field: "country", label: "Country", required: false, span: "col-span-6 sm:col-span-2" },
];

const fieldInput = `${input} min-h-11 sm:min-h-10`;
const fieldLabel = `${label} mb-1 block`;

const describeCustomer = ({ lastName, phone, address }) =>
  [
    lastName,
    phone,
    [address?.street, address?.streetNumber].filter(Boolean).join(" "),
    address?.city,
  ]
    .filter(Boolean)
    .join(" · ");

const formatAddress = (address) =>
  [
    [address?.street, address?.streetNumber].filter(Boolean).join(" "),
    [address?.postalCode, address?.city].filter(Boolean).join(" "),
    address?.country,
  ]
    .filter(Boolean)
    .join(", ");

// Read-only summary of the selected Customer with the button that opens the
// form to edit the details.
function CustomerCard({ form, isDelivery, onEdit }) {
  const name = [form.firstName, form.lastName].filter(Boolean).join(" ");
  const address = formatAddress(form.address);

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="m-0 font-semibold text-neutral-900">{name}</p>
        {form.phone && (
          <p className={`m-0 flex items-center gap-1.5 ${muted}`}>
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            {form.phone}
          </p>
        )}
        {isDelivery && address && (
          <p className={`m-0 flex items-start gap-1.5 ${muted}`}>
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {address}
          </p>
        )}
      </div>
      <button
        type="button"
        className={`${button} min-h-10 shrink-0 px-2.5 text-xs`}
        onClick={onEdit}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        Edit details
      </button>
    </div>
  );
}

// Customer part of the ticket: the first name input also searches the
// Company's Customers; selecting one fills the form. A selected Customer is
// shown as a card until "Edit details"; the form opens by itself while a
// required field is missing (incomplete) and stays open once edited.
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
  incomplete = false,
  errors = {},
}) {
  // Id of the selected Customer whose form is open: selecting another
  // Customer shows its card again.
  const [editingId, setEditingId] = useState(null);
  const isDelivery = orderType === ORDER_TYPE.DELIVERY;
  const editing = Boolean(selectedCustomer) && editingId === selectedCustomer.id;
  const showCard = Boolean(selectedCustomer) && !editing && !incomplete;
  const results = selectedCustomer
    ? []
    : filterCustomersByFirstName(customers, form.firstName);
  const searching = !selectedCustomer && form.firstName.trim() !== "";

  const openForm = () => {
    if (selectedCustomer) setEditingId(selectedCustomer.id);
  };
  const setField = (field, value) => {
    openForm();
    onFormChange({ ...form, [field]: value });
  };
  const setAddressField = (field, value) => {
    openForm();
    onFormChange({ ...form, address: { ...form.address, [field]: value } });
  };

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-2 flex w-full items-center justify-between text-xs font-semibold tracking-wide text-neutral-500 uppercase">
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

      {showCard ? (
        <CustomerCard form={form} isDelivery={isDelivery} onEdit={openForm} />
      ) : (
        <>
          <div className="relative">
            <label htmlFor="customerFirstName" className={fieldLabel}>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="customerLastName" className={fieldLabel}>
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
              <label htmlFor="customerPhone" className={fieldLabel}>
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
          </div>

          {isDelivery && (
            <div className="grid grid-cols-6 gap-3">
              {ADDRESS_INPUTS.map(({ field, label: text, required, span }) => (
                <div key={field} className={`min-w-0 ${span}`}>
                  <label htmlFor={`customer-${field}`} className={`${fieldLabel} truncate`}>
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
        </>
      )}
    </fieldset>
  );
}
