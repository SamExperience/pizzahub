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

// Reads a Customer by id; returns null when it does not exist.
export const getCustomer = async (customerId) => {
  if (!customerId) throw new Error("Customer ID is required");

  const snapshot = await getDoc(doc(db, "customers", customerId));

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};

// Listens to a Customer in real time. Calls onChange with the Customer, or
// null when it does not exist, at every change and returns the unsubscribe
// function.
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

// All Customers of a Company, sorted by first name. Search is done on the
// client with filterCustomersByFirstName.
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

// Customers whose first name contains the search text (case-insensitive).
// An empty search returns no results.
export const filterCustomersByFirstName = (customers, searchText) => {
  const search = normalizeText(searchText)?.toLowerCase();

  if (!search) return [];

  return customers.filter((customer) =>
    customer.firstName?.toLowerCase().includes(search),
  );
};

// Validates the Customer for the order type and returns the normalized data.
// Takeaway: first name. Delivery: also phone and street, street number,
// postal code and city.
export const validateCustomer = (data, orderType) => {
  if (!Object.values(ORDER_TYPE).includes(orderType))
    throw new Error("Order type is invalid");

  const customer = normalizeCustomer(data);

  if (!customer.firstName) throw new Error("Customer first name is required");

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

// Adds the Customer write to the batch and returns the Customer id; the
// caller commits. A new Customer is created; an existing one is updated
// only when its fields changed.
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
