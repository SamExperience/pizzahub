import { NavLink } from "react-router";
import { BookOpen, LayoutDashboard, LayoutGrid } from "lucide-react";

const LINKS = [
  { to: "/tableau", label: "Tableau", Icon: LayoutGrid },
  { to: "/menu", label: "Menu", Icon: BookOpen },
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
];

const linkBase =
  "inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";

const linkSize = {
  horizontal: "min-h-11 py-1.5",
  vertical: "min-h-11 py-2.5 text-base",
};

export default function Navbar({ orientation = "horizontal", onNavigate }) {
  const vertical = orientation === "vertical";

  return (
    <nav aria-label="Main">
      <ul className={`flex gap-1 ${vertical ? "flex-col" : "items-center"}`}>
        {LINKS.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `${linkBase} ${linkSize[orientation] ?? linkSize.horizontal} ${
                  vertical ? "w-full" : ""
                } ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
