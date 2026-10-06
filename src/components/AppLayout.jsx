import Header from "./Header";
import Navbar from "./Navbar";
import { Outlet, useLocation } from "react-router";

const MINIMAL_LAYOUT_PATHS = ["/onboarding", "/stores"];

export default function AppLayout() {
  const { pathname } = useLocation();
  const minimal = MINIMAL_LAYOUT_PATHS.includes(pathname);

  return (
    <>
      <Header minimal={minimal} />
      {!minimal && <Navbar />}
      <Outlet />
    </>
  );
}
