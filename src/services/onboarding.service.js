import {
  collection,
  runTransaction,
  doc,
  serverTimestamp,
} from "firebase/firestore";
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
  const refCollectionCompanies = collection(db, "companies");
  const refCollectionStore = collection(db, "stores");
  const refCollectionUser = collection(db, "users");

  const refDocCompanies = doc(refCollectionCompanies);
  const refDocStores = doc(refCollectionStore);
  const refDocUsers = doc(refCollectionUser, uid);

  await runTransaction(db, async (transaction) => {
    transaction.set(refDocCompanies, {
      name: companyName,
      logoUrl: null,
      address: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(refDocStores, {
      name: storeName,
      address: {
        street: street,
        streetNumber: streetNumber,
        postalCode: postalCode,
        city: city,
        country: country,
      },
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
      displayName: userName,
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
