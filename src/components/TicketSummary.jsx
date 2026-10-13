import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { calculateOrderTotal } from "../services/order.service";
import { ITEM_PRODUCT_STATUS } from "../services/product.service";
import { formatPrice } from "../utils/format";
import { iconButton, muted } from "../utils/styles";
import FieldError from "./FieldError";

const STATUS_LABEL = {
  [ITEM_PRODUCT_STATUS.UNAVAILABLE]: "Unavailable",
  [ITEM_PRODUCT_STATUS.DELETED]: "No longer on the menu",
};

// Round stepper button, 40px touch target.
const stepButton =
  "inline-flex size-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-40";

const rowIconButton = `${iconButton} size-10`;

// Ticket summary: the added Items with quantity controls, reconfiguration,
// removal and the automatic total. Per Item index: maxQuantities caps the
// quantity (null = no limit), itemStatuses labels Products no longer
// sellable and itemMessages shows a message under the Item.
export default function TicketSummary({
  items,
  onChangeQuantity,
  onRemove,
  onEdit,
  maxQuantities = [],
  itemStatuses = [],
  itemMessages = {},
}) {
  return (
    <section aria-label="Ticket summary">
      <h3 className="m-0 mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        Ticket summary
      </h3>
      {items.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          No products added yet.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item, index) => {
            const details = [
              item.size,
              item.cookingLevel,
              ...(item.customizations ?? []),
            ]
              .filter(Boolean)
              .join(" · ");
            const maxQuantity = maxQuantities[index] ?? null;
            const statusLabel = STATUS_LABEL[itemStatuses[index]];

            return (
              <li
                key={`${item.productId}-${index}`}
                className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-semibold text-neutral-900">
                      {item.productName}
                    </span>
                    {details && <p className={`m-0 ${muted}`}>{details}</p>}
                    {statusLabel && (
                      <em className="mt-1 block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium not-italic text-amber-800">
                        {statusLabel}
                      </em>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold text-neutral-900 tabular-nums">
                    {formatPrice(item.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={stepButton}
                      aria-label={`Decrease quantity of ${item.productName}`}
                      disabled={item.quantity <= 1}
                      onClick={() => onChangeQuantity(index, item.quantity - 1)}
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <output
                      aria-label={`Quantity of ${item.productName}`}
                      className="min-w-8 text-center text-base font-semibold tabular-nums"
                    >
                      {item.quantity}
                    </output>
                    <button
                      type="button"
                      className={stepButton}
                      aria-label={`Increase quantity of ${item.productName}`}
                      disabled={maxQuantity !== null && item.quantity >= maxQuantity}
                      onClick={() => onChangeQuantity(index, item.quantity + 1)}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <button
                        type="button"
                        className={rowIconButton}
                        aria-label={`Edit ${item.productName}`}
                        title="Edit"
                        onClick={() => onEdit(index)}
                      >
                        <Pencil className="size-5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${rowIconButton} text-red-600 hover:bg-red-50 hover:text-red-700`}
                      aria-label={`Remove ${item.productName}`}
                      title="Remove"
                      onClick={() => onRemove(index)}
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <FieldError message={itemMessages[index]} />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-3 text-lg">
        <span className="font-semibold text-neutral-900">Total</span>
        <strong aria-label="Total" className="font-bold tabular-nums">
          {formatPrice(calculateOrderTotal(items))}
        </strong>
      </div>
    </section>
  );
}
