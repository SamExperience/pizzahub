import { useState } from "react";
import { useSearchParams } from "react-router";
import { CreditCard, History } from "lucide-react";
import OrderHistory from "../components/OrderHistory";
import SubscriptionSection from "../components/SubscriptionSection";
import { pageTitle } from "../utils/styles";

// Dashboard sections; adding one is a new entry here.
const SECTIONS = [
  { id: "orders", label: "Order history", icon: History, Component: OrderHistory },
  { id: "subscription", label: "Subscription", icon: CreditCard, Component: SubscriptionSection },
];

// Section requested by the URL: the Checkout return (?checkout=...) and the
// subscription banner (?section=subscription) open Subscription.
const requestedSection = (searchParams) =>
  searchParams.has("checkout") || searchParams.get("section") === "subscription"
    ? "subscription"
    : null;

// Dashboard shell: section sidebar (a top selector on mobile) and the active
// section. The selection is local state, not a route; a URL request selects
// its section on load and whenever the query string changes.
export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const [activeId, setActiveId] = useState(
    () => requestedSection(searchParams) ?? SECTIONS[0].id,
  );
  const [prevSearch, setPrevSearch] = useState(search);

  if (search !== prevSearch) {
    setPrevSearch(search);
    const requested = requestedSection(searchParams);
    if (requested) setActiveId(requested);
  }

  const active = SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0];
  const ActiveSection = active.Component;

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className={`${pageTitle} m-0`}>Dashboard</h1>
      <div className="grid items-start gap-4 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6">
        <aside className="min-w-0 md:sticky md:top-4 md:rounded-xl md:border md:border-neutral-200 md:bg-white md:p-2 md:shadow-sm">
          <nav aria-label="Dashboard sections">
            <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 md:flex-col md:gap-1 md:overflow-visible">
              {SECTIONS.map(({ id, label, icon: Icon }) => {
                const isActive = id === active.id;

                return (
                  <li key={id} className="shrink-0 md:shrink">
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      }`}
                      onClick={() => setActiveId(id)}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <ActiveSection />
      </div>
    </div>
  );
}
