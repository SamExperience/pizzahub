// Field-level validation of the ticket form, used to show inline errors
// before saving. The services keep the authoritative validation.
import { ORDER_TYPE } from "../services/order.service";
import { FIELD_LIMITS } from "./fieldLimits";
import { timeToDate } from "./ticketTime";

const DELIVERY_ADDRESS_LABELS = {
  street: "Street is required",
  streetNumber: "Street number is required",
  postalCode: "Postal code is required",
  city: "City is required",
};

const isBlank = (value) => typeof value !== "string" || value.trim() === "";

/**
 * Validates the ticket form for inline errors. Returns an object with one
 * message per invalid field; empty when valid. originalTime (edit mode): an
 * unchanged scheduled time is accepted even when it is already past, so a
 * late ticket can still be edited.
 * @param {object} ticket
 * @param {"takeaway"|"delivery"} ticket.orderType
 * @param {object} ticket.form - Customer form values.
 * @param {string} ticket.scheduledTime - "HH:MM".
 * @param {object[]} ticket.items
 * @param {?string} [ticket.originalTime]
 * @param {Date} [ticket.now]
 * @returns {Object<string, string>}
 * @example
 * validateTicketForm({ orderType: "takeaway", form: EMPTY_CUSTOMER_FORM, scheduledTime: "23:00", items: [] });
 * // { firstName: "First name is required", items: "Add at least one product" }
 */
export const validateTicketForm = ({
  orderType,
  form,
  scheduledTime,
  items,
  originalTime = null,
  now = new Date(),
}) => {
  const errors = {};

  if (isBlank(form.firstName)) errors.firstName = "First name is required";

  if (orderType === ORDER_TYPE.DELIVERY) {
    if (isBlank(form.phone)) errors.phone = "Phone is required for delivery";

    Object.entries(DELIVERY_ADDRESS_LABELS).forEach(([field, message]) => {
      if (isBlank(form.address?.[field])) errors[field] = message;
    });
  }

  const date = timeToDate(scheduledTime, now);

  if (!date) errors.scheduledTime = "Scheduled time is required";
  // The time input has minute precision: the current minute is still valid.
  else if (
    scheduledTime !== originalTime &&
    date.getTime() < Math.floor(now.getTime() / 60000) * 60000
  )
    errors.scheduledTime = "Scheduled time is in the past";

  if (!items?.length) errors.items = "Add at least one product";
  else if (items.length > FIELD_LIMITS.LIST_SIZE)
    errors.items = `Maximum ${FIELD_LIMITS.LIST_SIZE} products per ticket.`;

  return errors;
};
