import {
  ChevronDown,
  ChevronUp,
  Flame,
  Leaf,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  createProduct,
  deleteProductById,
  deleteProductImage,
  getProductsByCategoryId,
  moveProductById,
  setProductAvailability,
  updateProductById,
  uploadProductImage,
} from "../services/product.service";
import { formatPrice } from "../utils/format";
import {
  alert,
  button,
  emptyBox,
  primaryButton,
  sectionTitle,
} from "../utils/styles";
import ConfirmDialog from "./ConfirmDialog";
import LoadingState from "./LoadingState";
import ProductForm from "./ProductForm";
import { logError } from "../utils/logger";

// Chevron button used to move a row up/down: 40px wide, 32px tall.
const moveButton =
  "inline-flex h-8 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent";

const panelButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";

// Price rows: one per size, or a single "Price" row.
function getPriceRows(product) {
  return Array.isArray(product.sizes) && product.sizes.length > 0
    ? product.sizes.map((size) => ({ label: size.name, price: size.price }))
    : [{ label: "Price", price: product.price }];
}

// "€min – €max" for sizes (just "€x" when all equal), "€x" for a single price.
function getPriceSummary(product) {
  if (!Array.isArray(product.sizes) || product.sizes.length === 0)
    return { text: formatPrice(product.price), sizesCount: 0 };

  const prices = product.sizes.map((size) => size.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return {
    text:
      min === max
        ? formatPrice(min)
        : `${formatPrice(min)} – ${formatPrice(max)}`,
    sizesCount: prices.length,
  };
}

function ProductDetails({ product }) {
  const ingredients = Array.isArray(product.ingredients)
    ? product.ingredients
    : [];
  const levels = Array.isArray(product.availableCookingLevels)
    ? product.availableCookingLevels
    : [];
  const hasDetails =
    Boolean(product.description) || ingredients.length > 0 || levels.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm">
      {product.description && (
        <p className="m-0 text-neutral-600 italic wrap-anywhere">
          {product.description}
        </p>
      )}
      {ingredients.length > 0 && (
        <p className="m-0 text-neutral-700 wrap-anywhere">
          <span className="mr-2 inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-green-700 uppercase">
            <Leaf className="size-3" aria-hidden="true" />
            Ingredients
          </span>
          {ingredients.join(", ")}
        </p>
      )}
      {levels.length > 0 && (
        <p className="m-0 text-neutral-600 wrap-anywhere">
          <span className="mr-2 inline-flex items-center gap-1 align-middle">
            <Flame className="size-3.5" aria-hidden="true" />
            Cooking levels:
          </span>
          {levels.map((level, index) => (
            <span key={`${level}-${index}`}>
              {index > 0 && " · "}
              {level === product.defaultCookingLevel ? (
                <>
                  <strong className="font-bold text-neutral-900">{level}</strong>{" "}
                  (default)
                </>
              ) : (
                level
              )}
            </span>
          ))}
        </p>
      )}
      {!hasDetails && <p className="m-0 text-neutral-500">No details yet.</p>}
    </div>
  );
}

function ProductRow({
  product,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onRequestDelete,
  onToggleAvailability,
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const available = product.isAvailable !== false;
  const dim = available ? "" : "opacity-60 grayscale";
  const { text: priceText, sizesCount } = getPriceSummary(product);
  const hasIngredients =
    Array.isArray(product.ingredients) && product.ingredients.length > 0;

  const toggleLabel = `${available ? "Mark unavailable" : "Mark available"} ${product.name}`;

  const toggleExpanded = () => setExpanded((value) => !value);
  // Clicks on the row's own buttons must not toggle it.
  const handleRowClick = (event) => {
    if (event.target.closest("button")) return;
    toggleExpanded();
  };

  return (
    <li
      className={`border-t border-neutral-100 first:border-t-0 ${
        expanded ? "bg-brand-50/40" : ""
      }`}
    >
      {/* Row click is a mouse convenience; keyboard users use the title button. */}
      <div
        className="flex min-h-[72px] cursor-pointer items-center gap-1.5 px-1.5 py-1 transition-colors hover:bg-neutral-50 @xl:gap-3 @xl:px-3"
        onClick={handleRowClick}
      >
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            aria-label={`Move ${product.name} up`}
            title={`Move ${product.name} up`}
            className={moveButton}
            disabled={isFirst}
            onClick={() => onMove(product.id, "up")}
          >
            <ChevronUp className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${product.name} down`}
            title={`Move ${product.name} down`}
            className={moveButton}
            disabled={isLast}
            onClick={() => onMove(product.id, "down")}
          >
            <ChevronDown className="size-5" aria-hidden="true" />
          </button>
        </div>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`size-11 shrink-0 rounded-lg border border-neutral-200 object-cover ${dim}`}
          />
        ) : (
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 ${dim}`}
            aria-hidden="true"
          >
            <UtensilsCrossed className="size-5" />
          </div>
        )}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 rounded-lg px-1 py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${dim}`}
          onClick={toggleExpanded}
        >
          <span className="flex max-w-full items-center gap-2">
            {/* Expanded rows show the full name; collapsed rows keep one line. */}
            <strong
              className={`min-w-0 text-[15px] font-bold text-neutral-900 ${
                expanded ? "wrap-anywhere" : "truncate"
              }`}
            >
              {product.name}
            </strong>
            {!available && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Unavailable
              </span>
            )}
          </span>
          {/* Collapsed rows preview the ingredients; the panel shows the rest. */}
          {hasIngredients && !expanded && (
            <span className="flex max-w-full items-center gap-1.5 text-[13px] text-neutral-600">
              <Leaf
                className="size-3.5 shrink-0 text-green-700"
                aria-hidden="true"
              />
              <span className="min-w-0 truncate">
                {product.ingredients.join(", ")}
              </span>
            </span>
          )}
          <span className="text-[13px] font-bold tabular-nums text-brand-700 @xl:hidden">
            {priceText}
            {sizesCount > 0 && (
              <span className="ml-1.5 text-xs font-normal text-neutral-500">
                {sizesCount} sizes
              </span>
            )}
          </span>
        </button>
        <div
          className={`hidden shrink-0 flex-col items-end text-right tabular-nums @xl:flex ${dim}`}
        >
          <span className="text-[15px] font-bold text-brand-700">
            {priceText}
          </span>
          {sizesCount > 0 && (
            <span className="text-xs text-neutral-500">{sizesCount} sizes</span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={available}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          onClick={() => onToggleAvailability(product.id, !available)}
        >
          <span
            className={`relative h-6 w-10 rounded-full transition-colors ${
              available ? "bg-green-500" : "bg-neutral-300"
            }`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                available ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
        </button>
        <button
          type="button"
          aria-label={`Delete ${product.name}`}
          title={`Delete ${product.name}`}
          className="hidden size-11 shrink-0 items-center justify-center rounded-xl text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 @xl:inline-flex"
          onClick={() => onRequestDelete(product)}
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </button>
        <ChevronDown
          className={`size-5 shrink-0 text-neutral-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </div>
      {expanded && (
        <div
          id={panelId}
          className="flex flex-col gap-4 border-t border-dashed border-brand-200/60 bg-brand-50/40 px-3 py-4 @xl:pl-30"
        >
          <div className="grid gap-4 @xl:grid-cols-[1fr_14rem] @xl:gap-6">
            <ProductDetails product={product} />
            <div className="flex flex-col">
              {getPriceRows(product).map((row, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className="flex items-baseline justify-between gap-3 border-b border-dotted border-neutral-300 py-1 text-sm"
                >
                  <span className="min-w-0 text-neutral-700 wrap-anywhere">
                    {row.label}
                  </span>
                  <span className="font-bold tabular-nums text-brand-700">
                    {formatPrice(row.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-label={`Edit ${product.name}`}
              className={`${panelButton} border-brand-200 bg-white text-brand-700 hover:bg-brand-50`}
              onClick={() => onEdit(product.id)}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit product
            </button>
            <button
              type="button"
              aria-label={`Delete ${product.name}`}
              className={`${panelButton} border-red-200 bg-white text-red-600 hover:bg-red-50 @xl:hidden`}
              onClick={() => onRequestDelete(product)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete product
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// Products of one category ordered by position, with a form to add new ones.
export default function ProductList({
  storeId,
  categoryId,
  categoryName,
  onChange,
}) {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [productToDelete, setProductToDelete] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getProductsByCategoryId(categoryId)
      .then((result) => {
        if (cancelled) return;
        setProducts(result);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        logError("Error loading products -> ", err);
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, attempt]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  // Runs a product change, then reloads the list. Resolves to true on success.
  // The list is reloaded on failure too: a partial change (e.g. product saved,
  // image upload failed) must not leave the list stale.
  const runAction = async (action) => {
    setActionError(null);
    let succeeded = false;
    try {
      await action();
      succeeded = true;
    } catch (err) {
      logError("Error updating products -> ", err);
      setActionError(err);
    }

    try {
      setProducts(await getProductsByCategoryId(categoryId));
    } catch (err) {
      logError("Error reloading products -> ", err);
      if (succeeded) {
        setActionError(err);
        succeeded = false;
      }
    }

    onChange?.();

    return succeeded;
  };

  // The new product goes last: position is unique within the category.
  // The image is uploaded once the product exists, as its path uses the id.
  const handleCreate = async ({ imageFile, removeImage: _remove, ...data }) => {
    const saved = await runAction(async () => {
      const created = await createProduct(categoryId, {
        ...data,
        position: products.length + 1,
      });

      if (imageFile) {
        const imageUrl = await uploadProductImage(storeId, created.id, imageFile);
        await updateProductById(created.id, { imageUrl });
      }
    });
    if (saved) setShowForm(false);
  };

  // A new file overwrites the stored one (same path); removal clears the URL
  // first and deletes the file best-effort afterwards.
  const handleUpdate = async ({ imageFile, removeImage, ...data }) => {
    const current = products.find((product) => product.id === editingId);
    const saved = await runAction(async () => {
      const updates = { ...data };

      if (imageFile)
        updates.imageUrl = await uploadProductImage(
          storeId,
          editingId,
          imageFile,
        );
      else if (removeImage) updates.imageUrl = null;

      await updateProductById(editingId, updates);

      if (removeImage && !imageFile) await deleteProductImage(current?.imageUrl);
    });
    if (saved) setEditingId(null);
  };

  const handleMove = (productId, direction) =>
    runAction(() => moveProductById(productId, direction));
  const handleDelete = (productId) =>
    runAction(() => deleteProductById(productId));
  const handleConfirmDelete = () => {
    handleDelete(productToDelete.id);
    setProductToDelete(null);
  };
  const handleToggleAvailability = (productId, isAvailable) =>
    runAction(() => setProductAvailability(productId, isAvailable));

  const openEdit = (productId) => {
    setActionError(null);
    setShowForm(false);
    setEditingId(productId);
  };

  const closeForm = () => {
    setActionError(null);
    setShowForm(false);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`${sectionTitle} m-0 min-w-0 truncate`}>{categoryName}</h2>
        {!loading && !error && !showForm && editingId === null && (
          <button
            type="button"
            className={`${primaryButton} min-h-10`}
            onClick={() => setShowForm(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add product
          </button>
        )}
      </div>
      {actionError && (
        <p role="alert" className={alert}>
          {actionError.message}
        </p>
      )}
      {showForm && <ProductForm onSubmit={handleCreate} onCancel={closeForm} />}
      {loading && <LoadingState />}
      {error && (
        <p role="alert" className={`${alert} flex flex-wrap items-center gap-3`}>
          Unable to load the products.
          <button type="button" className={button} onClick={handleRetry}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && products.length === 0 && (
        <p className={emptyBox}>No products in this category yet.</p>
      )}
      {!loading && !error && products.length > 0 && (
        <ul className="@container m-0 flex list-none flex-col overflow-hidden rounded-2xl bg-white p-0 ring-1 ring-neutral-200">
          {products.map((product, index) =>
            product.id === editingId ? (
              <li key={product.id} className="border-t border-neutral-100 p-3 first:border-t-0">
                <ProductForm
                  product={product}
                  onSubmit={handleUpdate}
                  onCancel={closeForm}
                />
              </li>
            ) : (
              <ProductRow
                key={product.id}
                product={product}
                isFirst={index === 0}
                isLast={index === products.length - 1}
                onMove={handleMove}
                onEdit={openEdit}
                onRequestDelete={setProductToDelete}
                onToggleAvailability={handleToggleAvailability}
              />
            ),
          )}
        </ul>
      )}
      <ConfirmDialog
        open={productToDelete !== null}
        title={`Delete "${productToDelete?.name}"?`}
        confirmLabel="Delete product"
        cancelLabel="Keep"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}
