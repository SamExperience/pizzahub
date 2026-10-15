import { Loader2, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { ITEM_PRODUCT_STATUS } from "../services/product.service";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { formatPrice } from "../utils/format";
import { emptyBox, iconButton, muted, primaryButton } from "../utils/styles";
import FieldError from "./FieldError";

const STATUS_LABEL = {
  [ITEM_PRODUCT_STATUS.UNAVAILABLE]: "Unavailable",
  [ITEM_PRODUCT_STATUS.DELETED]: "No longer on the menu",
};

// Stepper button inside the quantity pill: 40px touch target, smaller in
// wide containers.
const stepButton =
  "inline-flex size-10 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-30 @sm:size-8";

const rowIconButton = `${iconButton} size-10 @sm:size-9`;

// Ticket summary: header with the item count and "Add product", then one
// compact row per Item with quantity controls, reconfiguration and removal.
// Rows sit on one line in wide containers and on two lines otherwise. Per
// Item index: maxQuantities caps the quantity (null = no limit), itemStatuses
// labels Products no longer sellable and itemMessages shows a message under
// the Item. editingIndex is the Item whose Product is loading for an edit:
// every Edit button waits for it.
export default function TicketSummary({
  items,
  onAddProduct,
  onChangeQuantity,
  onRemove,
  onEdit,
  maxQuantities = [],
  itemStatuses = [],
  itemMessages = {},
  editingIndex = null,
}) {
  const count = items.reduce((total, item) => total + (item.quantity ?? 0), 0);
  // A new line is refused at the limit; quantity changes are not new lines.
  const linesFull = items.length >= FIELD_LIMITS.LIST_SIZE;

  return (
    <section aria-label="Ticket summary" className="@container flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
          Items{count > 0 && ` · ${count}`}
        </h3>
        {onAddProduct && (
          <button
            type="button"
            className={`${primaryButton} min-h-10 px-3`}
            disabled={linesFull}
            onClick={onAddProduct}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add product
          </button>
        )}
      </div>
      {onAddProduct && linesFull && (
        <p className={`${muted} m-0 text-xs`}>
          {`Maximum ${FIELD_LIMITS.LIST_SIZE} products per ticket.`}
        </p>
      )}
      {items.length === 0 ? (
        <p className={`${emptyBox} m-0 py-6!`}>No products added yet.</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white p-0 shadow-sm">
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
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 @sm:grid-cols-[auto_1fr_auto_auto]"
              >
                <div className="order-1 min-w-0 text-sm @sm:order-2">
                  <span className="font-semibold text-neutral-900">
                    {item.productName}
                  </span>
                  {details && <p className={`m-0 text-xs ${muted}`}>{details}</p>}
                  {statusLabel && (
                    <em className="mt-1 block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium not-italic text-amber-800">
                      {statusLabel}
                    </em>
                  )}
                </div>
                <span className="order-2 text-right text-sm font-semibold text-neutral-900 tabular-nums @sm:order-3">
                  {formatPrice(item.subtotal)}
                </span>
                <div className="order-3 flex w-fit items-center gap-1 rounded-full border border-neutral-200 p-0.5 @sm:order-1">
                  <button
                    type="button"
                    className={stepButton}
                    aria-label={`Decrease quantity of ${item.productName}`}
                    title={`Decrease quantity of ${item.productName}`}
                    disabled={item.quantity <= 1}
                    onClick={() => onChangeQuantity(index, item.quantity - 1)}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <output
                    aria-label={`Quantity of ${item.productName}`}
                    className="min-w-6 text-center text-sm font-semibold tabular-nums"
                  >
                    {item.quantity}
                  </output>
                  <button
                    type="button"
                    className={stepButton}
                    aria-label={`Increase quantity of ${item.productName}`}
                    title={`Increase quantity of ${item.productName}`}
                    disabled={maxQuantity !== null && item.quantity >= maxQuantity}
                    onClick={() => onChangeQuantity(index, item.quantity + 1)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="order-4 flex items-center justify-end gap-0.5">
                  {onEdit && (
                    <button
                      type="button"
                      className={rowIconButton}
                      aria-label={`Edit ${item.productName}`}
                      title="Edit"
                      disabled={editingIndex !== null}
                      aria-busy={editingIndex === index}
                      onClick={() => onEdit(index)}
                    >
                      {editingIndex === index ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Pencil className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${rowIconButton} text-red-600 hover:bg-red-50 hover:text-red-700`}
                    aria-label={`Remove ${item.productName}`}
                    title="Remove"
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
                {itemMessages[index] && (
                  <div className="order-5 col-span-full">
                    <FieldError message={itemMessages[index]} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
