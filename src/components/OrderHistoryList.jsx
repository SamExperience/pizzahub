import { useId, useState } from "react";
import { ChevronDown, MapPin, Phone, ShoppingBag } from "lucide-react";
import OrderItemRow from "./OrderItemRow";
import { ORDER_STATUS, ORDER_TYPE } from "../services/order.service";
import { formatAddress, formatPrice, formatTime } from "../utils/format";
import {
  ORDER_TYPE_BADGE,
  ORDER_TYPE_ICON,
  ORDER_TYPE_LABEL,
} from "../utils/orderType";
import { badge, muted, statusStyles } from "../utils/styles";

const fullName = (customer) =>
  [customer.firstName, customer.lastName].filter(Boolean).join(" ");

const timeOrDash = (timestamp) => formatTime(timestamp) || "—";

function CustomerName({ customers, customerId }) {
  // Null while the customers are loading.
  if (!customers) return <span className={muted}>Loading customer ...</span>;

  const customer = customers.get(customerId);
  if (!customer) return <span className={muted}>Customer unavailable</span>;

  return (
    <span className="truncate text-sm font-semibold text-neutral-900">
      {fullName(customer)}
    </span>
  );
}

// Read-only detail of an Order: items, customer contacts, times and total.
function OrderDetail({ id, order, customer, loadingCustomer }) {
  const isDelivery = order.orderType === ORDER_TYPE.DELIVERY;
  const times = [
    ["Created", order.createdAt],
    ["Scheduled", order.scheduledTime],
    ["Completed", order.completedAt],
  ];

  return (
    <div
      id={id}
      className="grid gap-4 border-t border-neutral-100 px-4 py-3 @xl:grid-cols-2 @xl:gap-8"
    >
      <ul aria-label="Items" className="m-0 flex list-none flex-col gap-2 p-0">
        {(order.items ?? []).map((item, index) => (
          <OrderItemRow key={`${item.productId}-${index}`} item={item} />
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        {customer ? (
          <div className="flex flex-col gap-1">
            <p className="m-0 text-sm font-semibold text-neutral-900">
              {fullName(customer)}
            </p>
            {customer.phone && (
              <p className={`m-0 flex items-center gap-1.5 ${muted}`}>
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                {customer.phone}
              </p>
            )}
            {isDelivery && customer.address && (
              <p className={`m-0 flex items-start gap-1.5 ${muted}`}>
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {formatAddress(customer.address)}
              </p>
            )}
          </div>
        ) : (
          <p className={`m-0 ${muted}`}>
            {loadingCustomer ? "Loading customer ..." : "Customer unavailable"}
          </p>
        )}
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {times.map(([name, value]) => (
            <div key={name} className="contents">
              <dt className="text-neutral-500">{name}</dt>
              <dd className="m-0 tabular-nums text-neutral-900">
                {timeOrDash(value)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="m-0 flex items-baseline justify-between gap-2 border-t border-neutral-100 pt-2">
          <span className={muted}>Total</span>
          <strong className="text-xl tabular-nums text-neutral-900">
            {formatPrice(order.total)}
          </strong>
        </p>
      </div>
    </div>
  );
}

function OrderRow({ order, customers, expanded, onToggle }) {
  const detailId = useId();
  const cancelled = order.status === ORDER_STATUS.CANCELLED;
  const TypeIcon = ORDER_TYPE_ICON[order.orderType] ?? ShoppingBag;

  return (
    <li className={`flex flex-col rounded-xl border border-neutral-200 bg-white shadow-sm ${cancelled ? "opacity-60" : ""}`}>
      <button
        type="button"
        className="flex w-full flex-col gap-2 rounded-xl px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 @xl:flex-row @xl:items-center @xl:gap-4"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-baseline gap-2 @xl:flex-1">
          <time className="shrink-0 text-lg font-bold tabular-nums text-neutral-900">
            {formatTime(order.createdAt)}
          </time>
          <CustomerName customers={customers} customerId={order.customerId} />
        </div>
        <div className="flex flex-wrap items-center gap-2 @xl:justify-end">
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
          <strong className="ml-auto text-base tabular-nums @xl:ml-0 @xl:w-20 @xl:text-right">
            {formatPrice(order.total)}
          </strong>
          <ChevronDown
            className={`size-5 shrink-0 text-neutral-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>
      {expanded && (
        <OrderDetail
          id={detailId}
          order={order}
          customer={customers?.get(order.customerId)}
          loadingCustomer={!customers}
        />
      )}
    </li>
  );
}

// Order history rows, newest first (list order). Customers is a Map by id, or
// null while loading. One row at a time expands its read-only detail.
export default function OrderHistoryList({ orders, customers }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <ul aria-label="Orders" className="@container m-0 flex list-none flex-col gap-2 p-0">
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          customers={customers}
          expanded={expandedId === order.id}
          onToggle={() =>
            setExpandedId((id) => (id === order.id ? null : order.id))
          }
        />
      ))}
    </ul>
  );
}
