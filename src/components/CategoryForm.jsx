import { useState } from "react";

// `onSubmit` resolves to true when the category was saved.
export default function CategoryForm({ onSubmit }) {
  const [name, setName] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;

    if (await onSubmit(name)) {
      setName("");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        aria-label="New category name"
        placeholder="New category"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button type="submit" disabled={!name.trim()}>
        Add category
      </button>
    </form>
  );
}
