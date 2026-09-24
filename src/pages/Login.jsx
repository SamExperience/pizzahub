import { useState } from "react";
import { register } from "../services/auth.service";

async function handleSubmit(e) {
  e.preventDefault();

  try {
    const user = await register("test@example.com", "Password123!");
    console.log("register ok, user>>>", user);
  } catch (error) {
    console.log("Cathc Error: ", error.message);
  }
}
export default function Login() {
  const [isSignup, setIsSignup] = useState(false);

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
                autoComplete="new-password"
                required
              />
              <br />
            </>
          )}

          <button type="submit">
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
