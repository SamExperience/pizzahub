import { useEffect, useState } from "react";
import { buildItemSnapshot } from "../services/order.service";
import { formatPrice } from "../utils/format";
import { button, ghostButton, input, muted, primaryButton } from "../utils/styles";

const pillBase =
  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400";

// Item configuration step of the ticket creation. Step 1 (only when the
// product has sizes) picks the size; step 2 picks cooking level,
// customizations and quantity, then adds the Item snapshot to the ticket.
// With initialItem it reconfigures that Item: options still offered by the
// current product are prefilled.
export default function ItemConfigModal({ product, initialItem = null, onAdd, onClose }) {
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const cookingLevels = Array.isArray(product.availableCookingLevels)
    ? product.availableCookingLevels
    : [];

  const [size, setSize] = useState(() =>
    sizes.some((item) => item.name === initialItem?.size) ? initialItem.size : null,
  );
  const [cookingLevel, setCookingLevel] = useState(() =>
    cookingLevels.includes(initialItem?.cookingLevel)
      ? initialItem.cookingLevel
      : (product.defaultCookingLevel ?? cookingLevels[0] ?? null),
  );
  const [customizations, setCustomizations] = useState(
    initialItem?.customizations ?? [],
  );
  const [customizationText, setCustomizationText] = useState("");
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1);

  const choosingSize = sizes.length > 0 && size === null;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const addCustomization = () => {
    const text = customizationText.trim();

    if (text) setCustomizations((list) => [...list, text]);

    setCustomizationText("");
  };

  const removeCustomization = (index) =>
    setCustomizations((list) => list.filter((_, i) => i !== index));

  const buildItem = () =>
    buildItemSnapshot(product, { size, cookingLevel, customizations, quantity });

  const lineTotal = choosingSize ? 0 : buildItem().subtotal;

  const pill = (selected) =>
    `${pillBase} ${
      selected
        ? "border-purple-600 bg-purple-600 text-white dark:border-purple-500 dark:bg-purple-500"
        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        data-testid="item-config-backdrop"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-label={`Configure ${product.name}`}
        className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white text-left shadow-xl dark:bg-neutral-900"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="flex min-w-0 items-center gap-2">
            {sizes.length > 0 && !choosingSize && (
              <button
                type="button"
                className={ghostButton}
                aria-label="Back to sizes"
                onClick={() => setSize(null)}
              >
                ←
              </button>
            )}
            <h2 className="m-0 truncate text-xl font-semibold">
              {product.name}
              {size && ` · ${size}`}
            </h2>
          </div>
          <button
            type="button"
            className={ghostButton}
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        {choosingSize ? (
          <div className="overflow-y-auto p-4">
            <p className={`${muted} mt-0 mb-3`}>Choose a size</p>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-3 p-0">
              {sizes.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    className="flex h-full w-full flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-5 text-center transition-colors hover:border-purple-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-purple-500"
                    onClick={() => setSize(item.name)}
                  >
                    <strong className="text-base font-semibold">{item.name}</strong>
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      {formatPrice(item.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-5 overflow-y-auto p-4">
              {cookingLevels.length > 0 && (
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-2 text-sm font-medium">Cooking level</legend>
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
                <label
                  htmlFor="customization"
                  className="mb-1 block text-sm font-medium"
                >
                  Customizations
                </label>
                <div className="flex gap-2">
                  <input
                    id="customization"
                    type="text"
                    className={input}
                    placeholder="e.g. no onions"
                    value={customizationText}
                    onChange={(event) => setCustomizationText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomization();
                      }
                    }}
                  />
                  <button type="button" className={button} onClick={addCustomization}>
                    Add
                  </button>
                </div>
                {customizations.length > 0 && (
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                    {customizations.map((text, index) => (
                      <li
                        key={`${text}-${index}`}
                        className="flex items-center gap-1 rounded-full bg-purple-100 py-1 pr-1 pl-3 text-sm text-purple-800 dark:bg-purple-950 dark:text-purple-200"
                      >
                        {text}
                        <button
                          type="button"
                          className={ghostButton}
                          aria-label={`Remove ${text}`}
                          onClick={() => removeCustomization(index)}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={button}
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((n) => n - 1)}
                  >
                    −
                  </button>
                  <output
                    aria-label="Quantity"
                    className="min-w-6 text-center text-base font-semibold"
                  >
                    {quantity}
                  </output>
                  <button
                    type="button"
                    className={button}
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((n) => n + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <footer className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <button
                type="button"
                className={`${primaryButton} w-full py-2.5`}
                onClick={() => onAdd(buildItem())}
              >
                {initialItem ? "Update item" : "Add to ticket"} · {formatPrice(lineTotal)}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
