// Shared Tailwind class strings for recurring UI elements.
// Controls are at least 44px tall: the app is mostly used on touch screens.

const buttonBase =
  "inline-flex items-center justify-center gap-1 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40";

const buttonSize = "min-h-11 px-3 py-1.5 text-sm";

/**
 * Secondary (outlined) button; the default for most actions.
 * @type {string}
 * @example
 * <button className={button}>Cancel</button>
 */
export const button = `${buttonBase} ${buttonSize} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50`;

/**
 * Primary (brand) button, one main action per view.
 * @type {string}
 * @example
 * <button className={primaryButton}>Save</button>
 */
export const primaryButton = `${buttonBase} ${buttonSize} bg-brand-600 text-white shadow-sm hover:bg-brand-700`;

/**
 * Button for destructive actions (delete, cancel ticket).
 * @type {string}
 * @example
 * <button className={dangerButton}>Delete</button>
 */
export const dangerButton = `${buttonBase} ${buttonSize} border border-red-200 bg-white text-red-600 hover:bg-red-50`;

/**
 * Small borderless button for secondary row actions.
 * @type {string}
 * @example
 * <button className={ghostButton}>Edit</button>
 */
export const ghostButton = `${buttonBase} px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800`;

/**
 * Square 44px ghost button for icon-only actions (always with aria-label).
 * @type {string}
 * @example
 * <button className={iconButton} aria-label="Close"><X /></button>
 */
export const iconButton = `${buttonBase} size-11 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800`;

/**
 * Text input, 44px tall for touch screens.
 * @type {string}
 * @example
 * <input className={input} />
 */
export const input =
  "min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

/**
 * Form field label.
 * @type {string}
 * @example
 * <label className={label}>Name</label>
 */
export const label = "text-sm font-medium text-neutral-700";

/**
 * White bordered container for sections and forms.
 * @type {string}
 * @example
 * <section className={card}>...</section>
 */
export const card =
  "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm";

/**
 * Red box for error messages (use with role="alert").
 * @type {string}
 * @example
 * <p role="alert" className={alert}>{error}</p>
 */
export const alert =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";

/**
 * Secondary, low-emphasis text.
 * @type {string}
 * @example
 * <p className={muted}>No products yet.</p>
 */
export const muted = "text-sm text-neutral-500";

/**
 * Dashed box for empty states.
 * @type {string}
 * @example
 * <div className={emptyBox}>No orders for this day.</div>
 */
export const emptyBox =
  "rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-500";

/**
 * Base pill for status badges; combine with color classes.
 * @type {string}
 * @example
 * <span className={`${badge} ${statusStyles.Pending.badge}`}>Pending</span>
 */
export const badge =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

/**
 * Page-level heading.
 * @type {string}
 * @example
 * <h1 className={pageTitle}>Menu</h1>
 */
export const pageTitle =
  "text-2xl font-semibold tracking-tight text-neutral-900";

/**
 * Section-level heading.
 * @type {string}
 * @example
 * <h2 className={sectionTitle}>Order history</h2>
 */
export const sectionTitle = "text-lg font-semibold text-neutral-900";

/**
 * Order status colors (single source, so badges, columns and cards always
 * match), keyed by status: badge = pill colors, dot = small indicator,
 * accent = column top border, border = ticket left border, count = count
 * pill.
 * @type {Object<string, {badge: string, dot: string, accent: string, border: string, count: string}>}
 * @example
 * <div className={`border-l-4 ${statusStyles[order.status].border}`} />
 */
export const statusStyles = {
  Pending: {
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    accent: "border-t-amber-400",
    border: "border-l-amber-400",
    count: "bg-amber-100 text-amber-800",
  },
  "In progress": {
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
    accent: "border-t-blue-400",
    border: "border-l-blue-400",
    count: "bg-blue-100 text-blue-800",
  },
  Completed: {
    badge: "bg-green-100 text-green-800",
    dot: "bg-green-500",
    accent: "border-t-green-400",
    border: "border-l-green-400",
    count: "bg-green-100 text-green-800",
  },
  Cancelled: {
    badge: "bg-neutral-200 text-neutral-600",
    dot: "bg-neutral-400",
    accent: "border-t-neutral-300",
    border: "border-l-neutral-300",
    count: "bg-neutral-200 text-neutral-600",
  },
};
