import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { randomUUID } from "node:crypto";

import { auth, db } from "../src/services/firebase";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";

const firestoreEmulatorClearUrl =
  `http://127.0.0.1:8080/emulator/v1/projects/${db.app.options.projectId}` +
  "/databases/(default)/documents";

async function clearFirestoreEmulator() {
  const response = await fetch(firestoreEmulatorClearUrl, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to clear Firestore Emulator: ${response.status}`);
  }
}

describe("createOnboardingWorkspace", () => {
  beforeEach(async () => {
    await signOut(auth);
    await clearFirestoreEmulator();
  });

  afterEach(async () => {
    await signOut(auth);
    await clearFirestoreEmulator();
  });

  it("creates Company, Store, and User with the correct relationships", async () => {
    const email = `onboarding-${randomUUID()}@test.local`;
    const password = "Password123!";

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const uid = credential.user.uid;

    const result = await createOnboardingWorkspace({
      uid,
      userName: "Test User",
      companyName: "Test Company",
      storeName: "Test Store",
      street: "Rue du Lyon",
      streetNumber: "3",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });

    expect(result.userId).toBe(uid);

    const companyRef = doc(db, "companies", result.companyId);
    const storeRef = doc(db, "stores", result.storeId);
    const userRef = doc(db, "users", result.userId);

    const [companySnap, storeSnap, userSnap] = await Promise.all([
      getDoc(companyRef),
      getDoc(storeRef),
      getDoc(userRef),
    ]);

    expect(companySnap.exists()).toBe(true);
    expect(storeSnap.exists()).toBe(true);
    expect(userSnap.exists()).toBe(true);

    expect(companySnap.data()).toMatchObject({
      name: "Test Company",
      logoUrl: null,
      address: null,
    });

    expect(storeSnap.data()).toMatchObject({
      name: "Test Store",
      companyId: result.companyId,
      address: {
        street: "Rue du Lyon",
        streetNumber: "3",
        postalCode: "1201",
        city: "Genève",
        country: "Switzerland",
      },
      imageUrl: null,
      isActive: true,
    });

    expect(userSnap.data()).toMatchObject({
      uid,
      companyId: result.companyId,
      storeId: result.storeId,
      role: "admin",
      displayName: "Test User",
    });
  });

  it("rejects onboarding creation when the user is not authenticated", async () => {
    await expect(
      createOnboardingWorkspace({
        uid: `unauthenticated-${randomUUID()}`,
        userName: "Test User",
        companyName: "Test Company",
        storeName: "Test Store",
        street: "Rue du Lyon",
        streetNumber: "3",
        postalCode: "1201",
        city: "Genève",
        country: "Switzerland",
      }),
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});
