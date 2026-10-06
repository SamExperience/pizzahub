import LogoutButton from "./LogoutButton";

export default function Header({ minimal = false }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 20px",
        borderBottom: "1px solid #aaaaaa",
      }}
    >
      <div>
        <span>PizzaHub</span>
      </div>

      {!minimal && (
        <>
          <div>
            <span>Company Name</span>
            <span>Store Name</span>
          </div>

          <div>
            <span>Logged in as: John Doe</span>
          </div>
        </>
      )}
      <div>
        <LogoutButton />
      </div>
    </header>
  );
}
