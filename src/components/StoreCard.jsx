export default function StoreCard({ store, onSelect }) {
  const { name, address } = store;

  return (
    <div
      style={{
        display: "inline-block",
        padding: "16px 20px",
        border: "1px solid #aaaaaa",
        borderRadius: 8,
        minWidth: 240,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>{name}</h2>
      {address && (
        <p style={{ margin: "6px 0 0", fontSize: 14 }}>
          {address.street} {address.streetNumber}
          <br />
          {address.postalCode} {address.city}, {address.country}
        </p>
      )}
      <button
        type="button"
        onClick={() => onSelect?.(store)}
        style={{ marginTop: 16, cursor: "pointer" }}
      >
        Go to store
      </button>
    </div>
  );
}
