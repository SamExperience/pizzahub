import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { button, card, input, muted, primaryButton } from "../utils/styles";

const EMPTY_SIZE = { name: "", price: "" };

const fieldLabel =
  "flex flex-col gap-1 text-sm font-medium text-neutral-700";
const fieldsetClass =
  "m-0 flex min-w-0 flex-col gap-3 border-0 p-0";
const sectionClass = "border-t border-neutral-200 pt-4";
const legendClass = "mb-3 p-0 text-sm font-semibold text-neutral-900";
const fieldInput = input;
// Square 40px icon button for removing a row.
const removeButton =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";
const addButton = `${button} self-start`;

const isValidPrice = (value) =>
  value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

// Trimmed, non-blank values of a text list; no values -> null.
const cleanList = (items) => {
  const values = items.map((item) => item.trim()).filter(Boolean);

  return values.length > 0 ? values : null;
};

// Repeatable text inputs with an add and a remove button.
function TextListField({ legend, itemLabel, addLabel, limitLabel, items, onChange }) {
  const isFull = items.length >= FIELD_LIMITS.LIST_SIZE;

  return (
    <div className={sectionClass}>
    <fieldset className={fieldsetClass}>
      <legend className={legendClass}>{legend}</legend>
      {items.map((item, index) => (
        <div key={index} className="flex min-w-0 items-center gap-2">
          <input
            type="text"
            aria-label={`${itemLabel} ${index + 1}`}
            className={fieldInput}
            maxLength={FIELD_LIMITS.LIST_ITEM}
            value={item}
            onChange={(event) =>
              onChange(
                items.map((current, i) =>
                  i === index ? event.target.value : current,
                ),
              )
            }
          />
          <button
            type="button"
            aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
            title={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
            className={removeButton}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={addButton}
        disabled={isFull}
        onClick={() => onChange([...items, ""])}
      >
        <Plus className="size-4" aria-hidden="true" />
        {addLabel}
      </button>
      {isFull && (
        <p className={muted}>
          {`Maximum ${FIELD_LIMITS.LIST_SIZE} ${limitLabel} reached.`}
        </p>
      )}
    </fieldset>
    </div>
  );
}

// `onSubmit(data)` saves the product; the parent closes the form on success.
// With `product` the form starts from its values (edit mode). busy is true
// while a product change (including the image upload) runs.
// Validation rules live in the Product service; the checks here only decide
// whether the submit button is enabled.
export default function ProductForm({
  product,
  onSubmit,
  onCancel,
  busy = false,
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(
    typeof product?.price === "number" ? String(product.price) : "",
  );
  const [sizes, setSizes] = useState(
    () =>
      product?.sizes?.map((size) => ({
        name: size.name,
        price: String(size.price),
      })) ?? [],
  );
  const [ingredients, setIngredients] = useState(product?.ingredients ?? []);
  const [cookingLevels, setCookingLevels] = useState(
    product?.availableCookingLevels ?? [],
  );
  const [defaultCookingLevel, setDefaultCookingLevel] = useState(
    product?.defaultCookingLevel ?? "",
  );
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);
  // A newly picked file replaces the current image; removal only applies when
  // no file is picked.
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const currentImageUrl = removeImage ? null : (product?.imageUrl ?? null);

  // Pricing: any size row switches the form to sizes (decision A1).
  const hasSizes = sizes.length > 0;
  const levels = cleanList(cookingLevels);
  // A default that is no longer among the levels must be chosen again.
  const selectedDefault = levels?.includes(defaultCookingLevel)
    ? defaultCookingLevel
    : "";

  const canSubmit =
    name.trim() !== "" &&
    (hasSizes
      ? sizes.every((size) => size.name.trim() && isValidPrice(size.price))
      : isValidPrice(price)) &&
    (!levels || selectedDefault !== "");

  const updateSize = (index, field, value) =>
    setSizes((current) =>
      current.map((size, i) =>
        i === index ? { ...size, [field]: value } : size,
      ),
    );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy || !canSubmit) return;

    await onSubmit({
      name,
      description: description.trim() || null,
      price: hasSizes ? null : Number(price),
      sizes: hasSizes
        ? sizes.map((size) => ({
            name: size.name,
            price: Number(size.price),
          }))
        : null,
      ingredients: cleanList(ingredients),
      availableCookingLevels: levels,
      defaultCookingLevel: levels ? selectedDefault : null,
      isAvailable,
      imageFile,
      removeImage: removeImage && !imageFile,
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`${card} flex flex-col gap-4`}>
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Basics</legend>
        <label className={fieldLabel}>
          Name
          <input
            type="text"
            className={fieldInput}
            maxLength={FIELD_LIMITS.NAME}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className={fieldLabel}>
          Description
          <textarea
            rows={2}
            className={input}
            maxLength={FIELD_LIMITS.DESCRIPTION}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {!hasSizes && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={fieldLabel}>
              Price
              <input
                type="number"
                min="0"
                step="0.01"
                className={fieldInput}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
          </div>
        )}
      </fieldset>

      <div className={sectionClass}>
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Sizes</legend>
        {sizes.map((size, index) => (
          <div key={index} className="flex min-w-0 items-center gap-2">
            <input
              type="text"
              aria-label={`Size ${index + 1} name`}
              placeholder="Size"
              className={fieldInput}
              maxLength={FIELD_LIMITS.LIST_ITEM}
              value={size.name}
              onChange={(event) => updateSize(index, "name", event.target.value)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label={`Size ${index + 1} price`}
              placeholder="Price"
              className={`${fieldInput} w-24! shrink-0 sm:w-28!`}
              value={size.price}
              onChange={(event) =>
                updateSize(index, "price", event.target.value)
              }
            />
            <button
              type="button"
              aria-label={`Remove size ${index + 1}`}
              title={`Remove size ${index + 1}`}
              className={removeButton}
              onClick={() =>
                setSizes((current) => current.filter((_, i) => i !== index))
              }
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className={addButton}
          disabled={sizes.length >= FIELD_LIMITS.LIST_SIZE}
          onClick={() => setSizes((current) => [...current, EMPTY_SIZE])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add size
        </button>
        {sizes.length >= FIELD_LIMITS.LIST_SIZE && (
          <p className={muted}>
            {`Maximum ${FIELD_LIMITS.LIST_SIZE} sizes reached.`}
          </p>
        )}
      </fieldset>
      </div>

      <TextListField
        legend="Ingredients"
        itemLabel="Ingredient"
        addLabel="Add ingredient"
        limitLabel="ingredients"
        items={ingredients}
        onChange={setIngredients}
      />

      <TextListField
        legend="Cooking levels"
        itemLabel="Cooking level"
        addLabel="Add cooking level"
        limitLabel="cooking levels"
        items={cookingLevels}
        onChange={setCookingLevels}
      />
      {levels && (
        <label className={`${fieldLabel} sm:max-w-64`}>
          Default cooking level
          <select
            className={fieldInput}
            value={selectedDefault}
            onChange={(event) => setDefaultCookingLevel(event.target.value)}
          >
            <option value="">Select a level</option>
            {[...new Set(levels)].map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
      )}
      {levels && selectedDefault === "" && (
        <p className={muted}>Required: choose the default cooking level.</p>
      )}

      <div className={sectionClass}>
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Availability</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            className="size-4 rounded accent-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1"
            checked={isAvailable}
            onChange={(event) => setIsAvailable(event.target.checked)}
          />
          Available
        </label>
      </fieldset>
      </div>

      <div className={sectionClass}>
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Image</legend>
        {currentImageUrl && !imageFile && (
          <div className="flex items-center gap-3">
            <img
              src={currentImageUrl}
              alt="Current product"
              className="size-20 rounded-lg object-cover"
            />
            <button
              type="button"
              className={button}
              onClick={() => setRemoveImage(true)}
            >
              Remove image
            </button>
          </div>
        )}
        {removeImage && !imageFile && (
          <p className={muted}>The image will be removed.</p>
        )}
        <input
          type="file"
          accept="image/*"
          aria-label="Product image"
          className="w-full min-w-0 text-sm text-neutral-600 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-lg"
          onChange={(event) => setImageFile(event.target.files[0] ?? null)}
        />
      </fieldset>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          className={`${button} min-h-11`}
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={`${primaryButton} min-h-11`}
          disabled={busy || !canSubmit}
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {busy ? "Saving ..." : "Save product"}
        </button>
      </div>
    </form>
  );
}
