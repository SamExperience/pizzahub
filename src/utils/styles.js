// Shared Tailwind class strings for recurring UI elements.

const buttonBase =
  "inline-flex items-center justify-center gap-1 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40";

const buttonSize = "px-3 py-1.5 text-sm";

export const button = `${buttonBase} ${buttonSize} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800`;

export const primaryButton = `${buttonBase} ${buttonSize} bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400`;

export const dangerButton = `${buttonBase} ${buttonSize} border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950`;

// Small borderless button for secondary row actions.
export const ghostButton = `${buttonBase} px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100`;

export const input =
  "w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-purple-900";

export const card =
  "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900";

export const alert =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";

export const muted = "text-sm text-neutral-500 dark:text-neutral-400";
