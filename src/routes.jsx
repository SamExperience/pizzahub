import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import StoreSelection from "./pages/StoreSelection";
import Tableau from "./pages/Tableau";
import Menu from "./pages/Menu";
import Dashboard from "./pages/Dashboard";

export const routes = [
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/onboarding",
    element: <Onboarding />,
  },
  {
    path: "/stores",
    element: <StoreSelection />,
  },
  {
    path: "/tableau",
    element: <Tableau />,
  },
  {
    path: "/menu",
    element: <Menu />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
];
