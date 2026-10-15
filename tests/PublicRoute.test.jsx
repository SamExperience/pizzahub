import { describe, expect, it, vi } from "vitest";
import { Navigate } from "react-router";
import { useAuth } from "../src/contexts/AuthContext";
import Login from "../src/pages/Login";
import PublicRoute from "../src/components/PublicRoute";
import LoadingState from "../src/components/LoadingState";
import ErrorState from "../src/components/ErrorState";

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

    expect(PublicRoute().type).toBe(LoadingState);
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

  it("shows an error instead of onboarding when the profile cannot be read", () => {
    const retryProfile = vi.fn();
    useAuth.mockReturnValue({
      authUser: { uid: "user-1" },
      userProfile: null,
      loadingLogin: false,
      profileError: new Error("offline"),
      retryProfile,
    });

    const result = PublicRoute();

    expect(result.type).toBe(ErrorState);
    expect(result.props.onRetry).toBe(retryProfile);
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
