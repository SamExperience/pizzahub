import { describe, expect, it, vi } from "vitest";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../src/contexts/AuthContext";
import ProtectedRoute from "../src/components/ProtectedRoute";

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");

  return {
    ...actual,
    Navigate: vi.fn(),
    Outlet: vi.fn(),
    useLocation: vi.fn(),
  };
});

describe("ProtectedRoute", () => {
  it("renders nothing while authentication is loading", () => {
    useAuth.mockReturnValue({
      authUser: null,
      userProfile: null,
      loadingLogin: true,
      selectedStoreId: null,
    });

    expect(ProtectedRoute()).toBeNull();
  });

  it("redirects unauthenticated users to login", () => {
    useAuth.mockReturnValue({
      authUser: null,
      userProfile: null,
      loadingLogin: false,
      selectedStoreId: null,
    });

    useLocation.mockReturnValue({
      pathname: "/tableau",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Navigate);
    expect(result.props.to).toBe("/");
  });

  it("redirects users without a profile to onboarding", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: null,
      loadingLogin: false,
      selectedStoreId: null,
    });

    useLocation.mockReturnValue({
      pathname: "/tableau",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Navigate);
    expect(result.props.to).toBe("/onboarding");
  });

  it("allows users without a profile to access onboarding", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: null,
      loadingLogin: false,
      selectedStoreId: null,
    });

    useLocation.mockReturnValue({
      pathname: "/onboarding",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Outlet);
  });

  it("redirects users without a selected store to store selection", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
      selectedStoreId: null,
    });

    useLocation.mockReturnValue({
      pathname: "/tableau",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Navigate);
    expect(result.props.to).toBe("/stores");
  });

  it("allows users without a selected store to access store selection", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
      selectedStoreId: null,
    });

    useLocation.mockReturnValue({
      pathname: "/stores",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Outlet);
  });

  it("allows fully authenticated users into the application", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
      selectedStoreId: "store-1",
    });

    useLocation.mockReturnValue({
      pathname: "/tableau",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Outlet);
  });
});
