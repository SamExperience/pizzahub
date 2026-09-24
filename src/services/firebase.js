// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./firebase.config";
import { connectAuthEmulator, getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://localhost:9099");
}
