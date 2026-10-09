import TableauColumn from "../components/TableauColumn";
import { ORDER_STATUSES } from "../services/order.service";
import { alert, button, muted } from "../utils/styles";

// Layout only: orders, loading and error come from props until the real-time
// wiring is added.
export default function Tableau({
  orders = [],
  loading = false,
  error = null,
  onRetry,
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 text-left">
      <h1 className="mt-0 mb-6 text-3xl font-semibold tracking-tight">
        Tableau
      </h1>
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
