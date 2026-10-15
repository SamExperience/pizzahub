import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  collection: vi.fn((db, name) => ({ name })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  getCountFromServer: vi.fn(),
}));

vi.mock("firebase/firestore", () => firestore);
vi.mock("firebase/storage", () => ({}));
vi.mock("../src/services/firebase", () => ({ db: {}, storage: {} }));

import { countProductsByCategoryId } from "../src/services/product.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("countProductsByCategoryId", () => {
  it("counts the category's products on the server", async () => {
    firestore.getCountFromServer.mockResolvedValue({
      data: () => ({ count: 4 }),
    });

    await expect(countProductsByCategoryId("cat-1")).resolves.toBe(4);
    expect(firestore.where).toHaveBeenCalledWith("categoryId", "==", "cat-1");
    expect(firestore.getCountFromServer).toHaveBeenCalledWith({
      ref: { name: "products" },
      constraints: [{ field: "categoryId", op: "==", value: "cat-1" }],
    });
  });

  it("requires a category id", async () => {
    await expect(countProductsByCategoryId("")).rejects.toThrow(
      "Category ID is required",
    );
    expect(firestore.getCountFromServer).not.toHaveBeenCalled();
  });
});
