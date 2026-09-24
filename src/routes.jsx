import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import StoreSelection from "./pages/StoreSelection";
import Tableau from "./pages/Tableau";
import Menu from "./pages/Menu";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

export const routes = [
  {
    path: "/",
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
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
        element: <AppLayout />,
        children: [
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
