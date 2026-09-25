import { describe, expect, it } from "vitest";
import { register, login } from "../src/services/auth.service";

describe("register", () => {
  it("registers a new user with valid credentials", async () => {
    const email = `test-${Date.now()}@example.com`;
    const password = "Password123!";

    const userCredential = await register(email, password);

    expect(userCredential.user.email).toBe(email);
  });

  it("throws an error when the email is already registered", async () => {
    const email = `duplicate-${Date.now()}@example.com`;
    const password = "Password123!";

    await register(email, password);

    await expect(register(email, password)).rejects.toMatchObject({
      code: "auth/email-already-in-use",
    });
  });

  it("throws an error when the password is invalid", async () => {
    const email = `invalid-password-${Date.now()}@example.com`;
    const password = "123";

    await expect(register(email, password)).rejects.toMatchObject({
      code: "auth/weak-password",
    });
  });

  it("throws an error when the email is invalid", async () => {
    const email = `invalid-email-${Date.now()}`;
    const password = "Password123!";

    await expect(register(email, password)).rejects.toMatchObject({
      code: "auth/invalid-email",
    });
  });
});

describe("login", () => {
  it("logs in a user with valid credentials", async () => {
    const email = `login-${Date.now()}@example.com`;
    const password = "Password123!";

    await register(email, password);

    const userCredential = await login(email, password);

    expect(userCredential.user.email).toBe(email);
  });

  it("throws an error when the email does not exist", async () => {
    const email = `unknown-${Date.now()}@example.com`;
    const password = "Password123!";

    await expect(login(email, password)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
  });

  it("throws an error when the password is incorrect", async () => {
    const email = `wrong-password-${Date.now()}@example.com`;
    const password = "Password123!";

    await register(email, password);

    await expect(login(email, "WrongPassword123!")).rejects.toMatchObject({
      code: "auth/wrong-password",
    });
  });
});
