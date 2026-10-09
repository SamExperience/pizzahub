import { useState } from "react";
import { button, ghostButton, input, muted, primaryButton } from "../utils/styles";

// `onRename` resolves to true when the category was saved.
function CategoryRow({
  category,
  isFirst,
  isLast,
  isSelected,
  onSelect,
  onRename,
  onDelete,
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

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete "${category.name}"? Its products will be deleted too.`,
    );
    if (confirmed) onDelete(category.id);
  };

  if (editing) {
    return (
      <li className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800/50">
        <form onSubmit={handleSave} className="flex flex-col gap-2">
          <input
            type="text"
            aria-label="Category name"
            className={input}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className={primaryButton}
              disabled={!name.trim()}
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

  return (
    <li
      className={`rounded-lg p-1 ${
        isSelected
          ? "bg-purple-50 dark:bg-purple-950/40"
          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
      }`}
    >
      <button
        type="button"
        aria-label={`Select ${category.name}`}
        aria-current={isSelected ? "true" : undefined}
        className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm font-medium text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 aria-[current=true]:text-purple-700 dark:text-neutral-100 dark:aria-[current=true]:text-purple-300"
        onClick={() => onSelect(category.id)}
      >
        {category.name}
      </button>{" "}
      <div className="flex flex-wrap gap-0.5 px-1">
        <button
          type="button"
          aria-label={`Move ${category.name} up`}
          className={ghostButton}
          disabled={isFirst}
          onClick={() => onMove(category.id, "up")}
        >
          Up
        </button>
        <button
          type="button"
          aria-label={`Move ${category.name} down`}
          className={ghostButton}
          disabled={isLast}
          onClick={() => onMove(category.id, "down")}
        >
          Down
        </button>
        <button
          type="button"
          aria-label={`Edit ${category.name}`}
          className={ghostButton}
          onClick={startEditing}
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${category.name}`}
          className={ghostButton}
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export default function CategoryList({
  categories,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  onMove,
}) {
  if (categories.length === 0) {
    return <p className={muted}>No categories yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-1">
      {categories.map((category, index) => (
        <CategoryRow
          key={category.id}
          category={category}
          isFirst={index === 0}
          isLast={index === categories.length - 1}
          isSelected={category.id === selectedId}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </ol>
  );
}
