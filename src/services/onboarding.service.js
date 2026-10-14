import {
  collection,
  runTransaction,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import { optionalText, requireText } from "../utils/textValidation";
import { db } from "./firebase";

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
