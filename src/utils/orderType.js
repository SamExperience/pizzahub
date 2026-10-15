import { Bike, ShoppingBag } from "lucide-react";
import { ORDER_TYPE } from "../services/order.service";

// Order type presentation (label, icon, badge colors), shared by the UI.

/**
 * Display label per order type; the stored values stay lowercase codes.
 * @type {Object<string, string>}
 * @example
 * ORDER_TYPE_LABEL[order.orderType]; // "Takeaway"
 */
export const ORDER_TYPE_LABEL = {
  [ORDER_TYPE.TAKEAWAY]: "Takeaway",
  [ORDER_TYPE.DELIVERY]: "Delivery",
};

/**
 * lucide-react icon per order type, so cards and history look the same.
 * @type {Object<string, ComponentType>}
 * @example
 * const Icon = ORDER_TYPE_ICON[order.orderType];
 * <Icon className="size-4" />;
 */
export const ORDER_TYPE_ICON = {
  [ORDER_TYPE.TAKEAWAY]: ShoppingBag,
  [ORDER_TYPE.DELIVERY]: Bike,
};

/**
 * Tailwind badge colors per order type, distinct from the status colors.
 * @type {Object<string, string>}
 * @example
 * <span className={`${badge} ${ORDER_TYPE_BADGE[order.orderType]}`} />
 */
export const ORDER_TYPE_BADGE = {
  [ORDER_TYPE.TAKEAWAY]: "bg-neutral-100 text-neutral-700",
  [ORDER_TYPE.DELIVERY]: "bg-sky-50 text-sky-800",
};
