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

describe("createOnboardingWorkspace validation", () => {
  const validData = {
    uid: "uid1",
    userName: "Test User",
    companyName: "Test Company",
    storeName: "Test Store",
    street: "Rue du Lyon",
    streetNumber: "3",
    postalCode: "1201",
    city: "Genève",
    country: "Switzerland",
  };

  const registerUser = async () => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      `onboarding-${randomUUID()}@test.local`,
      "Password123!",
    );
    return credential.user.uid;
  };

  afterEach(async () => {
    await signOut(auth);
    await clearFirestoreEmulator();
  });

  it.each([
    ["companyName", "Company name"],
    ["storeName", "Store name"],
    ["street", "Street"],
    ["postalCode", "Postal code"],
    ["city", "City"],
    ["country", "Country"],
  ])("rejects a blank %s", async (field, label) => {
    await expect(
      createOnboardingWorkspace({ ...validData, [field]: "   " }),
    ).rejects.toThrow(`${label} is required`);
  });

  it.each([
    ["companyName", 101, "Company name"],
    ["storeName", 101, "Store name"],
    ["street", 101, "Street"],
    ["streetNumber", 21, "Street number"],
    ["postalCode", 21, "Postal code"],
    ["city", 101, "City"],
    ["country", 101, "Country"],
  ])("rejects a too long %s", async (field, length, label) => {
    await expect(
      createOnboardingWorkspace({ ...validData, [field]: "a".repeat(length) }),
    ).rejects.toThrow(`${label} must be at most`);
  });

  it("trims the data, nulls an empty street number and truncates a long display name", async () => {
    const uid = await registerUser();

    const result = await createOnboardingWorkspace({
      ...validData,
      uid,
      userName: "n".repeat(120),
      companyName: ` ${"c".repeat(100)} `,
      streetNumber: "  ",
    });
    const [companySnap, storeSnap, userSnap] = await Promise.all([
      getDoc(doc(db, "companies", result.companyId)),
      getDoc(doc(db, "stores", result.storeId)),
      getDoc(doc(db, "users", uid)),
    ]);

    expect(companySnap.data().name).toBe("c".repeat(100));
    expect(storeSnap.data().address.streetNumber).toBeNull();
    expect(userSnap.data().displayName).toBe("n".repeat(100));
  });

  it("stores a null display name when none is provided", async () => {
    const uid = await registerUser();

    await createOnboardingWorkspace({ ...validData, uid, userName: null });

    expect((await getDoc(doc(db, "users", uid))).data().displayName).toBeNull();
  });
});
