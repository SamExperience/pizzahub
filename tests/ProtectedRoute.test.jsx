import { beforeEach, describe, expect, it, vi } from "vitest";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useStore } from "../src/contexts/StoreContext";
import ProtectedRoute from "../src/components/ProtectedRoute";

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../src/contexts/StoreContext", () => ({
  useStore: vi.fn(),
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
  beforeEach(() => {
    useStore.mockReturnValue({
      accessibleStore: null,
      loadingStore: false,
    });
  });

  it("renders nothing while authentication is loading", () => {
    useAuth.mockReturnValue({
      authUser: null,
      userProfile: null,
      loadingLogin: true,
    });

    expect(ProtectedRoute()).toBeNull();
  });

  it("redirects unauthenticated users to login", () => {
    useAuth.mockReturnValue({
      authUser: null,
      userProfile: null,
      loadingLogin: false,
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
    });

    useLocation.mockReturnValue({
      pathname: "/onboarding",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Outlet);
  });

  it("renders nothing while the store is loading", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
    });

    useStore.mockReturnValue({
      accessibleStore: null,
      loadingStore: true,
    });

    useLocation.mockReturnValue({
      pathname: "/dashboard",
    });

    expect(ProtectedRoute()).toBeNull();
  });

  it("redirects users with a profile away from onboarding to store selection", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
    });

    useStore.mockReturnValue({
      accessibleStore: { id: "store-1" },
      loadingStore: false,
    });

    useLocation.mockReturnValue({
      pathname: "/onboarding",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Navigate);
    expect(result.props.to).toBe("/stores");
  });

  it("redirects users without an accessible store to store selection", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
    });

    useLocation.mockReturnValue({
      pathname: "/tableau",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Navigate);
    expect(result.props.to).toBe("/stores");
  });

  it("allows users without an accessible store to access store selection", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
    });

    useLocation.mockReturnValue({
      pathname: "/stores",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Outlet);
  });
  it("redirects users with an accessible store but no selected store to store selection", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
    });

    useStore.mockReturnValue({
      accessibleStore: { id: "store-1" },
      selectedStore: null,
      loadingStore: false,
    });

    useLocation.mockReturnValue({
      pathname: "/tableau",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Navigate);
    expect(result.props.to).toBe("/stores");
  });
  it("allows fully authenticated users into the application", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
    });

    useStore.mockReturnValue({
      accessibleStore: { id: "store-1" },
      selectedStore: { id: "store-1" },
      loadingStore: false,
    });

    useLocation.mockReturnValue({
      pathname: "/tableau",
    });

    const result = ProtectedRoute();

    expect(result.type).toBe(Outlet);
  });
});
