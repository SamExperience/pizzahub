// @vitest-environment node
// Storage emulator uploads fail under jsdom XHR; the node environment uses fetch.
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadString,
} from "firebase/storage";
import { beforeAll, describe, expect, it } from "vitest";
import { app, storage } from "../src/services/firebase";
import { login, register, signout } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";

const TEST_PASSWORD = "Password123!";
const IMAGE = { contentType: "image/png" };

const createStore = async (label) => {
  const email = `test-storage-${label}-${Date.now()}@example.com`;
  const { user } = await register(email, TEST_PASSWORD);
  const { storeId, companyId } = await createOnboardingWorkspace({
    uid: user.uid,
    userName: user.displayName,
    companyName: `Storage ${label} Company`,
    storeName: `Storage ${label} Store`,
    street: "Rue du Lyon",
    streetNumber: "9",
    postalCode: "1201",
    city: "Genève",
    country: "Switzerland",
  });
  return { email, storeId, companyId };
};

// Seeds a Firestore profile through the emulator REST API (rules bypassed).
const seedProfile = async (uid, fields) => {
  const url = `http://localhost:8080/v1/projects/${app.options.projectId}/databases/(default)/documents/users?documentId=${uid}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries({ uid, ...fields }).map(([key, value]) => [
          key,
          { stringValue: value },
        ]),
      ),
    }),
  });
  if (!response.ok) throw new Error("Seeding the profile failed");
};

// Non-admin profile ("staff") linked to an existing store.
const createStaff = async (store) => {
  const email = `test-storage-staff-${Date.now()}@example.com`;
  const { user } = await register(email, TEST_PASSWORD);
  await seedProfile(user.uid, {
    companyId: store.companyId,
    storeId: store.storeId,
    role: "staff",
  });
  return { email, storeId: store.storeId };
};

let storeA;
let storeB;
let staffA;

beforeAll(async () => {
  storeA = await createStore("a");
  storeB = await createStore("b");
  staffA = await createStaff(storeA);
});

const signInAs = async (store) => {
  await signout();
  await login(store.email, TEST_PASSWORD);
};

describe("product image storage rules", () => {
  it("lets the owner upload, read and delete an image", async () => {
    await signInAs(storeA);
    const imageRef = ref(storage, `products/${storeA.storeId}/own.png`);

    await uploadString(imageRef, "image", "raw", IMAGE);
    await expect(getDownloadURL(imageRef)).resolves.toContain("own.png");
    await deleteObject(imageRef);
    await expect(getDownloadURL(imageRef)).rejects.toThrow();
  });

  it("denies another store upload, read and delete", async () => {
    await signInAs(storeA);
    const imageRef = ref(storage, `products/${storeA.storeId}/private.png`);
    await uploadString(imageRef, "image", "raw", IMAGE);

    await signInAs(storeB);
    await expect(
      uploadString(imageRef, "hack", "raw", IMAGE),
    ).rejects.toThrow();
    await expect(getDownloadURL(imageRef)).rejects.toThrow();
    await expect(deleteObject(imageRef)).rejects.toThrow();
  });

  it("denies uploading outside the user's store folder", async () => {
    await signInAs(storeB);
    const otherStoreRef = ref(storage, `products/${storeA.storeId}/x.png`);
    const flatRef = ref(storage, "products/flat.png");

    await expect(
      uploadString(otherStoreRef, "image", "raw", IMAGE),
    ).rejects.toThrow();
    await expect(uploadString(flatRef, "image", "raw", IMAGE)).rejects.toThrow();
  });

  it("denies unauthenticated access", async () => {
    await signInAs(storeA);
    const imageRef = ref(storage, `products/${storeA.storeId}/anon.png`);
    await uploadString(imageRef, "image", "raw", IMAGE);

    await signout();
    await expect(getDownloadURL(imageRef)).rejects.toThrow();
    await expect(
      uploadString(imageRef, "image", "raw", IMAGE),
    ).rejects.toThrow();
  });

  it("denies non-image files", async () => {
    await signInAs(storeA);
    const textRef = ref(storage, `products/${storeA.storeId}/note.txt`);

    await expect(
      uploadString(textRef, "text", "raw", { contentType: "text/plain" }),
    ).rejects.toThrow();
  });

  it("denies images larger than 5 MB", async () => {
    await signInAs(storeA);
    const bigRef = ref(storage, `products/${storeA.storeId}/big.png`);

    await expect(
      uploadString(bigRef, "a".repeat(5 * 1024 * 1024 + 1), "raw", IMAGE),
    ).rejects.toThrow();
  });
});

describe("product image storage roles", () => {
  const folderOf = (store) => ref(storage, `products/${store.storeId}`);

  it("lets the admin create, overwrite, read, list and delete an image", async () => {
    await signInAs(storeA);
    const imageRef = ref(storage, `products/${storeA.storeId}/admin.png`);

    await uploadString(imageRef, "image", "raw", IMAGE);
    await uploadString(imageRef, "image2", "raw", IMAGE);
    await expect(getDownloadURL(imageRef)).resolves.toContain("admin.png");
    const { items } = await listAll(folderOf(storeA));
    expect(items.map((item) => item.name)).toContain("admin.png");
    await deleteObject(imageRef);
    await expect(getDownloadURL(imageRef)).rejects.toThrow();
  });

  it("lets a non-admin profile read and list but not write", async () => {
    await signInAs(storeA);
    const imageRef = ref(storage, `products/${storeA.storeId}/staff.png`);
    await uploadString(imageRef, "image", "raw", IMAGE);

    await signInAs(staffA);
    await expect(getDownloadURL(imageRef)).resolves.toContain("staff.png");
    const { items } = await listAll(folderOf(storeA));
    expect(items.map((item) => item.name)).toContain("staff.png");
    await expect(
      uploadString(
        ref(storage, `products/${storeA.storeId}/staff-new.png`),
        "image",
        "raw",
        IMAGE,
      ),
    ).rejects.toThrow();
    await expect(
      uploadString(imageRef, "overwrite", "raw", IMAGE),
    ).rejects.toThrow();
    await expect(deleteObject(imageRef)).rejects.toThrow();

    await signInAs(storeA);
    await expect(getDownloadURL(imageRef)).resolves.toContain("staff.png");
  });

  it("denies another store's admin every operation", async () => {
    await signInAs(storeA);
    const imageRef = ref(storage, `products/${storeA.storeId}/other.png`);
    await uploadString(imageRef, "image", "raw", IMAGE);

    await signInAs(storeB);
    await expect(
      uploadString(
        ref(storage, `products/${storeA.storeId}/other-new.png`),
        "image",
        "raw",
        IMAGE,
      ),
    ).rejects.toThrow();
    await expect(
      uploadString(imageRef, "overwrite", "raw", IMAGE),
    ).rejects.toThrow();
    await expect(getDownloadURL(imageRef)).rejects.toThrow();
    await expect(listAll(folderOf(storeA))).rejects.toThrow();
    await expect(deleteObject(imageRef)).rejects.toThrow();
  });

  it("denies unauthenticated read, list, create, update and delete", async () => {
    await signInAs(storeA);
    const imageRef = ref(storage, `products/${storeA.storeId}/public.png`);
    await uploadString(imageRef, "image", "raw", IMAGE);

    await signout();
    await expect(getDownloadURL(imageRef)).rejects.toThrow();
    await expect(listAll(folderOf(storeA))).rejects.toThrow();
    await expect(
      uploadString(
        ref(storage, `products/${storeA.storeId}/public-new.png`),
        "image",
        "raw",
        IMAGE,
      ),
    ).rejects.toThrow();
    await expect(
      uploadString(imageRef, "overwrite", "raw", IMAGE),
    ).rejects.toThrow();
    await expect(deleteObject(imageRef)).rejects.toThrow();
  });
});
