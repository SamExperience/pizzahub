import { formatPrice } from "../utils/format";
import { muted } from "../utils/styles";

/**
 * One order item snapshot: quantity x name, option details and subtotal.
 * Shared by the Tableau card and the history detail so items read the same.
 * @param {object} props
 * @param {object} props.item - Item snapshot.
 * @returns {JSX.Element}
 * @example
 * <ul>{order.items.map((item, i) => <OrderItemRow key={i} item={item} />)}</ul>
 */
export default function OrderItemRow({ item }) {
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
