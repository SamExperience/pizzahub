import LogoutButton from "./LogoutButton";

export default function Header() {
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
        <LogoutButton />
      </div>
    </header>
  );
}
