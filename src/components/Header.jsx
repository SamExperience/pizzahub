import { useState } from "react";
import { useLocation } from "react-router";
import { CircleUser, Menu, Pizza, Store, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { iconButton } from "../utils/styles";
import LogoutButton from "./LogoutButton";
import Navbar from "./Navbar";

const MENU_PANEL_ID = "mobile-menu-panel";

function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Pizza className="size-5" aria-hidden="true" />
      </span>
      <span className="text-lg font-bold tracking-tight text-neutral-900">
        PizzaHub
      </span>
    </div>
  );
}

function StoreName({ name, className = "" }) {
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 text-sm font-medium text-neutral-700 ${className}`}
    >
      <Store className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

function UserName({ name, className = "" }) {
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 text-sm text-neutral-600 ${className}`}
    >
      <CircleUser
        className="size-5 shrink-0 text-neutral-400"
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

// Mobile menu state resets whenever the route changes (keyed by pathname).
function MobileMenu({ storeName, userName }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:hidden">
        {storeName && <StoreName name={storeName} className="max-w-40 max-sm:hidden" />}
        <button
          type="button"
          className={iconButton}
          aria-label={open ? "Close menu" : "Open menu"}
          title={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls={MENU_PANEL_ID}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {open && (
        <div
          id={MENU_PANEL_ID}
          className="absolute inset-x-0 top-full flex flex-col gap-4 border-b border-neutral-200 bg-white px-4 py-4 shadow-md sm:px-6 lg:hidden"
        >
          <Navbar orientation="vertical" onNavigate={close} />
          <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
            {storeName && <StoreName name={storeName} />}
            {userName && <UserName name={userName} />}
            <LogoutButton className="min-h-11 w-full" />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Sticky app header: brand, navigation (collapsible on mobile), active Store
 * and user. Reads only the existing contexts, no extra queries; minimal hides
 * navigation on pages used before a Store is selected.
 * @param {object} props
 * @param {boolean} [props.minimal]
 * @returns {JSX.Element}
 * @example
 * <Header minimal={pathname === "/stores"} />
 */
export default function Header({ minimal = false }) {
  const { pathname } = useLocation();
  const { authUser, userProfile } = useAuth();
  const { selectedStore } = useStore();

  const userName = userProfile?.displayName || authUser?.email;
  const storeName = selectedStore?.name;

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="relative flex h-14 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Brand />

        {minimal ? (
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {userName && <UserName name={userName} className="max-w-48" />}
            <LogoutButton />
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <Navbar />
            </div>
            <div className="ml-auto hidden min-w-0 items-center gap-4 lg:flex">
              {storeName && <StoreName name={storeName} className="max-w-48" />}
              {userName && <UserName name={userName} className="max-w-48" />}
              <LogoutButton />
            </div>
            <MobileMenu
              key={pathname}
              storeName={storeName}
              userName={userName}
            />
          </>
        )}
      </div>
    </header>
  );
}
