import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { button, emptyBox, input, primaryButton } from "../utils/styles";
import ConfirmDialog from "./ConfirmDialog";

// Icon action that reads on both the mobile chip (brand-600) and the desktop row.
const actionButton =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40 md:size-9 md:rounded-lg md:text-neutral-500 md:hover:bg-brand-100 md:hover:text-brand-800 md:focus-visible:ring-brand-500/40";

// `onRename` resolves to true when the category was saved; busy disables the
// actions while a category change runs.
function CategoryRow({
  category,
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
  return (
    <li
      className={`flex shrink-0 items-center rounded-full border md:flex-wrap md:rounded-lg md:border-0 ${
        isSelected
          ? "border-brand-600 bg-brand-600 text-white md:bg-brand-50 md:text-brand-700"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 md:border-transparent md:bg-transparent"
      }`}
    >
      <button
        type="button"
        aria-label={`Select ${category.name}`}
        aria-current={isSelected ? "true" : undefined}
        className="min-h-10 max-w-48 truncate rounded-full px-4 text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 md:max-w-none md:flex-1 md:basis-full md:rounded-lg md:px-3"
        onClick={() => onSelect(category.id)}
      >
        {category.name}
      </button>
      <div
        className={`items-center pr-1 md:basis-full md:px-1 md:pb-1 ${
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
          <ChevronUp className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Move ${category.name} down`}
          title={`Move ${category.name} down`}
          className={actionButton}
          disabled={busy || isLast}
          onClick={() => onMove(category.id, "down")}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Edit ${category.name}`}
          title={`Edit ${category.name}`}
          className={actionButton}
          onClick={startEditing}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Delete ${category.name}`}
          title={`Delete ${category.name}`}
          className={`${actionButton} md:hover:bg-red-50 md:hover:text-red-600`}
          disabled={busy}
          onClick={() => onRequestDelete(category)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export default function CategoryList({
  categories,
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
    <ol className="flex flex-row gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
      {categories.map((category, index) => (
        <CategoryRow
          key={category.id}
          category={category}
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
