import { useEffect, useId, useRef, useState } from "react";
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  MapPin,
  Pencil,
  Phone,
  ShoppingBag,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { subscribeToCustomer } from "../services/customer.service";
import {
  ORDER_STATUS,
  ORDER_STATUSES,
  ORDER_TYPE,
} from "../services/order.service";
import { formatPrice, formatTime } from "../utils/format";
import {
  ORDER_TYPE_BADGE,
  ORDER_TYPE_ICON,
  ORDER_TYPE_LABEL,
} from "../utils/orderType";
import {
  alert,
  badge,
  button,
  iconButton,
  muted,
  primaryButton,
  statusStyles,
} from "../utils/styles";

// Visible labels of the status moves, keyed by target status; moves without
// a label are icon-only ("Move to <status>").
const FORWARD_LABEL = {
  [ORDER_STATUS.IN_PROGRESS]: "Start",
  [ORDER_STATUS.COMPLETED]: "Complete",
};

const BACK_LABEL = {
  [ORDER_STATUS.IN_PROGRESS]: "Reopen",
};

const formatStreet = (address) =>
  [address?.street, address?.streetNumber].filter(Boolean).join(" ");

const formatAddress = (address) =>
  [formatStreet(address), [address?.postalCode, address?.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

const countItems = (items = []) =>
  items.reduce((total, item) => total + (item.quantity ?? 0), 0);

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

function CustomerName({ loading, customer }) {
  if (loading) return <span className={muted}>Loading customer ...</span>;
  if (!customer) return <span className={muted}>Customer unavailable</span>;

  return (
    <span className="truncate text-sm font-semibold text-neutral-900">
      {[customer.firstName, customer.lastName].filter(Boolean).join(" ")}
    </span>
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

// "More actions" menu holding the edit and cancel actions. Escape and clicks
// outside close it.
function ActionsMenu({ disabled, onEdit, onCancel }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const choose = (action) => {
    setOpen(false);
    action();
  };
  const menuItem =
    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:bg-neutral-100";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={`${button} size-10 min-h-10 px-0 ${open ? "border-brand-300 bg-brand-50 text-brand-700" : ""}`}
        aria-label="More actions"
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Ticket actions"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              className={`${menuItem} text-neutral-700 hover:bg-neutral-50`}
              onClick={() => choose(onEdit)}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit ticket
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              role="menuitem"
              className={`${menuItem} text-red-700 hover:bg-red-50`}
              onClick={() => choose(onCancel)}
            >
              <Ban className="size-4" aria-hidden="true" />
              Cancel ticket
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// One ticket of the Tableau. Collapsed: time, customer, order type, item
// count, total and actions; expanded (card click or the details toggle):
// customer contacts and items. The status moves go one status back or
// forward; edit and cancel sit in the "More actions" menu.
export default function TicketCard({ order, onChangeStatus, onEdit, onCancel }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingOrder, setConfirmingOrder] = useState(null);
  const detailsId = useId();
  const { loading, customer } = useCustomer(order.customerId);

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

  const toggleExpanded = () => setExpanded((value) => !value);

  const styles = statusStyles[order.status];
  const TypeIcon = ORDER_TYPE_ICON[order.orderType] ?? ShoppingBag;
  const isDelivery = order.orderType === ORDER_TYPE.DELIVERY;
  const itemCount = countItems(order.items);
  const street = isDelivery ? formatStreet(customer?.address) : "";
  const actionSize = "min-h-10 max-md:min-h-11";
  const backLabel = BACK_LABEL[previousStatus];
  const forwardLabel = FORWARD_LABEL[nextStatus];
  const hasStatusMoves = onChangeStatus && (previousStatus || nextStatus);

  return (
    <article
      className={`flex flex-col gap-2.5 rounded-xl border border-l-4 bg-white p-3 shadow-sm transition-shadow ${
        expanded ? "border-brand-200 shadow-md" : "border-neutral-200"
      } ${styles?.border ?? "border-l-neutral-300"}`}
    >
      {/* Card click is a mouse convenience; keyboard users use the toggle. */}
      <div className="flex cursor-pointer flex-col gap-1" onClick={toggleExpanded}>
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <time className="shrink-0 text-lg font-bold tabular-nums text-neutral-900">
              {formatTime(order.scheduledTime)}
            </time>
            <CustomerName loading={loading} customer={customer} />
          </div>
          <span
            className={`${badge} shrink-0 ${ORDER_TYPE_BADGE[order.orderType] ?? "bg-neutral-100 text-neutral-700"}`}
          >
            <TypeIcon className="size-3.5" aria-hidden="true" />
            {ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}
          </span>
        </header>
        <div className="flex items-center justify-between gap-2">
          <span className={`min-w-0 truncate ${muted}`}>
            {itemCount} {itemCount === 1 ? "item" : "items"}
            {street && ` · ${street}`}
          </span>
          <strong className="shrink-0 text-base tabular-nums">
            {formatPrice(order.total)}
          </strong>
        </div>
        {expanded && (
          <div
            id={detailsId}
            className="mt-1.5 flex flex-col gap-2 border-t border-neutral-100 pt-2"
          >
            {isDelivery && customer?.phone && (
              <p className={`m-0 flex items-center gap-1.5 ${muted}`}>
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                {customer.phone}
              </p>
            )}
            {isDelivery && customer?.address && (
              <p className={`m-0 flex items-start gap-1.5 ${muted}`}>
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {formatAddress(customer.address)}
              </p>
            )}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {(order.items ?? []).map((item, index) => (
                <TicketItem key={`${item.productId}-${index}`} item={item} />
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasStatusMoves && previousStatus && (
          <button
            type="button"
            className={`${button} ${actionSize} ${backLabel ? "" : "size-10 px-0 max-md:size-11"}`}
            aria-label={backLabel ? undefined : `Move to ${previousStatus}`}
            title={`Move to ${previousStatus}`}
            disabled={saving}
            onClick={() => run(() => onChangeStatus(order, previousStatus))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </button>
        )}
        {hasStatusMoves && nextStatus && (
          <button
            type="button"
            className={`${primaryButton} ${actionSize} max-md:px-4`}
            title={`Move to ${nextStatus}`}
            disabled={saving}
            onClick={() => run(() => onChangeStatus(order, nextStatus))}
          >
            {forwardLabel ?? `Move to ${nextStatus}`}
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        )}
        <span className="ml-auto" />
        {(onEdit || onCancel) && (
          <ActionsMenu
            disabled={saving}
            onEdit={onEdit && (() => onEdit(order))}
            onCancel={onCancel && (() => setConfirmingOrder(order))}
          />
        )}
        <button
          type="button"
          className={`${iconButton} size-10 max-md:size-11`}
          aria-label={expanded ? "Hide details" : "Show details"}
          title={expanded ? "Hide details" : "Show details"}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={toggleExpanded}
        >
          <ChevronDown
            className={`size-5 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>
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
