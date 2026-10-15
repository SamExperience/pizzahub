import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { logError } from "../utils/logger";
import { button } from "../utils/styles";

export default function LogoutButton({ className = "" }) {
  const { logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleLogout() {
    setPending(true);
    setFailed(false);

    try {
      await logout();
    } catch (error) {
      logError("Logout error -> ", error);
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    // "contents": the button stays a direct child of the parent layout.
    <span className="contents">
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className={`${button} ${className}`}
      >
        <LogOut className="size-4" aria-hidden="true" />
        Logout
      </button>
      {failed && (
        <span role="alert" className="text-xs text-red-600">
          Logout failed
        </span>
      )}
    </span>
  );
}
