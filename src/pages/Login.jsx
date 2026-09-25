import { useState } from "react";
import { register, login } from "../services/auth.service";
import { loginWithGoogle } from "../services/auth.service";

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

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
    }
  }

  async function handleLoginWithGoogle() {
    const user = await loginWithGoogle();
    console.log("login with google ok>>> ", user);
  }

  return (
    <main>
      <section id="login">
        <h1>{isSignup ? "Sign up" : "Log in"}</h1>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <br />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
          />
          <br />

          {isSignup && (
            <>
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />{" "}
              <br />
              {confirmPassword && password !== confirmPassword ? (
                <small style={{ color: "red" }}>Passwords do not match</small>
              ) : (
                <small style={{ color: "green" }}></small>
              )}
              <br />
            </>
          )}

          <button
            type="submit"
            disabled={isSignup && password !== confirmPassword}
          >
            {isSignup ? "Create account" : "Log in"}
          </button>
          <br />

          <p className="switch-mode">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              className="link"
              onClick={() => setIsSignup(!isSignup)}
            >
              <br />
              {isSignup ? "Log in" : "Sign up"}
            </button>
            <br />
          </p>
          <br />
        </form>
        <p className="switch-mode">
          {!isSignup && "Login with google"}
          <button
            onClick={handleLoginWithGoogle}
            className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
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
          <br />
        </p>
      </section>
    </main>
  );
}
