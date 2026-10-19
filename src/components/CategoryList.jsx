import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { button, emptyBox, input, primaryButton } from "../utils/styles";
import ConfirmDialog from "./ConfirmDialog";

// 44px icon action (touch target) that reads on both the mobile chip
// (brand-600) and the desktop card.
const actionButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40 md:rounded-lg md:text-neutral-500 md:hover:bg-brand-100 md:hover:text-brand-800 md:focus-visible:ring-brand-500/40";

// Large counts are capped so the badge keeps a fixed footprint.
/**
 * Formats a product count for the badge, capped at "99+".
 * @private
 * @param {number} count
 * @returns {string}
 * @example
 * formatCount(120); // "99+"
 */
const formatCount = (count) => (count > 99 ? "99+" : String(count));
/**
 * Formats a product count as readable text, singular or plural.
 * @private
 * @param {number} count
 * @returns {string}
 * @example
 * countLabel(1); // "1 product"
 */
const countLabel = (count) => `${count} ${count === 1 ? "product" : "products"}`;

// `onRename` resolves to true when the category was saved; busy disables the
// actions while a category change runs.
/**
 * One category card with its product count badge; when selected it shows the
 * move, rename and delete actions, and rename switches it to an inline form.
 * @private
 * @param {object} props
 * @param {object} props.category
 * @param {number} props.productCount
 * @param {boolean} props.busy
 * @param {boolean} props.isFirst
 * @param {boolean} props.isLast
 * @param {boolean} props.isSelected
 * @param {function(string): void} props.onSelect
 * @param {function(string, string): Promise<boolean>} props.onRename - (id, name); true when saved.
 * @param {function(object): void} props.onRequestDelete - Category to confirm deletion of.
 * @param {function(string, string): void} props.onMove - (id, "up" or "down").
 * @returns {JSX.Element}
 * @example
 * <CategoryRow category={category} productCount={3} isSelected onSelect={select}
 *   onRename={rename} onRequestDelete={ask} onMove={move} />
 */
function CategoryRow({
  category,
  productCount,
  busy,
  isFirst,
  isLast,
  isSelected,
  onSelect,
  onRename,
  onRequestDelete,
  onMove,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const countId = useId();

  const startEditing = () => {
    setName(category.name);
    setEditing(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;

    if (await onRename(category.id, name)) {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <li className="w-72 max-w-full shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 p-2 md:w-auto">
        <form onSubmit={handleSave} className="flex flex-col gap-2">
          <input
            type="text"
            aria-label="Category name"
            className={input}
            maxLength={FIELD_LIMITS.NAME}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className={primaryButton}
              disabled={busy || !name.trim()}
            >
              Save
            </button>
            <button
              type="button"
              className={button}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  // Actions are shown for the selected category only: pick one to manage it.
  // The name wraps on two lines at most and the count badge never shrinks, so
  // long names or large counts cannot push the badge or the actions out.
  return (
    <li
      className={`flex shrink-0 items-center rounded-full border md:flex-col md:items-stretch md:rounded-xl ${
        isSelected
          ? "border-brand-600 bg-brand-600 text-white md:border-brand-300 md:bg-brand-50 md:text-brand-800 md:shadow-sm"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 md:hover:border-brand-200"
      }`}
    >
      <button
        type="button"
        aria-label={`Select ${category.name}`}
        aria-describedby={countId}
        aria-current={isSelected ? "true" : undefined}
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-full pl-4 pr-2 text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 md:gap-3 md:rounded-xl md:px-3 md:py-2"
        onClick={() => onSelect(category.id)}
      >
        <span className="max-w-40 truncate md:line-clamp-2 md:max-w-none md:flex-1 md:whitespace-normal md:break-words">
          {category.name}
        </span>
        <span
          id={countId}
          title={countLabel(productCount)}
          className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
            isSelected
              ? "bg-white text-brand-700 md:bg-brand-600 md:text-white"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          <span aria-hidden="true">{formatCount(productCount)}</span>
          <span className="sr-only">{countLabel(productCount)}</span>
        </span>
      </button>
      <div
        className={`items-center pr-1 md:border-t md:border-brand-200 md:p-1 ${
          isSelected ? "flex" : "hidden"
        }`}
      >
        <button
          type="button"
          aria-label={`Move ${category.name} up`}
          title={`Move ${category.name} up`}
          className={actionButton}
          disabled={busy || isFirst}
          onClick={() => onMove(category.id, "up")}
        >
          <ChevronUp className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Move ${category.name} down`}
          title={`Move ${category.name} down`}
          className={actionButton}
          disabled={busy || isLast}
          onClick={() => onMove(category.id, "down")}
        >
          <ChevronDown className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Edit ${category.name}`}
          title={`Edit ${category.name}`}
          className={actionButton}
          onClick={startEditing}
        >
          <Pencil className="size-5" aria-hidden="true" />
        </button>
        {/* Delete sits apart, on the far right of the card, to avoid mistaps. */}
        <button
          type="button"
          aria-label={`Delete ${category.name}`}
          title={`Delete ${category.name}`}
          className={`${actionButton} ml-2 md:ml-auto md:hover:bg-red-50 md:hover:text-red-600`}
          disabled={busy}
          onClick={() => onRequestDelete(category)}
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/**
 * Category cards of the Menu sidebar (a top selector on mobile) with product
 * count badges and, on the selected card, rename, move and delete actions.
 * Actions appear only on the selected card to keep the list compact and the
 * touch targets 44px.
 * @param {object} props
 * @param {object[]} props.categories - Ordered by position.
 * @param {Object<string, number>} [props.productCounts] - By category id.
 * @param {boolean} [props.busy] - Disables actions while a change runs.
 * @param {?string} props.selectedId
 * @param {function(string): void} props.onSelect
 * @param {function(string, string): Promise<boolean>} props.onRename - (id, name); true when saved.
 * @param {function(string): void} props.onDelete - Category id, after confirmation.
 * @param {function(string, string): void} props.onMove - (id, "up" or "down").
 * @returns {JSX.Element}
 * @example
 * <CategoryList categories={categories} selectedId={id} onSelect={setId}
 *   onRename={rename} onDelete={remove} onMove={move} />
 */
export default function CategoryList({
  categories,
  productCounts = {},
  busy = false,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  onMove,
}) {
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  if (categories.length === 0) {
    return <p className={emptyBox}>No categories yet.</p>;
  }

  const handleConfirmDelete = () => {
    onDelete(categoryToDelete.id);
    setCategoryToDelete(null);
  };

  // One list: a scrollable chip bar below md, a column from md.
  return (
    <>
    <ol className="flex flex-row gap-2 overflow-x-auto pb-1 md:flex-col md:gap-2 md:overflow-visible md:pb-0">
      {categories.map((category, index) => (
        <CategoryRow
          key={category.id}
          category={category}
          productCount={productCounts[category.id] ?? 0}
          busy={busy}
          isFirst={index === 0}
          isLast={index === categories.length - 1}
          isSelected={category.id === selectedId}
          onSelect={onSelect}
          onRename={onRename}
          onRequestDelete={setCategoryToDelete}
          onMove={onMove}
        />
      ))}
    </ol>
    <ConfirmDialog
      open={categoryToDelete !== null}
      title={`Delete "${categoryToDelete?.name}"?`}
      message="Its products will be deleted too."
      confirmLabel="Delete category"
      cancelLabel="Keep"
      destructive
      onConfirm={handleConfirmDelete}
      onCancel={() => setCategoryToDelete(null)}
    />
    </>
  );
}
