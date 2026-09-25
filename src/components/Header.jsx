import { useAuth } from "../contexts/AuthContext";

export default function Header() {
  const { logout } = useAuth();
  return (
    <header>
      <div>
        <span>PizzaHub</span>
      </div>

      <div>
        <span>Company Name</span>
        <span>Store Name</span>
      </div>

      <div>
        <span>Logged in as: John Doe</span>
      </div>
      <div>
        <button type="button" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}
