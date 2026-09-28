import { describe, expect, it } from "vitest";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { randomUUID } from "node:crypto";

import { db } from "../src/services/firebase";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";

describe("createOnboardingWorkspace", () => {
  it("creates Company, Store, and User with the correct relationships", async () => {
    const uid = `test-onboarding-${randomUUID()}`;

    const formData = {
      uid,
      userName: "Test User",
      companyName: "Test Company",
      storeName: "Test Store",
      street: "Rue du Lyon",
      streetNumber: "3",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    };

    const result = await createOnboardingWorkspace(formData);

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

    await Promise.all([
      deleteDoc(companyRef),
      deleteDoc(storeRef),
      deleteDoc(userRef),
    ]);
  });
});
