import { Bike, ShoppingBag } from "lucide-react";
import { ORDER_TYPE } from "../services/order.service";

// Order type presentation (label, icon, badge colors), shared by the UI.

export const ORDER_TYPE_LABEL = {
  [ORDER_TYPE.TAKEAWAY]: "Takeaway",
  [ORDER_TYPE.DELIVERY]: "Delivery",
};

export const ORDER_TYPE_ICON = {
  [ORDER_TYPE.TAKEAWAY]: ShoppingBag,
  [ORDER_TYPE.DELIVERY]: Bike,
};

export const ORDER_TYPE_BADGE = {
  [ORDER_TYPE.TAKEAWAY]: "bg-neutral-100 text-neutral-700",
  [ORDER_TYPE.DELIVERY]: "bg-sky-50 text-sky-800",
};
