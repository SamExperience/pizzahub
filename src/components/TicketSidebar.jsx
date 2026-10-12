import { useCallback, useEffect, useState } from "react";
import { getCustomer, getCustomersByCompanyId } from "../services/customer.service";
import {
  createOrder,
  ORDER_TYPE,
  updateItemQuantity,
  updateOrder,
} from "../services/order.service";
import { getProductById } from "../services/product.service";
import { customerToForm, EMPTY_CUSTOMER_FORM } from "../utils/customerForm";
import { alert, button, ghostButton, input, muted, primaryButton } from "../utils/styles";
import { dateToTime, getDefaultScheduledTime, timeToDate } from "../utils/ticketTime";
import { validateTicketForm } from "../utils/ticketValidation";
import FieldError from "./FieldError";
import ItemConfigModal from "./ItemConfigModal";
import MenuTableauPanel from "./MenuTableauPanel";
import TicketCustomerSection from "./TicketCustomerSection";
import TicketSummary from "./TicketSummary";

const ORDER_TYPE_OPTIONS = [
  { value: ORDER_TYPE.TAKEAWAY, label: "Takeaway" },
  { value: ORDER_TYPE.DELIVERY, label: "Delivery" },
];

// Right sidebar for ticket creation: order type, customer and scheduled time.
// With an order it edits that Order instead, prefilled from it.
export default function TicketSidebar({ companyId, storeId, order = null, onClose }) {
  const isEdit = Boolean(order);
  const originalTime = isEdit ? dateToTime(order.scheduledTime) : null;
  const [orderType, setOrderType] = useState(order?.orderType ?? ORDER_TYPE.TAKEAWAY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [configProduct, setConfigProduct] = useState(null);
  // Items added to the ticket (snapshots).
  const [items, setItems] = useState(order?.items ?? []);
  // Escape closes only the topmost layer: the configuration modal, if open.
  const closeMenuPanel = useCallback(() => {
    if (!configProduct) setMenuOpen(false);
  }, [configProduct]);
  // Index of the Item being reconfigured; null when adding a new Item.
  const [configIndex, setConfigIndex] = useState(null);
  // Message under one Item of the summary: { index, text } or null.
  const [itemMessage, setItemMessage] = useState(null);
  const closeConfig = useCallback(() => {
    setConfigProduct(null);
    setConfigIndex(null);
  }, []);
  const addItem = useCallback(
    (item) => {
      setItems((list) =>
        configIndex === null
          ? [...list, item]
          : list.map((current, i) => (i === configIndex ? item : current)),
      );
      setConfigProduct(null);
      setConfigIndex(null);
    },
    [configIndex],
  );
  const changeQuantity = useCallback((index, quantity) => {
    setItems((list) =>
      list.map((item, i) => (i === index ? updateItemQuantity(item, quantity) : item)),
    );
  }, []);
  const removeItem = useCallback((index) => {
    setItems((list) => list.filter((_, i) => i !== index));
    setItemMessage(null);
  }, []);
  // Reopens the configuration step for an Item with the current Product, so
  // it is repriced from the menu. A deleted or unavailable Product keeps the
  // Item as it is.
  const editItem = useCallback(
    async (index) => {
      setItemMessage(null);

      try {
        const product = await getProductById(items[index].productId);

        if (product.isAvailable === false) {
          setItemMessage({ index, text: "Product no longer available" });
          return;
        }

        setConfigIndex(index);
        setConfigProduct(product);
      } catch (err) {
        console.log("Error loading product -> ", err);
        const missing =
          err?.message === "Product not found" || err?.code === "permission-denied";

        setItemMessage({
          index,
          text: missing ? "Product no longer available" : "Could not load the product. Try again.",
        });
      }
    },
    [items],
  );
  const [scheduledTime, setScheduledTime] = useState(
    () => originalTime ?? getDefaultScheduledTime(),
  );
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState(null);
  // Bumped to reload the Customers on retry.
  const [customersRetryKey, setCustomersRetryKey] = useState(0);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // Edit mode: loading of the Order's Customer ("loading" | "ready" | "error").
  const [orderCustomerState, setOrderCustomerState] = useState(
    isEdit ? "loading" : "ready",
  );
  const [orderCustomerRetryKey, setOrderCustomerRetryKey] = useState(0);
  // Inline field errors appear after the first save attempt and then follow the form.
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const found = validateTicketForm({
    orderType,
    form: customerForm,
    scheduledTime,
    items,
    originalTime,
  });
  const errors = submitted ? found : {};

  const handleSave = async () => {
    setSubmitted(true);
    setSaveError(null);

    if (Object.keys(found).length > 0) return;

    setSaving(true);

    const data = {
      companyId,
      orderType,
      items,
      customerData: customerForm,
      existingCustomer: selectedCustomer,
    };

    try {
      if (isEdit) {
        // Keep the Order's original day.
        const day = order.scheduledTime?.toDate?.() ?? order.scheduledTime;

        await updateOrder({
          ...data,
          orderId: order.id,
          scheduledTime: timeToDate(scheduledTime, day),
        });
      } else {
        await createOrder({
          ...data,
          storeId,
          scheduledTime: timeToDate(scheduledTime),
        });
      }
      onClose();
    } catch (err) {
      console.log("Error saving ticket -> ", err);
      setSaveError(err);
      setSaving(false);
    }
  };

  const retryCustomers = useCallback(
    () => setCustomersRetryKey((key) => key + 1),
    [],
  );

  const selectCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    setCustomerForm(customerToForm(customer));
  }, []);

  const clearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerForm(EMPTY_CUSTOMER_FORM);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setCustomersError(null);
    setCustomersLoading(true);

    getCustomersByCompanyId(companyId)
      .then((list) => {
        if (!cancelled) setCustomers(list);
      })
      .catch((err) => {
        console.log("Error loading customers -> ", err);
        if (!cancelled) setCustomersError(err);
      })
      .finally(() => {
        if (!cancelled) setCustomersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, customersRetryKey]);

  // Edit mode: select the Order's Customer once loaded. A missing Customer
  // leaves the form empty.
  const orderCustomerId = order?.customerId;

  useEffect(() => {
    if (!orderCustomerId) return;

    let cancelled = false;

    getCustomer(orderCustomerId)
      .then((customer) => {
        if (cancelled) return;
        if (customer) {
          setSelectedCustomer(customer);
          setCustomerForm(customerToForm(customer));
        }
        setOrderCustomerState("ready");
      })
      .catch((err) => {
        console.log("Error loading the ticket customer -> ", err);
        if (!cancelled) setOrderCustomerState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [orderCustomerId, orderCustomerRetryKey]);

  const retryOrderCustomer = () => {
    setOrderCustomerState("loading");
    setOrderCustomerRetryKey((key) => key + 1);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      // While the menu panel or the configuration step is open, Escape
      // closes only that layer.
      if (event.key === "Escape" && !menuOpen && !configProduct && !saving) onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, menuOpen, configProduct, saving]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        data-testid="ticket-backdrop"
        onClick={saving ? undefined : onClose}
      />
      <aside
        role="dialog"
        aria-label={isEdit ? "Edit ticket" : "Create ticket"}
        className="relative flex h-full w-full max-w-md flex-col bg-white text-left shadow-xl dark:bg-neutral-900"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="m-0 text-xl font-semibold">
            {isEdit ? "Edit Ticket" : "Create Ticket"}
          </h2>
          <button
            type="button"
            className={ghostButton}
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-medium">Order type</legend>
            <div className="grid grid-cols-2 gap-2">
              {ORDER_TYPE_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-purple-400 ${
                    orderType === value
                      ? "border-purple-600 bg-purple-600 text-white dark:border-purple-500 dark:bg-purple-500"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="orderType"
                    value={value}
                    checked={orderType === value}
                    onChange={() => setOrderType(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {orderCustomerState === "loading" && (
            <p className={`${muted} m-0`}>Loading customer ...</p>
          )}
          {orderCustomerState === "error" && (
            <div role="alert" className={`${alert} flex flex-wrap items-center gap-3`}>
              Could not load the ticket's customer.
              <button type="button" className={button} onClick={retryOrderCustomer}>
                Try again
              </button>
            </div>
          )}
          <TicketCustomerSection
            orderType={orderType}
            customers={customers}
            loading={customersLoading}
            error={customersError}
            onRetry={retryCustomers}
            form={customerForm}
            onFormChange={setCustomerForm}
            selectedCustomer={selectedCustomer}
            onSelect={selectCustomer}
            onClear={clearCustomer}
            errors={errors}
          />

          <div>
            <label htmlFor="scheduledTime" className="mb-1 block text-sm font-medium">
              {orderType === ORDER_TYPE.DELIVERY ? "Delivery time" : "Pickup time"}
            </label>
            <input
              id="scheduledTime"
              type="time"
              className={input}
              value={scheduledTime}
              aria-invalid={Boolean(errors.scheduledTime)}
              aria-describedby={errors.scheduledTime ? "scheduledTime-error" : undefined}
              onChange={(event) => setScheduledTime(event.target.value)}
            />
            <FieldError id="scheduledTime-error" message={errors.scheduledTime} />
            {!isEdit && (
              <p className={`${muted} mt-1`}>Today. Defaults to 30 minutes from now.</p>
            )}
          </div>

          <button
            type="button"
            className={primaryButton}
            onClick={() => setMenuOpen(true)}
          >
            Add product
          </button>
          <TicketSummary
            items={items}
            onChangeQuantity={changeQuantity}
            onRemove={removeItem}
            onEdit={editItem}
            itemMessages={itemMessage ? { [itemMessage.index]: itemMessage.text } : {}}
          />
          <FieldError id="items-error" message={errors.items} />
          {saveError && (
            <div role="alert" className={alert}>
              Could not save the ticket. Try again.
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <button type="button" className={button} disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={saving || orderCustomerState !== "ready"}
            onClick={handleSave}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save ticket"}
          </button>
        </footer>
      </aside>
      {menuOpen && (
        <MenuTableauPanel
          storeId={storeId}
          onSelectProduct={setConfigProduct}
          onClose={closeMenuPanel}
        />
      )}
      {configProduct && (
        <ItemConfigModal
          product={configProduct}
          initialItem={configIndex === null ? null : items[configIndex]}
          onAdd={addItem}
          onClose={closeConfig}
        />
      )}
    </div>
  );
}
