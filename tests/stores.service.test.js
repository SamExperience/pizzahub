import { expect, it, describe } from "vitest";
import { getAccessibleStore } from "../src/services/store.service";
import { register } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";

const TEST_PASSWORD = "Password123!";

const registerTestUser = async () => {
  const email = `test-${Date.now()}@example.com`;
  const userCredential = await register(email, TEST_PASSWORD);
  return userCredential.user;
};

describe("getAccessibleStore", () => {
  it("returns the store accessible to the user", async () => {
    // Arrange: register a user and complete onboarding to persist the workspace in Firestore
    const user = await registerTestUser();

    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Test Company",
      storeName: "Test Store",
      street: "Rue du Lyon",
      streetNumber: "3",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });

    // Act
    const store = await getAccessibleStore(user.uid);

    // Assert
    expect(store).toEqual({
      id: result.storeId,
      name: "Test Store",
      companyId: result.companyId,
      isActive: true,
      address: {
        street: "Rue du Lyon",
        streetNumber: "3",
        postalCode: "1201",
        city: "Genève",
        country: "Switzerland",
      },
      imageUrl: null,
      createdAt: expect.anything(),
      updatedAt: expect.anything(),
    });
  });

  it("throws an error when the user profile does not exist", async () => {
    // Arrange: authenticated user without a completed onboarding
    const user = await registerTestUser();

    // Act & Assert
    await expect(getAccessibleStore(user.uid)).rejects.toThrow(
      "User profile not found",
    );
  });

  it("throws an error when the user ID is not provided", async () => {
    // Act & Assert
    await expect(getAccessibleStore()).rejects.toThrow("User ID is required");
  });
});
