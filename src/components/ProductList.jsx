import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
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
  badge,
  button,
  emptyBox,
  primaryButton,
  sectionTitle,
} from "../utils/styles";
import ConfirmDialog from "./ConfirmDialog";
import LoadingState from "./LoadingState";
import ProductForm from "./ProductForm";

// Square 40px icon action for product rows.
const actionButton =
  "inline-flex size-10 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-40";

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
  onRequestDelete,
  onToggleAvailability,
}) {
  const available = product.isAvailable !== false;

  const toggleLabel = `${available ? "Mark unavailable" : "Mark available"} ${product.name}`;

  return (
    <li
      className={`flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:gap-4 sm:p-4 ${
        available ? "" : "opacity-80"
      }`}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="size-16 shrink-0 rounded-lg object-cover sm:size-20"
        />
      ) : (
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 sm:size-20"
          aria-hidden="true"
        >
          <UtensilsCrossed className="size-6" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <strong className="min-w-0 text-base font-semibold text-neutral-900">
            {product.name}
          </strong>{" "}
          <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-brand-700">
            {formatPricing(product)}
          </span>
        </div>
        {product.description && (
          <p className="m-0 line-clamp-2 text-sm text-neutral-500">
            {product.description}
          </p>
        )}
        {Array.isArray(product.ingredients) &&
          product.ingredients.length > 0 && (
            <p className="m-0 text-xs text-neutral-500">
              Ingredients: {product.ingredients.join(", ")}
            </p>
          )}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          {available ? (
            <span className={`${badge} bg-green-100 text-green-800`}>
              Available
            </span>
          ) : (
            <span className={`${badge} bg-amber-100 text-amber-800`}>
              Unavailable
            </span>
          )}
          <div className="-mr-1 flex flex-wrap items-center">
            <button
              type="button"
              aria-label={`Move ${product.name} up`}
              title={`Move ${product.name} up`}
              className={actionButton}
              disabled={isFirst}
              onClick={() => onMove(product.id, "up")}
            >
              <ChevronUp className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Move ${product.name} down`}
              title={`Move ${product.name} down`}
              className={actionButton}
              disabled={isLast}
              onClick={() => onMove(product.id, "down")}
            >
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={toggleLabel}
              title={toggleLabel}
              className={actionButton}
              onClick={() => onToggleAvailability(product.id, !available)}
            >
              {available ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              aria-label={`Edit ${product.name}`}
              title={`Edit ${product.name}`}
              className={actionButton}
              onClick={() => onEdit(product.id)}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${product.name}`}
              title={`Delete ${product.name}`}
              className={`${actionButton} hover:bg-red-50 hover:text-red-600`}
              onClick={() => onRequestDelete(product)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
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
        <ul className="grid gap-3 xl:grid-cols-2">
          {products.map((product, index) =>
            product.id === editingId ? (
              <li key={product.id} className="xl:col-span-2">
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
