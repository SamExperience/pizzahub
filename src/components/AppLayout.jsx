import Header from "./Header";
import SubscriptionBanner from "./SubscriptionBanner";
import { Outlet, useLocation } from "react-router";
import { useStore } from "../contexts/StoreContext";

const MINIMAL_LAYOUT_PATHS = ["/onboarding", "/stores"];

/**
 * App shell of every protected page: header, subscription banner and the
 * routed page. Onboarding and store selection get a minimal header, because
 * navigation makes no sense before a Store is chosen.
 * @returns {JSX.Element}
 * @example
 * { element: <AppLayout />, children: [{ path: "/menu", element: <Menu /> }] }
 */
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
