import { Plus } from "lucide-react";
import { useState } from "react";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { input, primaryButton } from "../utils/styles";

// `onSubmit` resolves to true when the category was saved; busy disables the
// submit while another category change runs.
export default function CategoryForm({ onSubmit, busy = false }) {
  const [name, setName] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy || !name.trim()) return;

    if (await onSubmit(name)) {
      setName("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="text"
        aria-label="New category name"
        placeholder="New category"
        className={input}
        maxLength={FIELD_LIMITS.NAME}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="submit"
        className={`${primaryButton} w-full`}
        disabled={busy || !name.trim()}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add category
      </button>
    </form>
  );
}
