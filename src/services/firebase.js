import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./firebase.config";
import { getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

/**
 * The single Firebase app instance. Only services/ import it: components
 * never talk to Firebase directly (spec/04-architecture.md).
 * @type {FirebaseApp}
 * @example
 * import { app } from "./firebase";
 */
export const app = initializeApp(firebaseConfig);
/**
 * Firebase Auth instance, connected to the Auth emulator in development.
 * @type {Auth}
 * @example
 * auth.currentUser?.uid;
 */
export const auth = getAuth(app);
/**
 * Firestore instance, connected to the Firestore emulator in development.
 * @type {Firestore}
 * @example
 * doc(db, "stores", storeId);
 */
export const db = getFirestore(app);
/**
 * Cloud Storage instance (product images), emulated in development.
 * @type {FirebaseStorage}
 * @example
 * ref(storage, `products/${storeId}/${productId}`);
 */
export const storage = getStorage(app);
/**
 * Cloud Functions instance. The region must match the deployed functions
 * (europe-west6, next to Firestore and Storage), otherwise calls go to
 * us-central1 and fail.
 * @type {Functions}
 * @example
 * httpsCallable(functions, "createCheckoutSession");
 */
export const functions = getFunctions(app, "europe-west6");

if (import.meta.env.DEV || import.meta.env.MODE === "test") {
  // The emulator banner would cover the bottom of the screen (ticket footer,
  // floating Create Ticket button).
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "localhost", 5001);
}
