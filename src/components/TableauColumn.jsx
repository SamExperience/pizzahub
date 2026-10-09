import { card, muted } from "../utils/styles";

// One status column of the Tableau: header with ticket count, then the tickets.
export default function TableauColumn({ title, orders }) {
  return (
    <section className={`${card} flex min-w-0 flex-col gap-3`}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        <span
          aria-label={`${title} tickets`}
          className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {orders.length}
        </span>
      </header>
      {orders.length === 0 ? (
        <p
          className={`rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center dark:border-neutral-700 ${muted}`}
        >
          No tickets
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {orders.map((order) => (
            <li key={order.id} className={muted}>
              {order.id}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
