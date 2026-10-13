import { muted, pageTitle } from "../utils/styles";

export default function Dashboard() {
  return (
    <div>
      <h1 className={pageTitle}>Dashboard</h1>
      <p className={muted}>Welcome to the dashboard</p>
    </div>
  );
}
