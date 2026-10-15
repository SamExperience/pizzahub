/**
 * Firebase web app configuration read from the VITE_FIREBASE_* environment
 * variables, so the same build code targets any Firebase project. These
 * values are public identifiers, not secrets (access is enforced by the
 * security rules).
 * @type {FirebaseOptions}
 * @example
 * initializeApp(firebaseConfig);
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export { firebaseConfig };
