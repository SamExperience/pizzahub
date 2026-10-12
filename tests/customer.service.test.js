import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  collection: vi.fn((db, collectionName) => ({ collectionName })),
  // doc(collectionRef) generates a new id; doc(db, name, id) points to a document.
  doc: vi.fn((parent, collectionName, id) =>
    collectionName === undefined
      ? { collectionName: parent.collectionName, id: "new-customer" }
      : { collectionName, id },
  ),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  serverTimestamp: vi.fn(() => "server-time"),
  where: vi.fn((field, op, value) => ({ field, op, value })),
}));

vi.mock("firebase/firestore", () => firestore);
vi.mock("../src/services/firebase", () => ({ db: { name: "db" } }));

import {
  addCustomerToBatch,
  filterCustomersByFirstName,
  getCustomer,
  getCustomersByCompanyId,
  validateCustomer,
} from "../src/services/customer.service";

const fullAddress = {
  street: "Rue du Lyon",
  streetNumber: "5",
  postalCode: "1201",
  city: "Genève",
  country: null,
};

const deliveryCustomer = {
  firstName: "Mario",
  lastName: null,
  phone: "+41 79 000 00 00",
  address: fullAddress,
};

const createBatch = () => ({ set: vi.fn(), update: vi.fn() });

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

describe("getCustomersByCompanyId", () => {
  it("returns the Company's Customers sorted by first name", async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        { id: "c2", data: () => ({ firstName: "Paolo" }) },
        { id: "c1", data: () => ({ firstName: "Anna" }) },
      ],
    });

    await expect(getCustomersByCompanyId("company-1")).resolves.toEqual([
      { id: "c1", firstName: "Anna" },
      { id: "c2", firstName: "Paolo" },
    ]);
    expect(firestore.where).toHaveBeenCalledWith("companyId", "==", "company-1");
  });

  it("requires a Company id", async () => {
    await expect(getCustomersByCompanyId("")).rejects.toThrow(
      "Company ID is required",
    );
    expect(firestore.getDocs).not.toHaveBeenCalled();
  });
});

describe("filterCustomersByFirstName", () => {
  const customers = [
    { id: "c1", firstName: "Mario" },
    { id: "c2", firstName: "Marta" },
    { id: "c3", firstName: "Anna" },
  ];

  it("matches first names containing the search text, ignoring case", () => {
    expect(filterCustomersByFirstName(customers, " MAR ")).toEqual([
      customers[0],
      customers[1],
    ]);
    expect(filterCustomersByFirstName(customers, "nn")).toEqual([customers[2]]);
  });

  it("returns no results for an empty search", () => {
    expect(filterCustomersByFirstName(customers, "  ")).toEqual([]);
    expect(filterCustomersByFirstName(customers, undefined)).toEqual([]);
  });
});

describe("validateCustomer", () => {
  it("requires only the first name for takeaway and normalizes the data", () => {
    expect(
      validateCustomer({ firstName: " Mario ", lastName: "", phone: " " }, "takeaway"),
    ).toEqual({ firstName: "Mario", lastName: null, phone: null, address: null });
  });

  it("requires the first name", () => {
    expect(() => validateCustomer({ firstName: "  " }, "takeaway")).toThrow(
      "Customer first name is required",
    );
  });

  it("rejects an invalid order type", () => {
    expect(() => validateCustomer({ firstName: "Mario" }, "dine-in")).toThrow(
      "Order type is invalid",
    );
  });

  it("accepts a delivery Customer with phone and full address", () => {
    expect(validateCustomer(deliveryCustomer, "delivery")).toEqual(
      deliveryCustomer,
    );
  });

  it("requires the phone for delivery", () => {
    expect(() =>
      validateCustomer({ ...deliveryCustomer, phone: "" }, "delivery"),
    ).toThrow("Customer phone is required for delivery");
  });

  it.each(["street", "streetNumber", "postalCode", "city"])(
    "requires the address %s for delivery",
    (field) => {
      expect(() =>
        validateCustomer(
          { ...deliveryCustomer, address: { ...fullAddress, [field]: " " } },
          "delivery",
        ),
      ).toThrow(
        "Customer street, street number, postal code and city are required for delivery",
      );
    },
  );

  it("requires an address for delivery", () => {
    expect(() =>
      validateCustomer({ ...deliveryCustomer, address: null }, "delivery"),
    ).toThrow("required for delivery");
  });
});

describe("addCustomerToBatch", () => {
  it("adds a new Customer to the batch and returns its id", () => {
    const batch = createBatch();

    const customerId = addCustomerToBatch(batch, {
      companyId: "company-1",
      orderType: "takeaway",
      data: { firstName: "Mario" },
    });

    expect(customerId).toBe("new-customer");
    expect(batch.set).toHaveBeenCalledWith(
      { collectionName: "customers", id: "new-customer" },
      {
        companyId: "company-1",
        firstName: "Mario",
        lastName: null,
        phone: null,
        address: null,
        createdAt: "server-time",
        updatedAt: "server-time",
      },
    );
    expect(batch.update).not.toHaveBeenCalled();
  });

  it("updates an existing Customer when its fields changed", () => {
    const batch = createBatch();
    const existingCustomer = {
      id: "c1",
      companyId: "company-1",
      firstName: "Mario",
      createdAt: "earlier",
    };

    const customerId = addCustomerToBatch(batch, {
      companyId: "company-1",
      orderType: "delivery",
      data: deliveryCustomer,
      existingCustomer,
    });

    expect(customerId).toBe("c1");
    expect(batch.update).toHaveBeenCalledWith(
      { collectionName: "customers", id: "c1" },
      { ...deliveryCustomer, updatedAt: "server-time" },
    );
    expect(batch.set).not.toHaveBeenCalled();
  });

  it("does not update an existing Customer when nothing changed", () => {
    const batch = createBatch();
    const existingCustomer = {
      id: "c1",
      companyId: "company-1",
      ...deliveryCustomer,
      createdAt: "earlier",
    };

    const customerId = addCustomerToBatch(batch, {
      companyId: "company-1",
      orderType: "delivery",
      data: { ...deliveryCustomer, firstName: " Mario " },
      existingCustomer,
    });

    expect(customerId).toBe("c1");
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.set).not.toHaveBeenCalled();
  });

  it("validates the Customer before writing", () => {
    const batch = createBatch();

    expect(() =>
      addCustomerToBatch(batch, {
        companyId: "company-1",
        orderType: "delivery",
        data: { firstName: "Mario" },
      }),
    ).toThrow("Customer phone is required for delivery");
    expect(batch.set).not.toHaveBeenCalled();
  });

  it("requires a batch and a Company id", () => {
    expect(() =>
      addCustomerToBatch(null, {
        companyId: "company-1",
        orderType: "takeaway",
        data: { firstName: "Mario" },
      }),
    ).toThrow("Batch is required");
    expect(() =>
      addCustomerToBatch(createBatch(), {
        orderType: "takeaway",
        data: { firstName: "Mario" },
      }),
    ).toThrow("Company ID is required");
  });
});
