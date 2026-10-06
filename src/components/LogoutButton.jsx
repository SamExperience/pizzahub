import { useAuth } from "../contexts/AuthContext";

export default function LogoutButton() {
  const { logout } = useAuth();

  return (
    <button type="button" onClick={logout}>
      Logout
    </button>
  );
}
