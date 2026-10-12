import { calculateOrderTotal } from "../services/order.service";
import { formatPrice } from "../utils/format";
import { button, dangerButton, muted } from "../utils/styles";

// Ticket summary: the added Items with quantity controls and the automatic total.
export default function TicketSummary({ items, onChangeQuantity, onRemove }) {
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

            return (
              <li
                key={`${item.productId}-${index}`}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
              >
                <div className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{item.productName}</span>
                    {details && <p className={`m-0 ${muted}`}>{details}</p>}
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
                      onClick={() => onChangeQuantity(index, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className={dangerButton}
                    aria-label={`Remove ${item.productName}`}
                    onClick={() => onRemove(index)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-3 text-base dark:border-neutral-700">
        <span className="font-medium">Total</span>
        <strong aria-label="Total">{formatPrice(calculateOrderTotal(items))}</strong>
      </div>
    </section>
  );
}
