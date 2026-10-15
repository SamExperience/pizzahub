import PublicRoute from "./components/PublicRoute";
import Onboarding from "./pages/Onboarding";
import StoreSelection from "./pages/StoreSelection";
import Tableau from "./pages/Tableau";
import Menu from "./pages/Menu";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * Route table. "/" is the public login page; every other page sits behind
 * ProtectedRoute (auth, onboarding and menu guards) and shares AppLayout, so
 * guards and the app shell are written once.
 * @type {RouteObject[]}
 * @example
 * const router = createBrowserRouter(routes);
 */
export const routes = [
  {
    path: "/",
    element: <PublicRoute />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
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
        ],
      },
    ],
  },
];
