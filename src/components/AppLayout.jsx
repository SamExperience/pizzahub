import Header from "./Header";
import { Outlet, useLocation } from "react-router";

const MINIMAL_LAYOUT_PATHS = ["/onboarding", "/stores"];

export default function AppLayout() {
  const { pathname } = useLocation();
  const minimal = MINIMAL_LAYOUT_PATHS.includes(pathname);

  return (
    <div className="flex min-h-svh flex-col">
      <Header minimal={minimal} />
      <main className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
