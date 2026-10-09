import { useState } from "react";

const EMPTY_SIZE = { name: "", price: "" };

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
    <fieldset>
      <legend>{legend}</legend>
      {items.map((item, index) => (
        <div key={index}>
          <input
            type="text"
            aria-label={`${itemLabel} ${index + 1}`}
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
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])}>
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
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Name
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      {!hasSizes && (
        <label>
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
      )}
      <fieldset>
        <legend>Sizes</legend>
        {sizes.map((size, index) => (
          <div key={index}>
            <input
              type="text"
              aria-label={`Size ${index + 1} name`}
              placeholder="Size"
              value={size.name}
              onChange={(event) => updateSize(index, "name", event.target.value)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label={`Size ${index + 1} price`}
              placeholder="Price"
              value={size.price}
              onChange={(event) =>
                updateSize(index, "price", event.target.value)
              }
            />
            <button
              type="button"
              aria-label={`Remove size ${index + 1}`}
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
        <label>
          Default cooking level
          <select
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

      <label>
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(event) => setIsAvailable(event.target.checked)}
        />
        Available
      </label>

      <button type="submit" disabled={!canSubmit}>
        Save product
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
