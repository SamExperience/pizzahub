// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./firebase.config";
import { getFirestore } from "firebase/firestore";
//emulators
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
//firestore db service
export const db = getFirestore(app);
//storage service
export const storage = getStorage(app);
//cloud functions service (same region as the deployed functions)
export const functions = getFunctions(app, "europe-west6");

if (import.meta.env.DEV || import.meta.env.MODE === "test") {
  // The emulator banner would cover the bottom of the screen (ticket footer,
  // floating Create Ticket button).
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "localhost", 5001);
}
