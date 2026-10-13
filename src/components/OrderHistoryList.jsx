import { ShoppingBag } from "lucide-react";
import { ORDER_STATUS } from "../services/order.service";
import { formatPrice, formatTime } from "../utils/format";
import {
  ORDER_TYPE_BADGE,
  ORDER_TYPE_ICON,
  ORDER_TYPE_LABEL,
} from "../utils/orderType";
import { badge, card, muted, statusStyles } from "../utils/styles";

function CustomerName({ customers, customerId }) {
  // Null while the customers are loading.
  if (!customers) return <span className={muted}>Loading customer ...</span>;

  const customer = customers.get(customerId);
  if (!customer) return <span className={muted}>Customer unavailable</span>;

  return (
    <span className="truncate text-sm font-semibold text-neutral-900">
      {[customer.firstName, customer.lastName].filter(Boolean).join(" ")}
    </span>
  );
}

function OrderRow({ order, customers }) {
  const cancelled = order.status === ORDER_STATUS.CANCELLED;
  const TypeIcon = ORDER_TYPE_ICON[order.orderType] ?? ShoppingBag;

  return (
    <li
      className={`${card} flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 ${
        cancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 items-baseline gap-2 sm:flex-1">
        <time className="shrink-0 text-lg font-bold tabular-nums text-neutral-900">
          {formatTime(order.createdAt)}
        </time>
        <CustomerName customers={customers} customerId={order.customerId} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span
          className={`${badge} ${ORDER_TYPE_BADGE[order.orderType] ?? "bg-neutral-100 text-neutral-700"}`}
        >
          <TypeIcon className="size-3.5" aria-hidden="true" />
          {ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}
        </span>
        <span
          className={`${badge} ${statusStyles[order.status]?.badge ?? "bg-neutral-100 text-neutral-700"}`}
        >
          {order.status}
        </span>
        <strong className="ml-auto text-base tabular-nums sm:ml-0 sm:w-20 sm:text-right">
          {formatPrice(order.total)}
        </strong>
      </div>
    </li>
  );
}

// Order history rows, newest first (list order). Customers is a Map by id, or
// null while loading.
export default function OrderHistoryList({ orders, customers }) {
  return (
    <ul aria-label="Orders" className="m-0 flex list-none flex-col gap-2 p-0">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} customers={customers} />
      ))}
    </ul>
  );
}
