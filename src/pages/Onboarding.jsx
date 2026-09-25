import { useAuth } from "../contexts/AuthContext";

export default function Onboarding() {
  const { logout } = useAuth();
  return (
    <div>
      <button type="button" onClick={logout}>
        Logout
      </button>
      <h1>Onboarding</h1>
      <p>Onboarding content</p>
    </div>
  );
}
