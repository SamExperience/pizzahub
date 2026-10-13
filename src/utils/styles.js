// Shared Tailwind class strings for recurring UI elements.

const buttonBase =
  "inline-flex items-center justify-center gap-1 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40";

const buttonSize = "min-h-9 px-3 py-1.5 text-sm";

export const button = `${buttonBase} ${buttonSize} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50`;

export const primaryButton = `${buttonBase} ${buttonSize} bg-brand-600 text-white shadow-sm hover:bg-brand-700`;

export const dangerButton = `${buttonBase} ${buttonSize} border border-red-200 bg-white text-red-600 hover:bg-red-50`;

// Small borderless button for secondary row actions.
export const ghostButton = `${buttonBase} px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800`;

// Square ghost button for icon-only actions.
export const iconButton = `${buttonBase} size-9 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800`;

export const input =
  "w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

// Form field label.
export const label = "text-sm font-medium text-neutral-700";

export const card =
  "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm";

export const alert =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";

export const muted = "text-sm text-neutral-500";

// Base pill for status badges; combine with color classes.
export const badge =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

// Page-level heading.
export const pageTitle =
  "text-2xl font-semibold tracking-tight text-neutral-900";

// Section-level heading.
export const sectionTitle = "text-lg font-semibold text-neutral-900";
