import { useCallback, useEffect, useState } from "react";
import { getCustomersByCompanyId } from "../services/customer.service";
import { ORDER_TYPE } from "../services/order.service";
import { customerToForm, EMPTY_CUSTOMER_FORM } from "../utils/customerForm";
import { button, ghostButton, input, muted } from "../utils/styles";
import { getDefaultScheduledTime } from "../utils/ticketTime";
import TicketCustomerSection from "./TicketCustomerSection";

const ORDER_TYPE_OPTIONS = [
  { value: ORDER_TYPE.TAKEAWAY, label: "Takeaway" },
  { value: ORDER_TYPE.DELIVERY, label: "Delivery" },
];

// Right sidebar for ticket creation: order type, customer and scheduled time.
export default function TicketSidebar({ companyId, onClose }) {
  const [orderType, setOrderType] = useState(ORDER_TYPE.TAKEAWAY);
  const [scheduledTime, setScheduledTime] = useState(() =>
    getDefaultScheduledTime(),
  );
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState(null);
  // Bumped to reload the Customers on retry.
  const [customersRetryKey, setCustomersRetryKey] = useState(0);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const retryCustomers = useCallback(
    () => setCustomersRetryKey((key) => key + 1),
    [],
  );

  const selectCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    setCustomerForm(customerToForm(customer));
  }, []);

  const clearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerForm(EMPTY_CUSTOMER_FORM);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setCustomersError(null);
    setCustomersLoading(true);

    getCustomersByCompanyId(companyId)
      .then((list) => {
        if (!cancelled) setCustomers(list);
      })
      .catch((err) => {
        console.log("Error loading customers -> ", err);
        if (!cancelled) setCustomersError(err);
      })
      .finally(() => {
        if (!cancelled) setCustomersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, customersRetryKey]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        data-testid="ticket-backdrop"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="Create ticket"
        className="relative flex h-full w-full max-w-md flex-col bg-white text-left shadow-xl dark:bg-neutral-900"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="m-0 text-xl font-semibold">Create Ticket</h2>
          <button
            type="button"
            className={ghostButton}
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-medium">Order type</legend>
            <div className="grid grid-cols-2 gap-2">
              {ORDER_TYPE_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-purple-400 ${
                    orderType === value
                      ? "border-purple-600 bg-purple-600 text-white dark:border-purple-500 dark:bg-purple-500"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="orderType"
                    value={value}
                    checked={orderType === value}
                    onChange={() => setOrderType(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <TicketCustomerSection
            orderType={orderType}
            customers={customers}
            loading={customersLoading}
            error={customersError}
            onRetry={retryCustomers}
            form={customerForm}
            onFormChange={setCustomerForm}
            selectedCustomer={selectedCustomer}
            onSelect={selectCustomer}
            onClear={clearCustomer}
          />

          <div>
            <label htmlFor="scheduledTime" className="mb-1 block text-sm font-medium">
              {orderType === ORDER_TYPE.DELIVERY ? "Delivery time" : "Pickup time"}
            </label>
            <input
              id="scheduledTime"
              type="time"
              className={input}
              value={scheduledTime}
              onChange={(event) => setScheduledTime(event.target.value)}
            />
            <p className={`${muted} mt-1`}>Today. Defaults to 30 minutes from now.</p>
          </div>
        </div>

        <footer className="flex justify-end border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <button type="button" className={button} onClick={onClose}>
            Cancel
          </button>
        </footer>
      </aside>
    </div>
  );
}
