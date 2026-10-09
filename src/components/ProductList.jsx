import { useEffect, useState } from "react";
import {
  createProduct,
  deleteProductById,
  getProductsByCategoryId,
  moveProductById,
  setProductAvailability,
  updateProductById,
} from "../services/product.service";
import ProductForm from "./ProductForm";

const formatPrice = (value) => `€${value.toFixed(2)}`;

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
    <li>
      <strong>{product.name}</strong> {formatPricing(product)}
      {!available && <em> Unavailable</em>}
      {product.description && <p>{product.description}</p>}
      {Array.isArray(product.ingredients) && product.ingredients.length > 0 && (
        <p>Ingredients: {product.ingredients.join(", ")}</p>
      )}
      <button
        type="button"
        aria-label={`Move ${product.name} up`}
        disabled={isFirst}
        onClick={() => onMove(product.id, "up")}
      >
        Up
      </button>
      <button
        type="button"
        aria-label={`Move ${product.name} down`}
        disabled={isLast}
        onClick={() => onMove(product.id, "down")}
      >
        Down
      </button>
      <button
        type="button"
        aria-label={`Edit ${product.name}`}
        onClick={() => onEdit(product.id)}
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`${available ? "Mark unavailable" : "Mark available"} ${product.name}`}
        onClick={() => onToggleAvailability(product.id, !available)}
      >
        {available ? "Mark unavailable" : "Mark available"}
      </button>
      <button
        type="button"
        aria-label={`Delete ${product.name}`}
        onClick={handleDelete}
      >
        Delete
      </button>
    </li>
  );
}

// Products of one category ordered by position, with a form to add new ones.
export default function ProductList({ categoryId, categoryName }) {
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
  const runAction = async (action) => {
    setActionError(null);
    try {
      await action();
      setProducts(await getProductsByCategoryId(categoryId));
      return true;
    } catch (err) {
      console.log("Error updating products -> ", err);
      setActionError(err);
      return false;
    }
  };

  // The new product goes last: position is unique within the category.
  const handleCreate = async (data) => {
    const saved = await runAction(() =>
      createProduct(categoryId, { ...data, position: products.length + 1 }),
    );
    if (saved) setShowForm(false);
  };

  const handleUpdate = async (data) => {
    const saved = await runAction(() => updateProductById(editingId, data));
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
    <div>
      <h2>{categoryName}</h2>
      {!loading && !error && !showForm && editingId === null && (
        <button type="button" onClick={() => setShowForm(true)}>
          Add product
        </button>
      )}
      {actionError && <p role="alert">{actionError.message}</p>}
      {showForm && <ProductForm onSubmit={handleCreate} onCancel={closeForm} />}
      {loading && <p>Loading ...</p>}
      {error && (
        <p>
          Unable to load the products.
          <br />
          <button type="button" onClick={handleRetry}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && products.length === 0 && (
        <p>No products in this category yet.</p>
      )}
      {!loading && !error && products.length > 0 && (
        <ul>
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
