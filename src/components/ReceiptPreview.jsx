import { Printer, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { button, iconButton, primaryButton } from "../utils/styles";

/**
 * Print preview of a ticket receipt (plain text, 32 columns). No printer is
 * connected yet: Print only closes the preview. Escape and the backdrop
 * close it, and focus returns to the element that opened it.
 * @param {object} props
 * @param {string} props.receipt - Output of formatReceipt.
 * @param {function(): void} props.onClose
 * @returns {JSX.Element}
 * @example
 * <ReceiptPreview receipt={formatReceipt(data)} onClose={close} />
 */
export default function ReceiptPreview({ receipt, onClose }) {
  const titleId = useId();
  const printRef = useRef(null);
  // Latest onClose without re-running the focus effect on every render.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement;
    printRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-sm flex-col rounded-xl bg-white text-left shadow-xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <h2 id={titleId} className="m-0 text-lg font-semibold text-neutral-900">
            Print preview
          </h2>
          <button
            type="button"
            className={`${iconButton} size-11`}
            aria-label="Close preview"
            title="Close"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-neutral-100 p-4">
          <pre
            data-testid="receipt"
            className="m-0 mx-auto w-fit min-w-[32ch] rounded-md bg-white p-3 font-mono text-xs leading-relaxed whitespace-pre text-neutral-900 shadow-sm"
          >
            {receipt}
          </pre>
        </div>
        <footer className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
          <button type="button" className={`${button} min-h-11 px-4`} onClick={onClose}>
            Close
          </button>
          <button
            ref={printRef}
            type="button"
            className={`${primaryButton} min-h-11 px-5`}
            onClick={onClose}
          >
            <Printer className="size-4" aria-hidden="true" />
            Print
          </button>
        </footer>
      </div>
    </div>
  );
}
