import TableauColumn from "./TableauColumn";
import { ORDER_STATUSES } from "../services/order.service";
import { alert, button, muted, primaryButton } from "../utils/styles";

// Presentational Tableau: three status columns plus loading and error states.
export default function TableauBoard({
  orders = [],
  loading = false,
  error = null,
  onRetry,
  onCreateTicket,
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 text-left">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-3xl font-semibold tracking-tight">Tableau</h1>
        <button type="button" className={primaryButton} onClick={onCreateTicket}>
          Create Ticket
        </button>
      </div>
      {loading && <p className={muted}>Loading ...</p>}
      {error && (
        <p className={`${alert} flex flex-wrap items-center gap-3`}>
          Unable to load the tickets.
          <button type="button" className={button} onClick={onRetry}>
            Try again
          </button>
        </p>
      )}
      {!loading && !error && (
        <div className="grid items-start gap-4 md:grid-cols-3">
          {ORDER_STATUSES.map((status) => (
            <TableauColumn
              key={status}
              title={status}
              orders={orders.filter((order) => order.status === status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
