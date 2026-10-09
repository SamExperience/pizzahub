import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  doc: vi.fn((db, collectionName, id) => ({ collectionName, id })),
  getDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => firestore);
vi.mock("../src/services/firebase", () => ({ db: { name: "db" } }));

import { getCustomer } from "../src/services/customer.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCustomer", () => {
  it("returns the Customer with its id", async () => {
    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      id: "c1",
      data: () => ({ firstName: "Mario" }),
    });

    await expect(getCustomer("c1")).resolves.toEqual({
      id: "c1",
      firstName: "Mario",
    });
    expect(firestore.doc).toHaveBeenCalledWith({ name: "db" }, "customers", "c1");
  });

  it("returns null when the Customer does not exist", async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });

    await expect(getCustomer("missing")).resolves.toBeNull();
  });

  it("requires a Customer id", async () => {
    await expect(getCustomer("")).rejects.toThrow("Customer ID is required");
    expect(firestore.getDoc).not.toHaveBeenCalled();
  });
});
