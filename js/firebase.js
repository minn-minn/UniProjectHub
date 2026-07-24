// ============================================================
// firebase.js — Initialize Firebase App
// ============================================================
// This file starts Firebase and exports auth + db
// so every other JS file can import them.
// ============================================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth }          from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore }     from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAnalytics }     from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey:            "AIzaSyB6QzNtxZvY6rN-OWCyTImPXXIxINeSTwM",
  authDomain:        "uniprojecthub-76630.firebaseapp.com",
  projectId:         "uniprojecthub-76630",
  storageBucket:     "uniprojecthub-76630.firebasestorage.app",
  messagingSenderId: "230895092010",
  appId:             "1:230895092010:web:57b56bd76348b147545e53",
  measurementId:     "G-305NGCLNTL"
};

// Start Firebase
const app = initializeApp(firebaseConfig);

// Analytics only works on HTTP/HTTPS (not file://), so we wrap it safely
try { getAnalytics(app); } catch (e) { /* silently skip on local file:// */ }

// Export services so other files can use them
export const auth = getAuth(app);
export const db   = getFirestore(app);
