import {
  collection,
  runTransaction,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { optionalText, requireText } from "../utils/textValidation";
import { db } from "./firebase";

/**
 * Creates the Company, its Store and the admin User profile in one
 * transaction, so a failed onboarding never leaves a half-created workspace.
 * The User document id is the auth uid: that link is what the security
 * rules use for Company and Store isolation.
 * @param {object} data
 * @param {string} data.uid - Firebase Auth uid.
 * @param {?string} data.userName - Display name from the auth provider.
 * @param {string} data.companyName
 * @param {string} data.storeName
 * @param {string} data.street
 * @param {string} [data.streetNumber]
 * @param {string} data.postalCode
 * @param {string} data.city
 * @param {string} data.country
 * @returns {Promise<{userId: string, companyId: string, storeId: string}>}
 * @example
 * await createOnboardingWorkspace({
 *   uid: user.uid, userName: "Mario", companyName: "Bella Napoli SA",
 *   storeName: "Lugano", street: "Via Nassa", streetNumber: "5",
 *   postalCode: "6900", city: "Lugano", country: "Switzerland",
 * });
 */
export async function createOnboardingWorkspace({
  uid,
  userName,
  companyName,
  storeName,
  street,
  streetNumber,
  postalCode,
  city,
  country,
}) {
  const company = requireText(companyName, FIELD_LIMITS.NAME, "Company name");
  const store = requireText(storeName, FIELD_LIMITS.NAME, "Store name");
  const address = {
    street: requireText(street, FIELD_LIMITS.ADDRESS_LINE, "Street"),
    streetNumber: optionalText(
      streetNumber,
      FIELD_LIMITS.STREET_NUMBER,
      "Street number",
    ),
    postalCode: requireText(
      postalCode,
      FIELD_LIMITS.POSTAL_CODE,
      "Postal code",
    ),
    city: requireText(city, FIELD_LIMITS.ADDRESS_LINE, "City"),
    country: requireText(country, FIELD_LIMITS.ADDRESS_LINE, "Country"),
  };
  // The display name comes from the auth provider, not from a form: it is
  // truncated instead of rejected so a long provider name never blocks sign-up.
  const displayName =
    typeof userName === "string" && userName.trim()
      ? userName.trim().slice(0, FIELD_LIMITS.NAME)
      : null;

  const refCollectionCompanies = collection(db, "companies");
  const refCollectionStore = collection(db, "stores");
  const refCollectionUser = collection(db, "users");

  const refDocCompanies = doc(refCollectionCompanies);
  const refDocStores = doc(refCollectionStore);
  const refDocUsers = doc(refCollectionUser, uid);

  await runTransaction(db, async (transaction) => {
    transaction.set(refDocCompanies, {
      name: company,
      logoUrl: null,
      address: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(refDocStores, {
      name: store,
      address,
      companyId: refDocCompanies.id,
      isActive: true,
      imageUrl: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(refDocUsers, {
      uid: uid,
      companyId: refDocCompanies.id,
      storeId: refDocStores.id,
      role: "admin",
      displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return {
    userId: uid,
    companyId: refDocCompanies.id,
    storeId: refDocStores.id,
  };
}
