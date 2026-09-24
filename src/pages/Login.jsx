import { useState } from "react";
import { register, login } from "../services/auth.service";

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
      </section>
    </main>
  );
}
