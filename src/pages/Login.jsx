export default function Login() {
  return (
    <section id="login">
      <form className="login-form">
        <h1>Log in</h1>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        <button type="submit">Log in</button>

        <p className="switch-mode">
          Don't have an account?{" "}
          <button type="button" className="link">
            Sign up
          </button>
        </p>
      </form>
    </section>
  );
}
