import { Bike, Clock, Plus, ShoppingBag, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getCustomer, getCustomersByCompanyId } from "../services/customer.service";
import {
  createOrder,
  ORDER_TYPE,
  updateItemQuantity,
  updateOrder,
} from "../services/order.service";
import { getItemProduct, ITEM_PRODUCT_STATUS } from "../services/product.service";
import { customerToForm, EMPTY_CUSTOMER_FORM } from "../utils/customerForm";
import {
  alert,
  button,
  iconButton,
  input,
  muted,
  primaryButton,
  sectionTitle,
} from "../utils/styles";
import { dateToTime, getDefaultScheduledTime, timeToDate } from "../utils/ticketTime";
import { validateTicketForm } from "../utils/ticketValidation";
import LoadingState from "./LoadingState";
import FieldError from "./FieldError";
import ItemConfigModal from "./ItemConfigModal";
import MenuTableauPanel from "./MenuTableauPanel";
import TicketCustomerSection from "./TicketCustomerSection";
import TicketSummary from "./TicketSummary";

const ORDER_TYPE_OPTIONS = [
  { value: ORDER_TYPE.TAKEAWAY, label: "Takeaway", Icon: ShoppingBag },
  { value: ORDER_TYPE.DELIVERY, label: "Delivery", Icon: Bike },
];

// Small uppercase heading of a sidebar section.
const sectionHeading =
  "mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase";

// Right sidebar for ticket creation: order type, customer and scheduled time.
// With an order it edits that Order instead, prefilled from it.
export default function TicketSidebar({ companyId, storeId, order = null, onClose }) {
  const isEdit = Boolean(order);
  const originalTime = isEdit ? dateToTime(order.scheduledTime) : null;
  const [orderType, setOrderType] = useState(order?.orderType ?? ORDER_TYPE.TAKEAWAY);
  const [menuOpen, setMenuOpen] = useState(false);
  // Configuration step: { product, index, restricted, maxQuantity } or null.
  // index is null when adding a new Item; restricted is set for an Item whose
  // Product is no longer sellable (product is null when it was deleted).
  const [config, setConfig] = useState(null);
  // Items added to the ticket (snapshots).
  const [items, setItems] = useState(order?.items ?? []);
  // Quantity saved in the ticket for each Item (null for Items added now),
  // aligned with items: the cap for Items whose Product is not sellable.
  const [savedQuantities, setSavedQuantities] = useState(() =>
    (order?.items ?? []).map((item) => item.quantity),
  );
  // Status of each Item's Product by productId (see getItemProduct).
  const [productStatuses, setProductStatuses] = useState({});
  // Escape closes only the topmost layer: the configuration modal, if open.
  const closeMenuPanel = useCallback(() => {
    if (!config) setMenuOpen(false);
  }, [config]);
  // Message under one Item of the summary: { index, text } or null.
  const [itemMessage, setItemMessage] = useState(null);
  const selectProduct = useCallback(
    (product) => setConfig({ product, index: null, restricted: false }),
    [],
  );
  const closeConfig = useCallback(() => setConfig(null), []);
  const addItem = useCallback(
    (item) => {
      const index = config?.index ?? null;

      setItems((list) =>
        index === null
          ? [...list, item]
          : list.map((current, i) => (i === index ? item : current)),
      );
      if (index === null) setSavedQuantities((list) => [...list, null]);
      setConfig(null);
    },
    [config],
  );
  const changeQuantity = useCallback((index, quantity) => {
    setItems((list) =>
      list.map((item, i) => (i === index ? updateItemQuantity(item, quantity) : item)),
    );
  }, []);
  const removeItem = useCallback((index) => {
    setItems((list) => list.filter((_, i) => i !== index));
    setSavedQuantities((list) => list.filter((_, i) => i !== index));
    setItemMessage(null);
  }, []);
  // Maximum quantity per Item: the saved quantity when its Product is not
  // sellable, otherwise no limit.
  const maxQuantities = items.map((item, index) => {
    const status = productStatuses[item.productId];
    const isLimited = status && status !== ITEM_PRODUCT_STATUS.SELLABLE;

    return isLimited ? (savedQuantities[index] ?? item.quantity) : null;
  });
  // Opens the configuration step for an existing Item with its current
  // Product: full edit when it is sellable, restricted edit otherwise.
  const editItem = useCallback(
    async (index) => {
      const item = items[index];

      setItemMessage(null);

      try {
        const { status, product } = await getItemProduct(item.productId);

        setProductStatuses((current) => ({ ...current, [item.productId]: status }));
        setConfig({
          product,
          index,
          restricted: status !== ITEM_PRODUCT_STATUS.SELLABLE,
          maxQuantity: savedQuantities[index] ?? item.quantity,
        });
      } catch (err) {
        console.log("Error loading product -> ", err);
        setItemMessage({ index, text: "Could not load the product. Try again." });
      }
    },
    [items, savedQuantities],
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

  // Edit mode: load the status of the Order's Products once, so Items whose
  // Product is no longer sellable are capped and labelled. A failed read
  // leaves the status unknown (no cap); Edit checks it again.
  const orderItems = order?.items;

  useEffect(() => {
    if (!orderItems?.length) return;

    let cancelled = false;
    const productIds = [...new Set(orderItems.map((item) => item.productId))];

    Promise.allSettled(productIds.map((id) => getItemProduct(id))).then((results) => {
      if (cancelled) return;

      const statuses = {};

      results.forEach((result, i) => {
        if (result.status === "fulfilled") statuses[productIds[i]] = result.value.status;
      });
      setProductStatuses((current) => ({ ...statuses, ...current }));
    });

    return () => {
      cancelled = true;
    };
  }, [orderItems]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // While the menu panel or the configuration step is open, Escape
      // closes only that layer.
      if (event.key === "Escape" && !menuOpen && !config && !saving) onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, menuOpen, config, saving]);

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
        className="relative flex h-full w-full flex-col bg-white text-left shadow-xl sm:max-w-md"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <h2 className={`${sectionTitle} m-0`}>
            {isEdit ? "Edit Ticket" : "Create Ticket"}
          </h2>
          <button
            type="button"
            className={iconButton}
            aria-label="Close"
            title="Close"
            disabled={saving}
            onClick={onClose}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <fieldset className="m-0 border-0 p-0">
            <legend className={sectionHeading}>Order type</legend>
            <div className="grid grid-cols-2 gap-2">
              {ORDER_TYPE_OPTIONS.map(({ value, label, Icon }) => (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400 ${
                    orderType === value
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
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
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {orderCustomerState === "loading" && (
            <LoadingState text="Loading customer ..." />
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
            <label
              htmlFor="scheduledTime"
              className={`${sectionHeading} flex items-center gap-1.5`}
            >
              <Clock className="size-4" aria-hidden="true" />
              {orderType === ORDER_TYPE.DELIVERY ? "Delivery time" : "Pickup time"}
            </label>
            <input
              id="scheduledTime"
              type="time"
              className={`${input} min-h-11`}
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
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-600 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1"
            onClick={() => setMenuOpen(true)}
          >
            <Plus className="size-5" aria-hidden="true" />
            Add product
          </button>
          <TicketSummary
            items={items}
            onChangeQuantity={changeQuantity}
            onRemove={removeItem}
            onEdit={editItem}
            maxQuantities={maxQuantities}
            itemStatuses={items.map((item) => productStatuses[item.productId])}
            itemMessages={itemMessage ? { [itemMessage.index]: itemMessage.text } : {}}
          />
          <FieldError id="items-error" message={errors.items} />
          {saveError && (
            <div role="alert" className={alert}>
              Could not save the ticket. Try again.
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-neutral-200 bg-white px-4 py-3">
          <button
            type="button"
            className={`${button} min-h-11 px-4`}
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryButton} min-h-11 px-5`}
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
          onSelectProduct={selectProduct}
          onClose={closeMenuPanel}
        />
      )}
      {config && (
        <ItemConfigModal
          product={config.product}
          initialItem={config.index === null ? null : items[config.index]}
          restricted={config.restricted}
          maxQuantity={config.maxQuantity}
          onAdd={addItem}
          onClose={closeConfig}
        />
      )}
    </div>
  );
}
