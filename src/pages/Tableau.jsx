import { useCallback, useEffect, useState } from "react";
import ReceiptPreview from "../components/ReceiptPreview";
import TableauBoard from "../components/TableauBoard";
import TicketSidebar from "../components/TicketSidebar";
import { useStore } from "../contexts/StoreContext";
import {
  cancelOrder,
  getDayRange,
  subscribeToTodayOrders,
  updateOrderStatus,
} from "../services/order.service";
import { logError } from "../utils/logger";
import { formatReceipt } from "../utils/receipt";

/**
 * Moves a ticket's Order to another Tableau status.
 * @private
 * @param {object} order
 * @param {string} status - One of ORDER_STATUSES.
 * @returns {Promise<void>}
 * @example
 * await changeTicketStatus(order, ORDER_STATUS.IN_PROGRESS);
 */
const changeTicketStatus = (order, status) => updateOrderStatus(order.id, status);
/**
 * Cancels a ticket's Order.
 * @private
 * @param {object} order
 * @returns {Promise<void>}
 * @example
 * await cancelTicket(order);
 */
const cancelTicket = (order) => cancelOrder(order.id);

/**
 * Tableau page: real-time orders of the active Store for the current day,
 * with ticket creation/editing and the print preview. The listener restarts
 * at midnight, so the board always shows the current day.
 * @returns {JSX.Element}
 * @example
 * { path: "/tableau", element: <Tableau /> }
 */
export default function Tableau() {
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumped to resubscribe: on retry and when the day changes.
  const [retryKey, setRetryKey] = useState(0);
  const [dayKey, setDayKey] = useState(0);
  const [ticketOpen, setTicketOpen] = useState(false);
  // Order edited in the sidebar; null in creation mode.
  const [editingOrder, setEditingOrder] = useState(null);
  const closeTicket = useCallback(() => {
    setTicketOpen(false);
    setEditingOrder(null);
  }, []);
  const editTicket = useCallback((order) => {
    setEditingOrder(order);
    setTicketOpen(true);
  }, []);
  // Print preview: { order, customer } from a ticket card or a new ticket
  // just saved; null when closed.
  const [printing, setPrinting] = useState(null);
  const printTicket = useCallback(
    (order, customer) => setPrinting({ order, customer }),
    [],
  );

  useEffect(() => {
    if (!storeId) return;

    setOrders([]);
    setError(null);
    setLoading(true);

    const unsubscribe = subscribeToTodayOrders(
      storeId,
      (list) => {
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        logError("Error loading orders -> ", err);
        setError(err);
        setLoading(false);
      },
    );

    // The listener covers a fixed day range: renew it at midnight.
    const midnightTimer = setTimeout(
      () => setDayKey((key) => key + 1),
      getDayRange().end - Date.now(),
    );

    return () => {
      clearTimeout(midnightTimer);
      unsubscribe();
    };
  }, [storeId, retryKey, dayKey]);

  return (
    <>
      <TableauBoard
        orders={orders}
        loading={loading}
        error={error}
        onRetry={() => setRetryKey((key) => key + 1)}
        onCreateTicket={() => setTicketOpen(true)}
        onChangeStatus={changeTicketStatus}
        onEdit={editTicket}
        onCancel={cancelTicket}
        onPrint={printTicket}
      />
      {ticketOpen && (
        <TicketSidebar
          companyId={selectedStore?.companyId}
          storeId={storeId}
          order={editingOrder}
          onClose={closeTicket}
          onSaved={setPrinting}
        />
      )}
      {printing && (
        <ReceiptPreview
          receipt={formatReceipt({
            storeName: selectedStore?.name,
            order: printing.order,
            customer: printing.customer,
            printedAt: new Date(),
          })}
          onClose={() => setPrinting(null)}
        />
      )}
    </>
  );
}
