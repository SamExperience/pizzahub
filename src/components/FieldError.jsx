// Inline validation message shown under a form field.
export default function FieldError({ id, message }) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="m-0 mt-1 text-sm text-red-600 dark:text-red-400"
    >
      {message}
    </p>
  );
}
