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
    writeBatch, // <-- INI YANG TADI KURANG
    doc,
    query,
    orderBy,
    where,
    limit
} from "firebase/firestore";

// Config dari Bapak
const firebaseConfig = {
  apiKey: "AIzaSyBvJSkJbvumZpJW9ZejT4ukZpZ-wQUFi0E",
  authDomain: "kasir-59ce2.firebaseapp.com",
  projectId: "kasir-59ce2",
  storageBucket: "kasir-59ce2.firebasestorage.app",
  messagingSenderId: "269650143782",
  appId: "1:269650143782:web:7d36e3ba7faa7fc01e14e7",
  measurementId: "G-9H7CZVWXYB"
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
    writeBatch, // <-- Export agar SettingsView bisa pakai
    doc, 
    query, 
    orderBy, 
    where,
    limit
};