import { describe, expect, it, vi } from "vitest";
import { Navigate } from "react-router";
import { useAuth } from "../src/contexts/AuthContext";
import Login from "../src/pages/Login";
import PublicRoute from "../src/components/PublicRoute";

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../src/pages/Login", () => ({
  default: vi.fn(),
}));

describe("PublicRoute", () => {
  it("renders nothing while authentication is loading", () => {
    useAuth.mockReturnValue({
      authUser: null,
      userProfile: null,
      loadingLogin: true,
    });

    expect(PublicRoute()).toBeNull();
  });

  it("shows Login when the user is not authenticated", () => {
    useAuth.mockReturnValue({
      authUser: null,
      userProfile: null,
      loadingLogin: false,
    });

    const result = PublicRoute();

    expect(result.type).toBe(Login);
  });

  it("redirects new users to onboarding", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: null,
      loadingLogin: false,
    });

    const result = PublicRoute();

    expect(result.type).toBe(Navigate);
    expect(result.props.to).toBe("/onboarding");
  });

  it("redirects existing users to stores", () => {
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: { uid: "user-1" },
      loadingLogin: false,
    });

    const result = PublicRoute();

    expect(result.type).toBe(Navigate);
    expect(result.props.to).toBe("/stores");
  });
});
