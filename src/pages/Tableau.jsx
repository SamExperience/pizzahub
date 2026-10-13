import { useCallback, useEffect, useState } from "react";
import TableauBoard from "../components/TableauBoard";
import TicketSidebar from "../components/TicketSidebar";
import { useStore } from "../contexts/StoreContext";
import {
  cancelOrder,
  getDayRange,
  subscribeToTodayOrders,
  updateOrderStatus,
} from "../services/order.service";

const changeTicketStatus = (order, status) => updateOrderStatus(order.id, status);
const cancelTicket = (order) => cancelOrder(order.id);

// Real-time orders of the active Store for the current day.
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
        console.log("Error loading orders -> ", err);
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
      />
      {ticketOpen && (
        <TicketSidebar
          companyId={selectedStore?.companyId}
          storeId={storeId}
          order={editingOrder}
          onClose={closeTicket}
        />
      )}
    </>
  );
}
