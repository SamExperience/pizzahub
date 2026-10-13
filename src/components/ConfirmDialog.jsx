import { AlertTriangle } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { button, primaryButton } from "../utils/styles";

const dangerSolid = `${primaryButton} bg-red-600! hover:bg-red-700!`;

// Modal confirmation for irreversible actions. Focus starts on the cancel
// button, Escape and the backdrop cancel, and focus returns on close.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef(null);
  // Latest onCancel without re-running the focus effect on every render.
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement;
    cancelRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancelRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="flex w-[calc(100%-2rem)] max-w-sm flex-col gap-4 rounded-xl bg-white p-5 text-left shadow-xl"
      >
        <div className="flex items-start gap-3">
          {destructive && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="m-0 text-lg font-semibold text-neutral-900">
              {title}
            </h2>
            {message && (
              <p id={messageId} className="m-0 text-sm text-neutral-600">
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className={`${button} min-h-11 px-4`}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${destructive ? dangerSolid : primaryButton} min-h-11 px-4`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
