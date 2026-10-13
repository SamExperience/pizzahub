import { useState } from "react";
import { Pizza } from "lucide-react";
import { register, login } from "../services/auth.service";
import { loginWithGoogle } from "../services/auth.service";
import { getAuthErrorMessage } from "../utils/authErrors";
import {
  alert,
  button,
  card,
  input,
  label,
  muted,
  pageTitle,
  primaryButton,
} from "../utils/styles";

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      if (isSignup) {
        const user = await register(email, password);
        console.log("register ok, user>>>", user);
      } else {
        const userlog = await login(email, password);
        console.log("login ok, user>>>", userlog);
      }
    } catch (error) {
      console.log("Catch Error:", error.message);
      setError(getAuthErrorMessage(error));
    }
  }

  async function handleLoginWithGoogle() {
    setError(null);

    try {
      const user = await loginWithGoogle();
      console.log("login with google ok>>> ", user);
    } catch (error) {
      console.log("Catch Error:", error.message);
      setError(getAuthErrorMessage(error));
    }
  }

  function toggleMode() {
    setIsSignup((value) => !value);
    setError(null);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-neutral-50 px-4 py-8">
      <section id="login" className={`${card} w-full max-w-sm p-6 sm:p-8`}>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Pizza className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-neutral-900">
              PizzaHub
            </span>
          </div>
          <p className={muted}>
            {isSignup ? "Create your account" : "Sign in to manage your pizzeria"}
          </p>
        </div>

        <h1 className={`${pageTitle} mt-6`}>
          {isSignup ? "Sign up" : "Log in"}
        </h1>

        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={label}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={input}
              autoComplete="email"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className={label}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={input}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
            />
          </div>

          {isSignup && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className={label}>
                Confirm password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                className={input}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-red-600">Passwords do not match</p>
              )}
            </div>
          )}

          {error && (
            <div role="alert" className={alert}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={`${primaryButton} min-h-11 w-full`}
            disabled={isSignup && password !== confirmPassword}
          >
            {isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-neutral-200" />
          <span className={muted}>or</span>
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <button
          type="button"
          onClick={handleLoginWithGoogle}
          className={`${button} min-h-11 w-full gap-3`}
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.3A7.14 7.14 0 0 1 4.9 12c0-.8.14-1.57.37-2.3V6.61H1.28A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.28 5.39l3.99-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.61l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75z"
            />
          </svg>
          Login with Google
        </button>

        <p className={`${muted} mt-6 text-center`}>
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-brand-600 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            onClick={toggleMode}
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </section>
    </main>
  );
}
