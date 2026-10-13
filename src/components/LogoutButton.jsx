import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { button } from "../utils/styles";

export default function LogoutButton({ className = "" }) {
  const { logout } = useAuth();

  return (
    <button type="button" onClick={logout} className={`${button} ${className}`}>
      <LogOut className="size-4" aria-hidden="true" />
      Logout
    </button>
  );
}
