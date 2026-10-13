import { useEffect, useState } from "react";
import {
  Bike,
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  Phone,
  ShoppingBag,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import LoadingState from "./LoadingState";
import { subscribeToCustomer } from "../services/customer.service";
import { ORDER_STATUSES, ORDER_TYPE } from "../services/order.service";
import { formatPrice, formatTime } from "../utils/format";
import {
  alert,
  badge,
  button,
  dangerButton,
  muted,
  primaryButton,
  statusStyles,
} from "../utils/styles";

const ORDER_TYPE_LABEL = {
  [ORDER_TYPE.TAKEAWAY]: "Takeaway",
  [ORDER_TYPE.DELIVERY]: "Delivery",
};

const ORDER_TYPE_ICON = {
  [ORDER_TYPE.TAKEAWAY]: ShoppingBag,
  [ORDER_TYPE.DELIVERY]: Bike,
};

const formatAddress = (address) =>
  [
    [address?.street, address?.streetNumber].filter(Boolean).join(" "),
    [address?.postalCode, address?.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

// Customer referenced by the Order, kept up to date in real time (it can be
// edited from any ticket); null while loading or when unavailable.
function useCustomer(customerId) {
  const [result, setResult] = useState({ id: null, customer: null });

  useEffect(() => {
    if (!customerId) return;

    return subscribeToCustomer(
      customerId,
      (customer) => setResult({ id: customerId, customer }),
      (error) => {
        console.log("Error loading customer -> ", error);
        setResult({ id: customerId, customer: null });
      },
    );
  }, [customerId]);

  return {
    loading: Boolean(customerId) && result.id !== customerId,
    customer: result.id === customerId ? result.customer : null,
  };
}

function CustomerInfo({ order }) {
  const { loading, customer } = useCustomer(order.customerId);

  if (loading) return <LoadingState text="Loading customer ..." />;
  if (!customer)
    return <p className={`m-0 ${muted}`}>Customer unavailable</p>;

  const name = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ");
  const isDelivery = order.orderType === ORDER_TYPE.DELIVERY;

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <p className="m-0 font-semibold text-neutral-900">{name}</p>
      {isDelivery && customer.phone && (
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
      <span className="shrink-0 tabular-nums">{formatPrice(item.subtotal)}</span>
    </li>
  );
}

// One ticket of the Tableau: order type and time, customer, items, total,
// status, the arrows that move it one status back or forward and the edit
// and cancel actions.
export default function TicketCard({ order, onChangeStatus, onEdit, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingOrder, setConfirmingOrder] = useState(null);

  const statusIndex = ORDER_STATUSES.indexOf(order.status);
  const previousStatus = statusIndex > 0 ? ORDER_STATUSES[statusIndex - 1] : null;
  const nextStatus =
    statusIndex >= 0 && statusIndex < ORDER_STATUSES.length - 1
      ? ORDER_STATUSES[statusIndex + 1]
      : null;

  // Runs a ticket action; the real-time listener then updates the Tableau.
  const run = async (action) => {
    setSaving(true);
    setError(null);

    try {
      await action();
    } catch (err) {
      console.log("Error updating ticket -> ", err);
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmCancel = () => {
    setConfirmingOrder(null);
    run(() => onCancel(confirmingOrder));
  };

  const styles = statusStyles[order.status];
  const TypeIcon = ORDER_TYPE_ICON[order.orderType] ?? ShoppingBag;
  // Icon-only actions keep four buttons inside an 18rem column.
  const actionButton = "size-10 min-h-10 px-0";

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border border-l-4 border-neutral-200 bg-white p-3 shadow-sm ${styles?.border ?? "border-l-neutral-300"}`}
    >
      <header className="flex items-center justify-between gap-2">
        <time className="flex items-center gap-1.5 text-lg font-semibold tabular-nums text-neutral-900">
          <Clock className="size-4 text-neutral-500" aria-hidden="true" />
          {formatTime(order.scheduledTime)}
        </time>
        <span className={`${badge} bg-neutral-100 text-neutral-700`}>
          <TypeIcon className="size-3.5" aria-hidden="true" />
          {ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}
        </span>
      </header>
      <CustomerInfo order={order} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(order.items ?? []).map((item, index) => (
          <TicketItem key={`${item.productId}-${index}`} item={item} />
        ))}
      </ul>
      <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-2 text-sm">
        <span className={`${badge} ${styles?.badge ?? "bg-neutral-100 text-neutral-600"}`}>
          {order.status}
        </span>
        <strong className="text-base tabular-nums">{formatPrice(order.total)}</strong>
      </footer>
      {((onChangeStatus && (previousStatus || nextStatus)) || onEdit || onCancel) && (
        <div className="flex items-center gap-2">
          {onChangeStatus && previousStatus && (
            <button
              type="button"
              className={`${button} ${actionButton}`}
              aria-label={`Move to ${previousStatus}`}
              title={`Move to ${previousStatus}`}
              disabled={saving}
              onClick={() => run(() => onChangeStatus(order, previousStatus))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
          )}
          <span className="ml-auto" />
          {onEdit && (
            <button
              type="button"
              className={`${button} ${actionButton}`}
              aria-label="Edit ticket"
              title="Edit ticket"
              disabled={saving}
              onClick={() => onEdit(order)}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              className={`${dangerButton} size-10 min-h-10 px-0`}
              aria-label="Cancel ticket"
              title="Cancel ticket"
              disabled={saving}
              onClick={() => setConfirmingOrder(order)}
            >
              <Ban className="size-4" aria-hidden="true" />
            </button>
          )}
          {onChangeStatus && nextStatus && (
            <button
              type="button"
              className={`${primaryButton} ${actionButton}`}
              aria-label={`Move to ${nextStatus}`}
              title={`Move to ${nextStatus}`}
              disabled={saving}
              onClick={() => run(() => onChangeStatus(order, nextStatus))}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className={`${alert} m-0`}>
          Could not update the ticket. Try again.
        </p>
      )}
      <ConfirmDialog
        open={confirmingOrder !== null}
        title="Cancel this ticket?"
        message="This cannot be undone."
        confirmLabel="Cancel ticket"
        cancelLabel="Keep ticket"
        destructive
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmingOrder(null)}
      />
    </article>
  );
}
