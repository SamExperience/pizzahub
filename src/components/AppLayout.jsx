import Header from "./Header";
import SubscriptionBanner from "./SubscriptionBanner";
import { Outlet, useLocation } from "react-router";
import { useStore } from "../contexts/StoreContext";

const MINIMAL_LAYOUT_PATHS = ["/onboarding", "/stores"];

export default function AppLayout() {
  const { pathname } = useLocation();
  const { menuReady } = useStore();
  const minimal = MINIMAL_LAYOUT_PATHS.includes(pathname);

  return (
    <div className="flex min-h-svh flex-col">
      <Header minimal={minimal} />
      {/* Hidden until the Menu is ready: only /menu is reachable before that. */}
      {!minimal && menuReady && <SubscriptionBanner />}
      <main className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
