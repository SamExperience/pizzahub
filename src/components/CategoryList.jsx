import { useState } from "react";

// `onRename` resolves to true when the category was saved.
function CategoryRow({
  category,
  isFirst,
  isLast,
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
      <li>
        <form onSubmit={handleSave}>
          <input
            type="text"
            aria-label="Category name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" disabled={!name.trim()}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li>
      {category.name}{" "}
      <button
        type="button"
        aria-label={`Move ${category.name} up`}
        disabled={isFirst}
        onClick={() => onMove(category.id, "up")}
      >
        Up
      </button>
      <button
        type="button"
        aria-label={`Move ${category.name} down`}
        disabled={isLast}
        onClick={() => onMove(category.id, "down")}
      >
        Down
      </button>
      <button
        type="button"
        aria-label={`Edit ${category.name}`}
        onClick={startEditing}
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Delete ${category.name}`}
        onClick={handleDelete}
      >
        Delete
      </button>
    </li>
  );
}

export default function CategoryList({
  categories,
  onRename,
  onDelete,
  onMove,
}) {
  if (categories.length === 0) {
    return <p>No categories yet.</p>;
  }

  return (
    <ol>
      {categories.map((category, index) => (
        <CategoryRow
          key={category.id}
          category={category}
          isFirst={index === 0}
          isLast={index === categories.length - 1}
          onRename={onRename}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </ol>
  );
}
