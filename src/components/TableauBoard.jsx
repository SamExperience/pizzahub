import { useState } from "react";
import { Plus } from "lucide-react";
import LoadingState from "./LoadingState";
import TableauColumn from "./TableauColumn";
import { ORDER_STATUSES, sortColumnOrders } from "../services/order.service";
import {
  alert,
  button,
  muted,
  pageTitle,
  primaryButton,
  statusStyles,
} from "../utils/styles";

// Presentational Tableau: three status columns (each in its display order,
// see sortColumnOrders) plus loading and error states. Below md the columns
// are shown one at a time through tabs and "Create Ticket" is a floating
// button; from md they sit side by side, and from lg the board fills the
// viewport (below the header and its 1px border) with each column scrolling
// on its own.
export default function TableauBoard({
  orders = [],
  loading = false,
  error = null,
  onRetry,
  onCreateTicket,
  onChangeStatus,
  onEdit,
  onCancel,
  onPrint,
}) {
  const [activeStatus, setActiveStatus] = useState(ORDER_STATUSES[0]);

  // Ids must not contain spaces ("In progress"): aria-* attributes split on them.
  const columns = ORDER_STATUSES.map((status) => ({
    status,
    slug: status.toLowerCase().replace(/\s+/g, "-"),
    orders: sortColumnOrders(
      status,
      orders.filter((order) => order.status === status),
    ),
  }));

  return (
    <div className="flex flex-col gap-4 text-left max-md:pb-20 lg:h-[calc(100svh-5.5rem-1px)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`m-0 ${pageTitle}`}>Tableau</h1>
          <p className={`m-0 ${muted}`}>Today's tickets</p>
        </div>
        <button
          type="button"
          className={`${primaryButton} min-h-10 max-md:fixed max-md:right-4 max-md:bottom-6 max-md:z-20 max-md:size-14 max-md:rounded-full max-md:p-0 max-md:shadow-xl`}
          onClick={onCreateTicket}
        >
          <Plus className="size-4 max-md:size-7" aria-hidden="true" />
          <span className="max-md:sr-only">Create Ticket</span>
        </button>
      </div>
      {loading && <LoadingState />}
      {error && (
        <p role="alert" className={`${alert} m-0 flex flex-wrap items-center gap-3`}>
          Unable to load the tickets.
          <button type="button" className={button} onClick={onRetry}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && (
        <>
          <div
            role="tablist"
            aria-label="Ticket status"
            className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 md:hidden"
          >
            {columns.map(({ status, slug, orders: columnOrders }) => {
              const selected = status === activeStatus;
              return (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  id={`tab-${slug}`}
                  aria-selected={selected}
                  aria-controls={`panel-${slug}`}
                  onClick={() => setActiveStatus(status)}
                  className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                    selected
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-600 hover:bg-white/60"
                  }`}
                >
                  <span className="flex max-w-full items-center gap-1">
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 rounded-full ${statusStyles[status].dot}`}
                    />
                    <span className="truncate">{status}</span>
                  </span>
                  <span className="text-xs tabular-nums">{columnOrders.length}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col items-stretch gap-4 md:snap-x md:flex-row md:overflow-x-auto lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:overflow-visible">
            {columns.map(({ status, slug, orders: columnOrders }) => (
              <TableauColumn
                key={status}
                title={status}
                orders={columnOrders}
                panelId={`panel-${slug}`}
                tabId={`tab-${slug}`}
                className={`md:min-w-[18rem] md:flex-1 md:snap-start ${
                  status === activeStatus ? "" : "max-md:hidden"
                }`}
                onChangeStatus={onChangeStatus}
                onEdit={onEdit}
                onCancel={onCancel}
                onPrint={onPrint}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
