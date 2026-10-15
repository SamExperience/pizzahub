/**
 * Inline validation message shown under a form field; the id lets the input
 * reference it with aria-describedby. Renders nothing without a message.
 * @param {object} props
 * @param {string} [props.id]
 * @param {?string} props.message
 * @returns {?JSX.Element}
 * @example
 * <FieldError id="phone-error" message={errors.phone} />
 */
export default function FieldError({ id, message }) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="m-0 mt-1 text-sm text-red-600"
    >
      {message}
    </p>
  );
}
