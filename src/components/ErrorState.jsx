import { alert, button } from "../utils/styles";

// Error alert with a "Try again" button; fullPage centers it on the viewport.
// Extra actions (e.g. Logout) are passed as children.
export default function ErrorState({
  message,
  onRetry,
  fullPage = false,
  children,
}) {
  const box = (
    <div
      role="alert"
      className={`${alert} flex flex-col items-start gap-3 sm:max-w-md`}
    >
      <p className="m-0">{message}</p>
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <button type="button" className={button} onClick={onRetry}>
            Try again
          </button>
        )}
        {children}
      </div>
    </div>
  );

  if (!fullPage) return box;

  return (
    <div className="flex min-h-svh items-center justify-center p-4">{box}</div>
  );
}
