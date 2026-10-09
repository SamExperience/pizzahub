import { useEffect, useState } from "react";
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
  card,
  dangerButton,
  muted,
  primaryButton,
} from "../utils/styles";
import ProductForm from "./ProductForm";

// Single price, or one "Size: price" entry per size (decision A1).
const formatPricing = ({ price, sizes }) =>
  Array.isArray(sizes) && sizes.length > 0
    ? sizes.map((size) => `${size.name}: ${formatPrice(size.price)}`).join(" · ")
    : formatPrice(price);

function ProductRow({
  product,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onDelete,
  onToggleAvailability,
}) {
  const available = product.isAvailable !== false;

  const handleDelete = () => {
    if (window.confirm(`Delete "${product.name}"?`)) onDelete(product.id);
  };

  return (
    <li className={`${card} flex gap-4 ${available ? "" : "opacity-70"}`}>
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="size-20 shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <strong className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {product.name}
          </strong>{" "}
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            {formatPricing(product)}
          </span>
          {!available && (
            <em className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium not-italic text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
              Unavailable
            </em>
          )}
        </div>
        {product.description && (
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {product.description}
          </p>
        )}
        {Array.isArray(product.ingredients) &&
          product.ingredients.length > 0 && (
            <p className={muted}>
              Ingredients: {product.ingredients.join(", ")}
            </p>
          )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            aria-label={`Move ${product.name} up`}
            className={button}
            disabled={isFirst}
            onClick={() => onMove(product.id, "up")}
          >
            Up
          </button>
          <button
            type="button"
            aria-label={`Move ${product.name} down`}
            className={button}
            disabled={isLast}
            onClick={() => onMove(product.id, "down")}
          >
            Down
          </button>
          <button
            type="button"
            aria-label={`Edit ${product.name}`}
            className={button}
            onClick={() => onEdit(product.id)}
          >
            Edit
          </button>
          <button
            type="button"
            aria-label={`${available ? "Mark unavailable" : "Mark available"} ${product.name}`}
            className={button}
            onClick={() => onToggleAvailability(product.id, !available)}
          >
            {available ? "Mark unavailable" : "Mark available"}
          </button>
          <button
            type="button"
            aria-label={`Delete ${product.name}`}
            className={dangerButton}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>
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
        console.log("Error loading products -> ", err);
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
      console.log("Error updating products -> ", err);
      setActionError(err);
    }

    try {
      setProducts(await getProductsByCategoryId(categoryId));
    } catch (err) {
      console.log("Error reloading products -> ", err);
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
        <h2 className="m-0 truncate text-2xl font-semibold">{categoryName}</h2>
        {!loading && !error && !showForm && editingId === null && (
          <button
            type="button"
            className={primaryButton}
            onClick={() => setShowForm(true)}
          >
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
      {loading && <p className={muted}>Loading ...</p>}
      {error && (
        <p className={`${alert} flex flex-wrap items-center gap-3`}>
          Unable to load the products.
          <button type="button" className={button} onClick={handleRetry}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && products.length === 0 && (
        <p
          className={`rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center dark:border-neutral-700 ${muted}`}
        >
          No products in this category yet.
        </p>
      )}
      {!loading && !error && products.length > 0 && (
        <ul className="flex flex-col gap-3">
          {products.map((product, index) =>
            product.id === editingId ? (
              <li key={product.id}>
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
                onDelete={handleDelete}
                onToggleAvailability={handleToggleAvailability}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
