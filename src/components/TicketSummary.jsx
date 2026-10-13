import { calculateOrderTotal } from "../services/order.service";
import { ITEM_PRODUCT_STATUS } from "../services/product.service";
import { formatPrice } from "../utils/format";
import { button, dangerButton, muted } from "../utils/styles";
import FieldError from "./FieldError";

const STATUS_LABEL = {
  [ITEM_PRODUCT_STATUS.UNAVAILABLE]: "Unavailable",
  [ITEM_PRODUCT_STATUS.DELETED]: "No longer on the menu",
};

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
      <h3 className="m-0 mb-2 text-sm font-medium">Ticket summary</h3>
      {items.length === 0 ? (
        <p className={`${muted} m-0`}>No products added yet.</p>
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
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3"
              >
                <div className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{item.productName}</span>
                    {details && <p className={`m-0 ${muted}`}>{details}</p>}
                    {statusLabel && (
                      <em className="mt-1 block w-fit rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium not-italic text-neutral-700">
                        {statusLabel}
                      </em>
                    )}
                  </div>
                  <span className="shrink-0 font-medium">
                    {formatPrice(item.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className={button}
                      aria-label={`Decrease quantity of ${item.productName}`}
                      disabled={item.quantity <= 1}
                      onClick={() => onChangeQuantity(index, item.quantity - 1)}
                    >
                      −
                    </button>
                    <output
                      aria-label={`Quantity of ${item.productName}`}
                      className="min-w-6 text-center text-base font-semibold"
                    >
                      {item.quantity}
                    </output>
                    <button
                      type="button"
                      className={button}
                      aria-label={`Increase quantity of ${item.productName}`}
                      disabled={maxQuantity !== null && item.quantity >= maxQuantity}
                      onClick={() => onChangeQuantity(index, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {onEdit && (
                      <button
                        type="button"
                        className={button}
                        aria-label={`Edit ${item.productName}`}
                        onClick={() => onEdit(index)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className={dangerButton}
                      aria-label={`Remove ${item.productName}`}
                      onClick={() => onRemove(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <FieldError message={itemMessages[index]} />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-3 text-base">
        <span className="font-medium">Total</span>
        <strong aria-label="Total">{formatPrice(calculateOrderTotal(items))}</strong>
      </div>
    </section>
  );
}
