import { Navigate, Outlet } from "react-router-dom";

const isAuthenticated = false;

export default function ProtectedRoute() {
  if (!isAuthenticated) {
    return <Navigate to="/" replace></Navigate>;
  }
  return <Outlet />;
}
