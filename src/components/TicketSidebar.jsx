import { Bike, Clock, ShoppingBag, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCustomer, getCustomersByCompanyId } from "../services/customer.service";
import {
  calculateOrderTotal,
  createOrder,
  ORDER_TYPE,
  updateItemQuantity,
  updateOrder,
} from "../services/order.service";
import { getItemProduct, ITEM_PRODUCT_STATUS } from "../services/product.service";
import { customerToForm, EMPTY_CUSTOMER_FORM } from "../utils/customerForm";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { formatPrice } from "../utils/format";
import { readPrintOnSave, writePrintOnSave } from "../utils/printPreference";
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
import ConfirmDialog from "./ConfirmDialog";
import LoadingState from "./LoadingState";
import FieldError from "./FieldError";
import ItemConfigModal from "./ItemConfigModal";
import MenuTableauPanel from "./MenuTableauPanel";
import TicketCustomerSection from "./TicketCustomerSection";
import TicketSummary from "./TicketSummary";
import { logError } from "../utils/logger";

const ORDER_TYPE_OPTIONS = [
  { value: ORDER_TYPE.TAKEAWAY, label: "Takeaway", Icon: ShoppingBag },
  { value: ORDER_TYPE.DELIVERY, label: "Delivery", Icon: Bike },
];

// Small uppercase heading of a sidebar section.
const sectionHeading =
  "mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase";

// Customer form fields checked by validateTicketForm.
const CUSTOMER_FIELDS = ["firstName", "phone", "street", "streetNumber", "postalCode", "city"];

/**
 * Right sidebar for ticket creation: order type, customer and scheduled time.
 * With an order it edits that Order instead, prefilled from it. When "Print
 * on save" is on, onSaved receives the new ticket ({ order, customer }) for
 * the print preview; edits never print automatically. Closing with unsaved
 * changes asks for confirmation.
 * @param {object} props
 * @param {string} props.companyId
 * @param {string} props.storeId
 * @param {?object} [props.order] - Order to edit; null to create.
 * @param {function(): void} props.onClose
 * @param {function({order: object, customer: object}): void} [props.onSaved]
 * @returns {JSX.Element}
 * @example
 * <TicketSidebar companyId={companyId} storeId={storeId} onClose={close} onSaved={print} />
 */
export default function TicketSidebar({
  companyId,
  storeId,
  order = null,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(order);
  const originalTime = isEdit ? dateToTime(order.scheduledTime) : null;
  const [orderType, setOrderType] = useState(order?.orderType ?? ORDER_TYPE.TAKEAWAY);
  const [menuOpen, setMenuOpen] = useState(false);
  // Set by the cashier's own edits (not by loading the Order's Customer):
  // closing then asks before discarding them, as a stray tap on the
  // backdrop is easy on touch screens.
  const [changed, setChanged] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
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
  // Index of the Item whose Product is loading for an edit; the ref also
  // blocks repeated clicks that arrive before the next render.
  const [editingItem, setEditingItem] = useState(null);
  const editingIndex = useRef(null);
  // The product panel can stay open after the last free line is used: a new
  // line is refused at the limit.
  const selectProduct = useCallback(
    (product) => {
      if (items.length < FIELD_LIMITS.LIST_SIZE)
        setConfig({ product, index: null, restricted: false });
    },
    [items.length],
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
      setChanged(true);
    },
    [config],
  );
  const changeQuantity = useCallback((index, quantity) => {
    setItems((list) =>
      list.map((item, i) => (i === index ? updateItemQuantity(item, quantity) : item)),
    );
    setChanged(true);
  }, []);
  const removeItem = useCallback((index) => {
    setItems((list) => list.filter((_, i) => i !== index));
    setSavedQuantities((list) => list.filter((_, i) => i !== index));
    setItemMessage(null);
    setChanged(true);
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
      if (editingIndex.current !== null) return;
      const item = items[index];

      setItemMessage(null);
      editingIndex.current = index;
      setEditingItem(index);

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
        logError("Error loading product -> ", err);
        setItemMessage({ index, text: "Could not load the product. Try again." });
      } finally {
        editingIndex.current = null;
        setEditingItem(null);
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
  // An Order without customerId has nothing to load.
  const [orderCustomerState, setOrderCustomerState] = useState(
    isEdit && order?.customerId ? "loading" : "ready",
  );
  const [orderCustomerRetryKey, setOrderCustomerRetryKey] = useState(0);
  // Inline field errors appear after the first save attempt and then follow the form.
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [printOnSave, setPrintOnSave] = useState(readPrintOnSave);
  const found = validateTicketForm({
    orderType,
    form: customerForm,
    scheduledTime,
    items,
    originalTime,
  });
  const errors = submitted ? found : {};
  // A required customer field is missing: the customer form stays visible.
  const customerIncomplete = CUSTOMER_FIELDS.some((field) => found[field]);
  const itemCount = items.reduce((total, item) => total + (item.quantity ?? 0), 0);

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
        const newScheduledTime = timeToDate(scheduledTime);

        await createOrder({
          ...data,
          storeId,
          scheduledTime: newScheduledTime,
        });
        if (printOnSave) {
          onSaved?.({
            order: {
              orderType,
              scheduledTime: newScheduledTime,
              items,
              total: calculateOrderTotal(items),
            },
            customer: customerForm,
          });
        }
      }
      onClose();
    } catch (err) {
      logError("Error saving ticket -> ", err);
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
    setChanged(true);
  }, []);

  const clearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setChanged(true);
  }, []);

  const changeCustomerForm = useCallback((form) => {
    setCustomerForm(form);
    setChanged(true);
  }, []);

  // Closes at once when nothing was entered, otherwise asks first.
  const requestClose = useCallback(() => {
    if (saving) return;
    if (changed) setConfirmingClose(true);
    else onClose();
  }, [saving, changed, onClose]);

  useEffect(() => {
    let cancelled = false;

    setCustomersError(null);
    setCustomersLoading(true);

    getCustomersByCompanyId(companyId)
      .then((list) => {
        if (!cancelled) setCustomers(list);
      })
      .catch((err) => {
        logError("Error loading customers -> ", err);
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
        logError("Error loading the ticket customer -> ", err);
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
      // While the menu panel, the configuration step or the discard
      // confirmation is open, Escape closes only that layer.
      if (event.key === "Escape" && !menuOpen && !config && !confirmingClose)
        requestClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requestClose, menuOpen, config, confirmingClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        data-testid="ticket-backdrop"
        onClick={requestClose}
      />
      <aside
        role="dialog"
        aria-label={isEdit ? "Edit ticket" : "Create ticket"}
        className="relative flex h-full w-full flex-col bg-white text-left shadow-xl sm:max-w-md lg:max-w-[54rem]"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <h2 className={`${sectionTitle} m-0`}>
            {isEdit ? "Edit Ticket" : "Create Ticket"}
          </h2>
          <button
            type="button"
            className={`${iconButton} size-11`}
            aria-label="Close"
            title="Close"
            disabled={saving}
            onClick={requestClose}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {/* One scrolling column; from lg order and customer on the left,
            items on the right, each scrolling on its own. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-2 lg:overflow-hidden">
          <div className="flex flex-col gap-5 p-4 lg:overflow-y-auto">
            <div>
              <div className="grid grid-cols-[1fr_7rem] items-end gap-2 sm:grid-cols-[1fr_8.5rem]">
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className={sectionHeading}>Order type</legend>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
                    {ORDER_TYPE_OPTIONS.map(({ value, label, Icon }) => (
                      <label
                        key={value}
                        className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400 ${
                          orderType === value
                            ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-200"
                            : "text-neutral-600 hover:bg-white/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name="orderType"
                          value={value}
                          checked={orderType === value}
                          onChange={() => {
                            setOrderType(value);
                            setChanged(true);
                          }}
                          className="sr-only"
                        />
                        <Icon className="size-4 shrink-0 max-sm:hidden" aria-hidden="true" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="min-w-0">
                  <label
                    htmlFor="scheduledTime"
                    className={`${sectionHeading} flex items-center gap-1.5 truncate`}
                  >
                    <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                    {orderType === ORDER_TYPE.DELIVERY ? "Delivery time" : "Pickup time"}
                  </label>
                  <input
                    id="scheduledTime"
                    type="time"
                    className={`${input} min-h-12 font-semibold`}
                    value={scheduledTime}
                    aria-invalid={Boolean(errors.scheduledTime)}
                    aria-describedby={errors.scheduledTime ? "scheduledTime-error" : undefined}
                    onChange={(event) => {
                      setScheduledTime(event.target.value);
                      setChanged(true);
                    }}
                  />
                </div>
              </div>
              <FieldError id="scheduledTime-error" message={errors.scheduledTime} />
              {!isEdit && (
                <p className={`${muted} mt-1 text-xs`}>Today. Defaults to 30 minutes from now.</p>
              )}
            </div>

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
              onFormChange={changeCustomerForm}
              selectedCustomer={selectedCustomer}
              onSelect={selectCustomer}
              onClear={clearCustomer}
              incomplete={customerIncomplete}
              errors={errors}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-neutral-200 p-4 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:bg-neutral-50">
            <TicketSummary
              items={items}
              onAddProduct={() => setMenuOpen(true)}
              onChangeQuantity={changeQuantity}
              onRemove={removeItem}
              onEdit={editItem}
              maxQuantities={maxQuantities}
              itemStatuses={items.map((item) => productStatuses[item.productId])}
              itemMessages={itemMessage ? { [itemMessage.index]: itemMessage.text } : {}}
              editingIndex={editingItem}
            />
            <FieldError id="items-error" message={errors.items} />
            {saveError && (
              <div role="alert" className={alert}>
                Could not save the ticket. Try again.
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className={`m-0 text-xs ${muted}`}>
              Total{itemCount > 0 && ` · ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            </p>
            <strong aria-label="Total" className="text-xl font-bold tabular-nums">
              {formatPrice(calculateOrderTotal(items))}
            </strong>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isEdit && (
              <button
                type="button"
                role="switch"
                aria-checked={printOnSave}
                title="Print on save"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-1 text-sm text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                onClick={() => {
                  writePrintOnSave(!printOnSave);
                  setPrintOnSave(!printOnSave);
                }}
              >
                <span
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                    printOnSave ? "bg-brand-600" : "bg-neutral-300"
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                      printOnSave ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
                {/* Visible label from sm; the switch keeps its name below. */}
                <span className="max-sm:sr-only">Print on save</span>
              </button>
            )}
            <button
              type="button"
              className={`${button} min-h-11 px-4`}
              disabled={saving}
              onClick={requestClose}
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
          </div>
        </footer>
      </aside>
      {menuOpen && (
        <MenuTableauPanel
          storeId={storeId}
          onSelectProduct={selectProduct}
          onClose={closeMenuPanel}
          itemCount={itemCount}
          total={calculateOrderTotal(items)}
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
      <ConfirmDialog
        open={confirmingClose}
        title={isEdit ? "Discard your changes?" : "Discard this ticket?"}
        message="What you entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={onClose}
        onCancel={() => setConfirmingClose(false)}
      />
    </div>
  );
}
