import { setGlobalOptions } from "firebase-functions/v2";

// Same region as the project's Firestore database and Storage bucket (europe-west6, Zurich).
setGlobalOptions({ region: "europe-west6", maxInstances: 10 });
