import { useEffect, useState } from "react";
import { getCustomer } from "../services/customer.service";
import { ORDER_TYPE } from "../services/order.service";
import { formatPrice, formatTime } from "../utils/format";
import { muted } from "../utils/styles";

const ORDER_TYPE_LABEL = {
  [ORDER_TYPE.TAKEAWAY]: "Takeaway",
  [ORDER_TYPE.DELIVERY]: "Delivery",
};

const formatAddress = (address) =>
  [
    [address?.street, address?.streetNumber].filter(Boolean).join(" "),
    [address?.postalCode, address?.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

// Loads the Customer referenced by the Order; null while loading or when unavailable.
function useCustomer(customerId) {
  const [result, setResult] = useState({ id: null, customer: null });

  useEffect(() => {
    if (!customerId) return;

    let cancelled = false;

    getCustomer(customerId)
      .then((customer) => !cancelled && setResult({ id: customerId, customer }))
      .catch((error) => {
        console.log("Error loading customer -> ", error);
        if (!cancelled) setResult({ id: customerId, customer: null });
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return {
    loading: Boolean(customerId) && result.id !== customerId,
    customer: result.id === customerId ? result.customer : null,
  };
}

function CustomerInfo({ order }) {
  const { loading, customer } = useCustomer(order.customerId);

  if (loading) return <p className={`m-0 ${muted}`}>Loading customer ...</p>;
  if (!customer)
    return <p className={`m-0 ${muted}`}>Customer unavailable</p>;

  const name = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ");
  const isDelivery = order.orderType === ORDER_TYPE.DELIVERY;

  return (
    <div className="text-sm">
      <p className="m-0 font-medium">{name}</p>
      {isDelivery && customer.phone && (
        <p className={`m-0 ${muted}`}>{customer.phone}</p>
      )}
      {isDelivery && customer.address && (
        <p className={`m-0 ${muted}`}>{formatAddress(customer.address)}</p>
      )}
    </div>
  );
}

function TicketItem({ item }) {
  const details = [item.size, item.cookingLevel, ...(item.customizations ?? [])]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0">
        <span className="font-medium">
          {item.quantity} x {item.productName}
        </span>
        {details && <p className={`m-0 ${muted}`}>{details}</p>}
      </div>
      <span className="shrink-0">{formatPrice(item.subtotal)}</span>
    </li>
  );
}

// One ticket of the Tableau: order type and time, customer, items, total, status.
export default function TicketCard({ order }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <header className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>{ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}</span>
        <time>{formatTime(order.scheduledTime)}</time>
      </header>
      <CustomerInfo order={order} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(order.items ?? []).map((item, index) => (
          <TicketItem key={`${item.productId}-${index}`} item={item} />
        ))}
      </ul>
      <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-2 text-sm dark:border-neutral-700">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          {order.status}
        </span>
        <strong>{formatPrice(order.total)}</strong>
      </footer>
    </article>
  );
}
