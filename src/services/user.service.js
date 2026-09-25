import { db } from "./firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export const getUserDB = async (uid) => {
  //reference
  const ref = doc(db, `users`, uid);

  const snap = await getDoc(ref);

  if (snap.exists()) {
    console.log("User Exist!!!", snap.data());
    return snap.data();
  } else {
    console.log("Service: User NOT  Exist!!!");
  }
};

export const addUserDB = async (user) => {
  const usersRef = collection(db, "users");

  await setDoc(doc(usersRef, user.uid), {
    companyId: null,
    storeId: null,
    role: "admin",
    displayName: user.displayName,
    email: user.email,
    createdAt: server(serverTimestamp()),
    updatedAt: server(serverTimestamp()),
  });
  console.log(">>>User added on DB ");
};
