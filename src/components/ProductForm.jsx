import { useState } from "react";
import {
  button,
  card,
  ghostButton,
  input,
  muted,
  primaryButton,
} from "../utils/styles";

const EMPTY_SIZE = { name: "", price: "" };

const fieldLabel =
  "flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300";
const fieldsetClass =
  "flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700";
const legendClass =
  "px-1 text-sm font-medium text-neutral-700 dark:text-neutral-300";

const isValidPrice = (value) =>
  value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

// Trimmed, non-blank values of a text list; no values -> null.
const cleanList = (items) => {
  const values = items.map((item) => item.trim()).filter(Boolean);

  return values.length > 0 ? values : null;
};

// Repeatable text inputs with an add and a remove button.
function TextListField({ legend, itemLabel, addLabel, items, onChange }) {
  return (
    <fieldset className={fieldsetClass}>
      <legend className={legendClass}>{legend}</legend>
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            aria-label={`${itemLabel} ${index + 1}`}
            className={input}
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
            className={ghostButton}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`${button} self-start`}
        onClick={() => onChange([...items, ""])}
      >
        {addLabel}
      </button>
    </fieldset>
  );
}

// `onSubmit(data)` saves the product; the parent closes the form on success.
// With `product` the form starts from its values (edit mode).
// Validation rules live in the Product service; the checks here only decide
// whether the submit button is enabled.
export default function ProductForm({ product, onSubmit, onCancel }) {
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
    if (!canSubmit) return;

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
      <label className={fieldLabel}>
        Name
        <input
          type="text"
          className={input}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className={fieldLabel}>
        Description
        <textarea
          rows={2}
          className={input}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      {!hasSizes && (
        <label className={`${fieldLabel} sm:max-w-48`}>
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            className={input}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
      )}
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Sizes</legend>
        {sizes.map((size, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              aria-label={`Size ${index + 1} name`}
              placeholder="Size"
              className={input}
              value={size.name}
              onChange={(event) => updateSize(index, "name", event.target.value)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label={`Size ${index + 1} price`}
              placeholder="Price"
              className={`${input} max-w-32`}
              value={size.price}
              onChange={(event) =>
                updateSize(index, "price", event.target.value)
              }
            />
            <button
              type="button"
              aria-label={`Remove size ${index + 1}`}
              className={ghostButton}
              onClick={() =>
                setSizes((current) => current.filter((_, i) => i !== index))
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className={`${button} self-start`}
          onClick={() => setSizes((current) => [...current, EMPTY_SIZE])}
        >
          Add size
        </button>
      </fieldset>

      <TextListField
        legend="Ingredients"
        itemLabel="Ingredient"
        addLabel="Add ingredient"
        items={ingredients}
        onChange={setIngredients}
      />

      <TextListField
        legend="Cooking levels"
        itemLabel="Cooking level"
        addLabel="Add cooking level"
        items={cookingLevels}
        onChange={setCookingLevels}
      />
      {levels && (
        <label className={`${fieldLabel} sm:max-w-64`}>
          Default cooking level
          <select
            className={input}
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
          className="text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200 dark:text-neutral-400 dark:file:bg-neutral-800 dark:file:text-neutral-200"
          onChange={(event) => setImageFile(event.target.files[0] ?? null)}
        />
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        <input
          type="checkbox"
          className="size-4 accent-purple-600"
          checked={isAvailable}
          onChange={(event) => setIsAvailable(event.target.checked)}
        />
        Available
      </label>

      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <button type="button" className={button} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={!canSubmit}>
          Save product
        </button>
      </div>
    </form>
  );
}
