import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { FIELD_LIMITS } from "../utils/fieldLimits";
import { assertMaxLength } from "../utils/textValidation";
import { db } from "./firebase";
import { ORDER_TYPE } from "./order.service";

const ADDRESS_FIELDS = ["street", "streetNumber", "postalCode", "city", "country"];

// Address fields required for Delivery orders (country is optional).
const DELIVERY_ADDRESS_FIELDS = ["street", "streetNumber", "postalCode", "city"];

// Trimmed string, or null when empty or not a string.
const normalizeText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

// Keeps only the Customer's editable fields, trimmed; empty values become
// null and an address without any value becomes null.
const normalizeCustomer = (data = {}) => {
  const address = Object.fromEntries(
    ADDRESS_FIELDS.map((field) => [field, normalizeText(data.address?.[field])]),
  );
  const hasAddress = Object.values(address).some((value) => value !== null);

  return {
    firstName: normalizeText(data.firstName),
    lastName: normalizeText(data.lastName),
    phone: normalizeText(data.phone),
    address: hasAddress ? address : null,
  };
};

const isSameCustomer = (current, next) =>
  JSON.stringify(normalizeCustomer(current)) === JSON.stringify(next);

/**
 * Reads a Customer by id. Orders store only the customerId, so screens that
 * show the contact read it here; null when it does not exist.
 * @param {string} customerId
 * @returns {Promise<?object>}
 * @example
 * const customer = await getCustomer(order.customerId);
 */
export const getCustomer = async (customerId) => {
  if (!customerId) throw new Error("Customer ID is required");

  const snapshot = await getDoc(doc(db, "customers", customerId));

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};

/**
 * Listens to a Customer in real time, so a customer edit made from any
 * ticket updates every Tableau card showing that Customer. Calls onChange
 * with the Customer, or null when it does not exist.
 * @param {string} customerId
 * @param {function(?object): void} onChange
 * @param {function(Error): void} [onError]
 * @returns {function(): void} Unsubscribe function.
 * @example
 * const stop = subscribeToCustomer(order.customerId, setCustomer);
 */
export const subscribeToCustomer = (customerId, onChange, onError) => {
  if (!customerId) throw new Error("Customer ID is required");

  if (typeof onChange !== "function")
    throw new Error("onChange callback is required");

  return onSnapshot(
    doc(db, "customers", customerId),
    (snapshot) =>
      onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
};

/**
 * Reads all Customers of a Company, sorted by first name. They are loaded
 * once when the ticket sidebar opens and searched on the client with
 * filterCustomersByFirstName: Firestore has no "contains" query.
 * @param {string} companyId
 * @returns {Promise<object[]>}
 * @example
 * const customers = await getCustomersByCompanyId("company1");
 */
export const getCustomersByCompanyId = async (companyId) => {
  if (!companyId) throw new Error("Company ID is required");

  const q = query(
    collection(db, "customers"),
    where("companyId", "==", companyId),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.firstName ?? "").localeCompare(b.firstName ?? ""));
};

/**
 * Filters Customers whose first name contains the search text
 * (case-insensitive). An empty search returns no results, so the list stays
 * empty until the user types.
 * @param {object[]} customers
 * @param {string} searchText
 * @returns {object[]}
 * @example
 * filterCustomersByFirstName([{ firstName: "Mario" }], "ar"); // [{ firstName: "Mario" }]
 */
export const filterCustomersByFirstName = (customers, searchText) => {
  const search = normalizeText(searchText)?.toLowerCase();

  if (!search) return [];

  return customers.filter((customer) =>
    customer.firstName?.toLowerCase().includes(search),
  );
};

const CUSTOMER_FIELD_LIMITS = [
  ["firstName", "First name", FIELD_LIMITS.NAME],
  ["lastName", "Last name", FIELD_LIMITS.NAME],
  ["phone", "Phone", FIELD_LIMITS.PHONE],
];

const CUSTOMER_ADDRESS_FIELD_LIMITS = [
  ["street", "Street", FIELD_LIMITS.ADDRESS_LINE],
  ["streetNumber", "Street number", FIELD_LIMITS.STREET_NUMBER],
  ["postalCode", "Postal code", FIELD_LIMITS.POSTAL_CODE],
  ["city", "City", FIELD_LIMITS.ADDRESS_LINE],
  ["country", "Country", FIELD_LIMITS.ADDRESS_LINE],
];

/**
 * Validates the Customer for the order type and returns the normalized
 * data. Takeaway needs only a first name; Delivery also needs phone and
 * street, street number, postal code and city, because the rider must reach
 * the customer.
 * @param {object} data - Customer form values.
 * @param {"takeaway"|"delivery"} orderType
 * @returns {{firstName: string, lastName: ?string, phone: ?string, address: ?object}}
 * @throws {Error} With a user-facing message when a field is missing or too long.
 * @example
 * validateCustomer({ firstName: " Mario " }, "takeaway"); // firstName "Mario"
 */
export const validateCustomer = (data, orderType) => {
  if (!Object.values(ORDER_TYPE).includes(orderType))
    throw new Error("Order type is invalid");

  const customer = normalizeCustomer(data);

  if (!customer.firstName) throw new Error("Customer first name is required");

  CUSTOMER_FIELD_LIMITS.forEach(([field, label, max]) =>
    assertMaxLength(customer[field], max, `Customer ${label.toLowerCase()}`),
  );
  CUSTOMER_ADDRESS_FIELD_LIMITS.forEach(([field, label, max]) =>
    assertMaxLength(
      customer.address?.[field],
      max,
      `Customer ${label.toLowerCase()}`,
    ),
  );

  if (orderType === ORDER_TYPE.DELIVERY) {
    if (!customer.phone)
      throw new Error("Customer phone is required for delivery");

    if (DELIVERY_ADDRESS_FIELDS.some((field) => !customer.address?.[field]))
      throw new Error(
        "Customer street, street number, postal code and city are required for delivery",
      );
  }

  return customer;
};

/**
 * Adds the Customer write to the caller's batch and returns the Customer id,
 * so the Customer and the Order are saved atomically. A new Customer is
 * created; an existing one is updated only when its fields changed (no
 * useless writes).
 * @param {WriteBatch} batch
 * @param {object} options
 * @param {string} options.companyId
 * @param {"takeaway"|"delivery"} options.orderType
 * @param {object} options.data - Customer form values.
 * @param {?object} [options.existingCustomer] - Selected Customer, if any.
 * @returns {string} The Customer id.
 * @example
 * const customerId = addCustomerToBatch(batch, {
 *   companyId: "company1", orderType: "takeaway", data: { firstName: "Mario" },
 * });
 */
export const addCustomerToBatch = (
  batch,
  { companyId, orderType, data, existingCustomer = null },
) => {
  if (!batch) throw new Error("Batch is required");

  if (!companyId) throw new Error("Company ID is required");

  const customer = validateCustomer(data, orderType);

  if (existingCustomer) {
    if (!isSameCustomer(existingCustomer, customer)) {
      batch.update(doc(db, "customers", existingCustomer.id), {
        ...customer,
        updatedAt: serverTimestamp(),
      });
    }

    return existingCustomer.id;
  }

  const customerRef = doc(collection(db, "customers"));

  batch.set(customerRef, {
    companyId,
    ...customer,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return customerRef.id;
};
