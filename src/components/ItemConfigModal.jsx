import { AlertTriangle, ArrowLeft, Lock, Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  buildItemSnapshot,
  editRestrictedItem,
  reconfigureItem,
} from "../services/order.service";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { formatPrice } from "../utils/format";
import {
  button,
  iconButton,
  input,
  label,
  muted,
  primaryButton,
  sectionTitle,
} from "../utils/styles";

// Round quantity stepper button, 44px touch target.
const stepButton =
  "inline-flex size-11 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-40";

const pillBase =
  "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

const fieldHeading =
  "mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase";

// "2 x Margherita · Small · Rare · No basil · €10.00": the Item as saved.
const describeItem = (item) =>
  [
    `${item.quantity} x ${item.productName}`,
    item.size,
    item.cookingLevel,
    ...(item.customizations ?? []),
    formatPrice(item.subtotal),
  ]
    .filter(Boolean)
    .join(" · ");

// Read-only value of an option that cannot change (restricted edit).
function LockedValue({ heading, value }) {
  return (
    <div className="min-w-0">
      <p className={`${fieldHeading} mb-1 text-neutral-400!`}>{heading}</p>
      <p className="m-0 flex min-h-10 items-center justify-between gap-2 rounded-lg bg-neutral-100 px-3 text-sm text-neutral-600">
        <span className="truncate">{value}</span>
        <Lock className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <span className="sr-only">(locked)</span>
      </p>
    </div>
  );
}

// Item configuration step of the ticket creation. Adding: step 1 (only when
// the product has sizes) picks the size; step 2 picks cooking level,
// customizations and quantity, then adds the Item snapshot to the ticket.
// With initialItem it reconfigures that Item on one page: the saved Item is
// recalled in the header, sizes are a selector, options still offered by the
// current product are prefilled and the saved price is kept unless the size
// changes. restricted (Product no longer sellable, product may be null)
// shows the size locked and allows only customizations and a quantity up to
// maxQuantity; the cooking level stays selectable while the unavailable
// Product is still in the Menu (it has no price impact), otherwise it is
// locked too.
export default function ItemConfigModal({
  product,
  initialItem = null,
  restricted = false,
  maxQuantity = null,
  onAdd,
  onClose,
}) {
  const isEdit = Boolean(initialItem);
  const name = restricted ? initialItem.productName : product.name;
  const sizes = !restricted && Array.isArray(product.sizes) ? product.sizes : [];
  const cookingLevels = Array.isArray(product?.availableCookingLevels)
    ? product.availableCookingLevels
    : [];

  const [size, setSize] = useState(() =>
    sizes.some((item) => item.name === initialItem?.size) ? initialItem.size : null,
  );
  const [cookingLevel, setCookingLevel] = useState(() =>
    cookingLevels.includes(initialItem?.cookingLevel)
      ? initialItem.cookingLevel
      : (product?.defaultCookingLevel ?? cookingLevels[0] ?? null),
  );
  const [customizations, setCustomizations] = useState(
    initialItem?.customizations ?? [],
  );
  const [customizationText, setCustomizationText] = useState("");
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1);

  const needsSize = sizes.length > 0 && size === null;
  // Only adding uses a separate size step; editing shows the sizes inline.
  const choosingSize = !isEdit && needsSize;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const customizationsFull = customizations.length >= FIELD_LIMITS.LIST_SIZE;

  const addCustomization = () => {
    const text = customizationText.trim();

    if (text && !customizationsFull)
      setCustomizations((list) => [...list, text]);

    setCustomizationText("");
  };

  const removeCustomization = (index) =>
    setCustomizations((list) => list.filter((_, i) => i !== index));

  // Text typed but not added yet still belongs to the Item: under pressure
  // the "Add" step is easy to skip.
  const pendingCustomization = customizationText.trim();
  const itemCustomizations =
    pendingCustomization && !customizationsFull
      ? [...customizations, pendingCustomization]
      : customizations;

  const buildItem = () => {
    if (restricted)
      return editRestrictedItem(
        initialItem,
        { cookingLevel, customizations: itemCustomizations, quantity },
        maxQuantity,
        product,
      );

    const options = { size, cookingLevel, customizations: itemCustomizations, quantity };

    return initialItem
      ? reconfigureItem(product, initialItem, options)
      : buildItemSnapshot(product, options);
  };

  const item = needsSize ? null : buildItem();
  const lineTotal = item?.subtotal ?? 0;
  const atMaxQuantity = restricted && maxQuantity !== null && quantity >= maxQuantity;
  const sizeChanged = isEdit && !restricted && size !== null && size !== initialItem.size;
  // The Item's own size keeps its saved price.
  const sizePrice = (option) =>
    option.name === initialItem?.size ? initialItem.unitPrice : option.price;

  let priceNote = null;
  if (isEdit && needsSize) priceNote = { text: "Choose a size", warning: true };
  else if (sizeChanged)
    priceNote = {
      text: `Size changed: new menu price ${formatPrice(item.unitPrice)} each`,
      warning: true,
    };
  else if (isEdit)
    priceNote = {
      text: [
        `Saved price kept: ${formatPrice(initialItem.unitPrice)} each`,
        restricted && maxQuantity !== null && `max ${maxQuantity}`,
      ]
        .filter(Boolean)
        .join(" · "),
      warning: false,
    };

  const pill = (selected) =>
    `${pillBase} ${
      selected
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50"
        data-testid="item-config-backdrop"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-label={`Configure ${name}`}
        // Pressing a button keeps the focus where it is: a blur would add the
        // typed customization as a chip, move the buttons below it and make
        // the press miss its target. The pending text is part of the Item
        // anyway; tapping an empty area still adds it.
        onMouseDown={(event) => {
          if (event.target.closest("button")) event.preventDefault();
        }}
        className="relative flex max-h-[90svh] w-full flex-col overflow-hidden rounded-t-2xl bg-white text-left shadow-xl sm:max-h-full sm:max-w-lg sm:rounded-xl"
      >
        <header className="flex items-start justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          {isEdit ? (
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold tracking-wide text-brand-700 uppercase">
                Edit item
              </p>
              <h2 className={`${sectionTitle} m-0 truncate`}>{name}</h2>
              <p className={`m-0 ${muted}`}>Before: {describeItem(initialItem)}</p>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2 self-center">
              {sizes.length > 0 && !choosingSize && (
                <button
                  type="button"
                  className={`${iconButton} size-11`}
                  aria-label="Back to sizes"
                  title="Back to sizes"
                  onClick={() => setSize(null)}
                >
                  <ArrowLeft className="size-5" aria-hidden="true" />
                </button>
              )}
              <h2 className={`${sectionTitle} m-0 truncate`}>
                {[name, size].filter(Boolean).join(" · ")}
              </h2>
            </div>
          )}
          <button
            type="button"
            className={`${iconButton} size-11 shrink-0`}
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {choosingSize ? (
          <div className="overflow-y-auto p-4">
            <p className={`${muted} mt-0 mb-3`}>Choose a size</p>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-3 p-0">
              {sizes.map((option) => (
                <li key={option.name}>
                  <button
                    type="button"
                    className="flex h-full w-full flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    onClick={() => setSize(option.name)}
                  >
                    <strong className="text-base font-semibold">{option.name}</strong>
                    <span className="text-sm font-medium text-brand-700">
                      {formatPrice(option.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-5 overflow-y-auto p-4">
              {restricted && (
                <>
                  <p
                    role="note"
                    className="m-0 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    This product is no longer sellable:{" "}
                    {cookingLevels.length > 0 ? "size and price" : "size, cooking level and price"}{" "}
                    are locked; the quantity can only be lowered.
                  </p>
                  {(initialItem.size || (initialItem.cookingLevel && !cookingLevels.length)) && (
                    <div className="grid grid-cols-2 gap-3">
                      {initialItem.size && (
                        <LockedValue heading="Size" value={initialItem.size} />
                      )}
                      {initialItem.cookingLevel && cookingLevels.length === 0 && (
                        <LockedValue heading="Cooking level" value={initialItem.cookingLevel} />
                      )}
                    </div>
                  )}
                </>
              )}
              {isEdit && sizes.length > 0 && (
                <fieldset className="m-0 border-0 p-0">
                  <legend className={fieldHeading}>Size</legend>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-1 rounded-xl bg-neutral-100 p-1">
                    {sizes.map((option) => {
                      const selected = size === option.name;
                      const before = option.name === initialItem.size;

                      return (
                        <button
                          key={option.name}
                          type="button"
                          aria-pressed={selected}
                          className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-2 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                            selected
                              ? "bg-white font-semibold text-brand-700 shadow-sm ring-1 ring-brand-200"
                              : "text-neutral-600 hover:bg-white/60"
                          }`}
                          onClick={() => setSize(option.name)}
                        >
                          <span className="max-w-full truncate">{option.name}</span>
                          <span className="text-xs font-normal tabular-nums">
                            {formatPrice(sizePrice(option))}
                          </span>
                          {before && (
                            <span className="text-[10px] leading-3 font-semibold tracking-wide text-neutral-500 uppercase">
                              before
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {cookingLevels.length > 0 && (
                <fieldset className="m-0 border-0 p-0">
                  <legend className={fieldHeading}>Cooking level</legend>
                  <div className="flex flex-wrap gap-2">
                    {cookingLevels.map((level) => (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={cookingLevel === level}
                        className={pill(cookingLevel === level)}
                        onClick={() => setCookingLevel(level)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div>
                <label htmlFor="customization" className={`${fieldHeading} mb-1 block`}>
                  Customizations
                </label>
                <div className="flex gap-2">
                  <input
                    id="customization"
                    type="text"
                    className={`${input} min-h-11`}
                    maxLength={FIELD_LIMITS.LIST_ITEM}
                    placeholder="e.g. no onions"
                    value={customizationText}
                    onChange={(event) => setCustomizationText(event.target.value)}
                    // Tapping elsewhere adds the text, as on touch screens
                    // there is no Enter key to rely on.
                    onBlur={addCustomization}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomization();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={`${button} min-h-11 px-4`}
                    disabled={customizationsFull}
                    onClick={addCustomization}
                  >
                    Add
                  </button>
                </div>
                {customizationsFull && (
                  <p className={`${muted} mt-1 text-xs`}>
                    {`Maximum ${FIELD_LIMITS.LIST_SIZE} customizations reached.`}
                  </p>
                )}
                {customizations.length > 0 && (
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                    {customizations.map((text, index) => (
                      <li
                        key={`${text}-${index}`}
                        className="flex items-center gap-1 rounded-full bg-brand-100 pr-0.5 pl-3 text-sm text-brand-800"
                      >
                        {text}
                        <button
                          type="button"
                          className="inline-flex size-11 items-center justify-center rounded-full text-brand-700 hover:bg-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                          aria-label={`Remove ${text}`}
                          title={`Remove ${text}`}
                          onClick={() => removeCustomization(index)}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                className={`flex items-center justify-between gap-3 ${
                  isEdit ? "rounded-xl bg-neutral-50 px-3 py-2.5" : ""
                }`}
              >
                <div className="min-w-0">
                  <span className={label}>Quantity</span>
                  {priceNote && (
                    <p
                      className={`m-0 text-xs ${
                        priceNote.warning ? "text-amber-700" : "text-neutral-500"
                      }`}
                    >
                      {priceNote.text}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    className={stepButton}
                    aria-label="Decrease quantity"
                    title="Decrease quantity"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((n) => n - 1)}
                  >
                    <Minus className="size-5" aria-hidden="true" />
                  </button>
                  <output
                    aria-label="Quantity"
                    className="min-w-8 text-center text-lg font-semibold tabular-nums"
                  >
                    {quantity}
                  </output>
                  <button
                    type="button"
                    className={stepButton}
                    aria-label="Increase quantity"
                    title="Increase quantity"
                    disabled={atMaxQuantity}
                    onClick={() => setQuantity((n) => n + 1)}
                  >
                    <Plus className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <footer className="border-t border-neutral-200 bg-white px-4 py-3">
              {isEdit ? (
                <div className="flex items-center gap-2">
                  <div className="mr-auto min-w-0">
                    <p className={`m-0 text-xs ${muted}`}>
                      Line total
                      {lineTotal !== initialItem.subtotal && (
                        <>
                          {" "}
                          <s aria-label="Before">{formatPrice(initialItem.subtotal)}</s>
                        </>
                      )}
                    </p>
                    <strong aria-label="Line total" className="text-lg font-bold tabular-nums">
                      {needsSize ? "—" : formatPrice(lineTotal)}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className={`${button} min-h-11 shrink-0 px-4`}
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${primaryButton} min-h-11 shrink-0 px-4 sm:px-5`}
                    disabled={needsSize}
                    onClick={() => onAdd(item)}
                  >
                    Update item
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${primaryButton} min-h-11 w-full py-2.5 text-base`}
                  onClick={() => onAdd(item)}
                >
                  Add to ticket · {formatPrice(lineTotal)}
                </button>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
