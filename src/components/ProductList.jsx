import { useEffect, useState } from "react";
import {
  createProduct,
  getProductsByCategoryId,
} from "../services/product.service";
import ProductForm from "./ProductForm";

const formatPrice = (value) => `€${value.toFixed(2)}`;

// Single price, or one "Size: price" entry per size (decision A1).
const formatPricing = ({ price, sizes }) =>
  Array.isArray(sizes) && sizes.length > 0
    ? sizes.map((size) => `${size.name}: ${formatPrice(size.price)}`).join(" · ")
    : formatPrice(price);

function ProductRow({ product }) {
  return (
    <li>
      <strong>{product.name}</strong> {formatPricing(product)}
      {product.isAvailable === false && <em> Unavailable</em>}
      {product.description && <p>{product.description}</p>}
      {Array.isArray(product.ingredients) && product.ingredients.length > 0 && (
        <p>Ingredients: {product.ingredients.join(", ")}</p>
      )}
    </li>
  );
}

// Products of one category ordered by position, with a form to add new ones.
export default function ProductList({ categoryId, categoryName }) {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
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

  // The new product goes last: position is unique within the category.
  const handleCreate = async (data) => {
    setActionError(null);
    try {
      await createProduct(categoryId, {
        ...data,
        position: products.length + 1,
      });
      setProducts(await getProductsByCategoryId(categoryId));
      setShowForm(false);
    } catch (err) {
      console.log("Error creating product -> ", err);
      setActionError(err);
    }
  };

  const closeForm = () => {
    setActionError(null);
    setShowForm(false);
  };

  return (
    <div>
      <h2>{categoryName}</h2>
      {!loading && !error && !showForm && (
        <button type="button" onClick={() => setShowForm(true)}>
          Add product
        </button>
      )}
      {showForm && (
        <>
          {actionError && <p role="alert">{actionError.message}</p>}
          <ProductForm onSubmit={handleCreate} onCancel={closeForm} />
        </>
      )}
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
          {products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </ul>
      )}
    </div>
  );
}
