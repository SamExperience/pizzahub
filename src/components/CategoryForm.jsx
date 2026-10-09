import { useState } from "react";
import { input, primaryButton } from "../utils/styles";

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
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        aria-label="New category name"
        placeholder="New category"
        className={input}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="submit"
        className={`${primaryButton} shrink-0`}
        disabled={!name.trim()}
      >
        Add category
      </button>
    </form>
  );
}
