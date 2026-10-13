import { emptyBox, statusStyles } from "../utils/styles";
import TicketCard from "./TicketCard";

// One status column of the Tableau: header with ticket count, then the tickets.
// From lg the column takes the board height and only the ticket list scrolls.
// panelId/tabId/className let the board expose it as a mobile tab panel.
export default function TableauColumn({
  title,
  orders,
  panelId,
  tabId,
  className = "",
  onChangeStatus,
  onEdit,
  onCancel,
}) {
  const styles = statusStyles[title];

  return (
    <section
      id={panelId}
      role={panelId ? "tabpanel" : undefined}
      aria-labelledby={tabId}
      className={`flex min-w-0 flex-col gap-3 rounded-xl border-t-4 bg-neutral-100/70 p-3 lg:min-h-0 ${styles?.accent ?? "border-t-neutral-300"} ${className}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full ${styles?.dot ?? "bg-neutral-400"}`}
          />
          <h2 className="m-0 text-base font-semibold text-neutral-900">
            {title}
          </h2>
        </div>
        <span
          aria-label={`${title} tickets`}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${styles?.count ?? "bg-neutral-200 text-neutral-700"}`}
        >
          {orders.length}
        </span>
      </header>
      {orders.length === 0 ? (
        <p className={`${emptyBox} m-0`}>
          No tickets
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:-mx-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:pb-1">
          {orders.map((order) => (
            <li key={order.id}>
              <TicketCard
                order={order}
                onChangeStatus={onChangeStatus}
                onEdit={onEdit}
                onCancel={onCancel}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
