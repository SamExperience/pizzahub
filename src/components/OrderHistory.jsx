import { useEffect, useId, useState } from "react";
import LoadingState from "./LoadingState";
import OrderHistoryList from "./OrderHistoryList";
import { useStore } from "../contexts/StoreContext";
import { getCustomersByCompanyId } from "../services/customer.service";
import { getOrdersByDay } from "../services/order.service";
import {
  alert,
  button,
  emptyBox,
  input,
  label,
  sectionTitle,
} from "../utils/styles";
import { logError } from "../utils/logger";

const pad = (value) => String(value).padStart(2, "0");

// Local YYYY-MM-DD (not UTC, so it matches the day on the device).
const toDateValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Local Date from a YYYY-MM-DD value; null when empty or invalid.
const parseDateValue = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

// Read-only order history of the active Store for one day.
export default function OrderHistory() {
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const companyId = selectedStore?.companyId;
  const dateId = useId();
  const titleId = useId();
  const [dateValue, setDateValue] = useState(() => toDateValue(new Date()));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Customers by id; null while loading, empty when they could not be loaded.
  const [customers, setCustomers] = useState(null);
  // Bumped to read the orders again on retry.
  const [retryKey, setRetryKey] = useState(0);

  const today = toDateValue(new Date());

  const handleDateChange = (event) => {
    const date = parseDateValue(event.target.value);

    // Empty, invalid and future values keep the previous date.
    if (!date || event.target.value > toDateValue(new Date())) return;

    setDateValue(event.target.value);
  };

  useEffect(() => {
    const date = parseDateValue(dateValue);
    if (!storeId || !date) return;

    // Set to ignore the response of a superseded request.
    let ignore = false;

    setOrders([]);
    setError(null);
    setLoading(true);

    getOrdersByDay(storeId, date)
      .then((list) => {
        if (ignore) return;
        setOrders(list);
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        logError("Error loading orders -> ", err);
        setError(err);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [storeId, dateValue, retryKey]);

  // Customers are read once per Company, not on every date change.
  useEffect(() => {
    if (!companyId) return;

    let ignore = false;

    setCustomers(null);

    getCustomersByCompanyId(companyId)
      .then((list) => {
        if (!ignore) setCustomers(new Map(list.map((c) => [c.id, c])));
      })
      .catch((err) => {
        logError("Error loading customers -> ", err);
        if (!ignore) setCustomers(new Map());
      });

    return () => {
      ignore = true;
    };
  }, [companyId]);

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={titleId} className={`${sectionTitle} m-0`}>
          Order history
        </h2>
        <div className="flex flex-col gap-1">
          <label htmlFor={dateId} className={label}>
            Day
          </label>
          <input
            id={dateId}
            type="date"
            className={input}
            value={dateValue}
            max={today}
            onChange={handleDateChange}
          />
        </div>
      </header>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div role="alert" className={`${alert} flex items-center justify-between gap-3`}>
          <span>Unable to load the orders.</span>
          <button
            type="button"
            className={button}
            onClick={() => setRetryKey((key) => key + 1)}
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <p className={emptyBox}>No orders on this day.</p>
      ) : (
        <OrderHistoryList orders={orders} customers={customers} />
      )}
    </section>
  );
}
