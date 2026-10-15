import { Loader2 } from "lucide-react";
import { muted } from "../utils/styles";

/**
 * Muted spinner line shared by every loading state; fullPage centers it on
 * the whole viewport (route guards).
 * @param {object} props
 * @param {string} [props.text]
 * @param {boolean} [props.fullPage]
 * @param {string} [props.className]
 * @returns {JSX.Element}
 * @example
 * <LoadingState text="Loading orders ..." />
 */
export default function LoadingState({
  text = "Loading ...",
  fullPage = false,
  className = "",
}) {
  return (
    <p
      role="status"
      className={`m-0 flex items-center gap-2 ${muted} ${
        fullPage ? "min-h-svh justify-center" : ""
      } ${className}`}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
