import { UtensilsCrossed, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getCategoriesByMenuId } from "../services/category.service";
import { getMenuByStoreId } from "../services/menu.service";
import { getProductsByCategoryId } from "../services/product.service";
import { formatPrice } from "../utils/format";
import { alert, button, emptyBox, iconButton, sectionTitle } from "../utils/styles";
import LoadingState from "./LoadingState";

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
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition-colors hover:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-200"
        onClick={() => onSelect(product)}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            className="h-24 w-full object-cover sm:h-28"
          />
        ) : (
          <div className="flex h-24 w-full items-center justify-center bg-neutral-100 text-neutral-400 sm:h-28">
            <UtensilsCrossed className="size-8" aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1 p-3">
          <strong className="text-sm font-semibold text-neutral-900">
            {product.name}
          </strong>
          <span className="text-sm font-semibold text-brand-700 tabular-nums">
            {formatCardPrice(product)}
          </span>
          {!available && (
            <em className="w-fit rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium not-italic text-neutral-700">
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

  return (
    <section
      role="dialog"
      aria-label="Add product"
      className="absolute inset-y-0 left-0 right-0 z-10 flex flex-col bg-neutral-50 text-left shadow-xl md:right-[28rem] lg:right-[27rem]"
    >
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <h2 className={`${sectionTitle} m-0`}>Add product</h2>
        <button
          type="button"
          className={iconButton}
          aria-label="Close menu"
          title="Close menu"
          onClick={onClose}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      {categoriesLoading && <LoadingState className="p-4" />}
      {categoriesError && (
        <p role="alert" className={`${alert} m-4 flex flex-wrap items-center gap-3`}>
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
        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[14rem_1fr]">
          <nav
            aria-label="Categories"
            className="shrink-0 overflow-x-auto border-b border-neutral-200 bg-white p-2 md:overflow-x-visible md:overflow-y-auto md:border-r md:border-b-0"
          >
            <ul className="m-0 flex list-none flex-row gap-2 p-0 md:flex-col md:gap-1">
              {categories.map((category) => (
                <li key={category.id} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    aria-current={
                      category.id === categoryId ? "true" : undefined
                    }
                    className="min-h-10 w-full rounded-full border border-neutral-300 px-4 py-2 text-left text-sm font-medium whitespace-nowrap text-neutral-800 hover:bg-neutral-50 focus:outline-none md:min-h-11 md:rounded-lg md:border-transparent md:whitespace-normal focus-visible:ring-2 focus-visible:ring-brand-400 aria-[current=true]:border-brand-600 aria-[current=true]:bg-brand-600 aria-[current=true]:text-white"
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    {category.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <h3 className="mt-0 mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {selectedCategory.name}
            </h3>
            {productsLoading && <LoadingState />}
            {productsError && (
              <p role="alert" className={`${alert} flex flex-wrap items-center gap-3`}>
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
              <ul className="m-0 grid list-none grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 p-0">
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
