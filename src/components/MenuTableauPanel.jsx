import { useEffect, useState } from "react";
import { getCategoriesByMenuId } from "../services/category.service";
import { getMenuByStoreId } from "../services/menu.service";
import { getProductsByCategoryId } from "../services/product.service";
import { formatPrice } from "../utils/format";
import { alert, button, ghostButton, muted } from "../utils/styles";

// Single price, or "From <lowest size price>" when the product has sizes.
const formatCardPrice = ({ price, sizes }) =>
  Array.isArray(sizes) && sizes.length > 0
    ? `From ${formatPrice(Math.min(...sizes.map((size) => Number(size.price))))}`
    : formatPrice(price);

function ProductCard({ product, onSelect }) {
  const available = product.isAvailable !== false;

  return (
    <li>
      <button
        type="button"
        disabled={!available}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition-colors hover:border-purple-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-purple-500 dark:disabled:hover:border-neutral-800"
        onClick={() => onSelect(product)}
      >
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt=""
            className="h-28 w-full object-cover"
          />
        )}
        <div className="flex flex-1 flex-col gap-1 p-3">
          <strong className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {product.name}
          </strong>
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            {formatCardPrice(product)}
          </span>
          {!available && (
            <em className="w-fit rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium not-italic text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
              Unavailable
            </em>
          )}
        </div>
      </button>
    </li>
  );
}

// Left overlay of the ticket creation: quick Menu browsing for the cashier.
// Unavailable products are shown but cannot be selected.
export default function MenuTableauPanel({ storeId, onSelectProduct, onClose }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);
  const [categoriesAttempt, setCategoriesAttempt] = useState(0);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [productsAttempt, setProductsAttempt] = useState(0);

  // The first category is selected until the cashier picks another one.
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ??
    categories[0] ??
    null;
  const categoryId = selectedCategory?.id;

  useEffect(() => {
    let cancelled = false;

    setCategoriesError(null);
    setCategoriesLoading(true);

    getMenuByStoreId(storeId)
      .then((menu) => (menu ? getCategoriesByMenuId(menu.id) : []))
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch((err) => {
        console.log("Error loading categories -> ", err);
        if (!cancelled) setCategoriesError(err);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId, categoriesAttempt]);

  useEffect(() => {
    if (!categoryId) return;

    let cancelled = false;

    setProducts([]);
    setProductsError(null);
    setProductsLoading(true);

    getProductsByCategoryId(categoryId)
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch((err) => {
        console.log("Error loading products -> ", err);
        if (!cancelled) setProductsError(err);
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, productsAttempt]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const emptyBox = `rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center dark:border-neutral-700 ${muted}`;

  return (
    <section
      role="dialog"
      aria-label="Add product"
      className="absolute inset-y-0 left-0 right-0 z-10 flex flex-col bg-neutral-50 text-left shadow-xl md:right-[28rem] dark:bg-neutral-950"
    >
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="m-0 text-xl font-semibold">Add product</h2>
        <button
          type="button"
          className={ghostButton}
          aria-label="Close menu"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      {categoriesLoading && <p className={`${muted} p-4`}>Loading ...</p>}
      {categoriesError && (
        <p className={`${alert} m-4 flex flex-wrap items-center gap-3`}>
          Unable to load the menu.
          <button
            type="button"
            className={button}
            onClick={() => setCategoriesAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      )}
      {!categoriesLoading && !categoriesError && categories.length === 0 && (
        <p className={`${emptyBox} m-4`}>No categories in the menu.</p>
      )}

      {!categoriesLoading && !categoriesError && categories.length > 0 && (
        <div className="grid min-h-0 flex-1 grid-cols-[10rem_1fr] sm:grid-cols-[14rem_1fr]">
          <nav
            aria-label="Categories"
            className="overflow-y-auto border-r border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {categories.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    aria-current={
                      category.id === categoryId ? "true" : undefined
                    }
                    className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 aria-[current=true]:bg-purple-600 aria-[current=true]:text-white dark:text-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    {category.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="overflow-y-auto p-4">
            <h3 className="mt-0 mb-3 text-lg font-semibold">
              {selectedCategory.name}
            </h3>
            {productsLoading && <p className={muted}>Loading ...</p>}
            {productsError && (
              <p className={`${alert} flex flex-wrap items-center gap-3`}>
                Unable to load the products.
                <button
                  type="button"
                  className={button}
                  onClick={() => setProductsAttempt((n) => n + 1)}
                >
                  Try again
                </button>
              </p>
            )}
            {!productsLoading && !productsError && products.length === 0 && (
              <p className={emptyBox}>No products in this category yet.</p>
            )}
            {!productsLoading && !productsError && products.length > 0 && (
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3 p-0">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
