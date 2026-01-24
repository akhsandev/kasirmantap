import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    enableIndexedDbPersistence,
    collection,
    getDocs,
    getDoc,
    getDocsFromCache,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    doc,
    query,
    orderBy,
    where,
    limit,
    increment // <--- TAMBAHAN BARU DISINI
} from "firebase/firestore";

// Config dari Bapak
const firebaseConfig = {
  apiKey: "AIzaSyAiDhKZ2WtE92dRI9jMNo4j8d5wBSxP12w",
  authDomain: "kasirakhsan.firebaseapp.com",
  projectId: "kasirakhsan",
  storageBucket: "kasirakhsan.firebasestorage.app",
  messagingSenderId: "617046173731",
  appId: "1:617046173731:web:0b25749e02aa4fe6bc2996",
  measurementId: "G-WSVV2K450P"
};

// 1. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Initialize Firestore
const db = getFirestore(app);

// 3. Aktifkan OFFLINE PERSISTENCE (Cache)
enableIndexedDbPersistence(db)
  .then(() => {
      console.log("Firebase Offline Persistence: ACTIVE");
  })
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.log("Persistence failed: Multiple tabs open.");
      } else if (err.code == 'unimplemented') {
          console.log("Persistence not supported by browser.");
      }
  });

// Export semua fungsi agar bisa dipakai di file lain
export { 
    db, 
    collection, 
    getDocs, 
    getDoc,
    getDocsFromCache,
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    writeBatch,
    doc, 
    query, 
    orderBy, 
    where,
    limit,
    increment // <--- JANGAN LUPA EXPORT DISINI JUGA
};