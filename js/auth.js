// ============================================================
// auth.js — Authentication Functions
// ============================================================
// Handles: login, register, logout, password reset,
// and protecting pages so only logged-in users can see them.
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { auth, db } from './firebase.js';

// ── Register a New Student ───────────────────────────────────
// Creates a Firebase Auth account + saves profile to Firestore
export async function registerStudent(userData) {
  const { email, password, fullName, universityId, department, batch, labGroup } = userData;

  // 1. Create auth account
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  // 2. Save extra profile info to Firestore
  await setDoc(doc(db, 'users', uid), {
    uid,
    fullName,
    universityId,
    email,
    department,
    batch,
    labGroup,
    isAdmin:   false,
    createdAt: serverTimestamp()
  });

  return credential.user;
}

// ── Login ────────────────────────────────────────────────────
export async function loginStudent(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

// ── Logout ───────────────────────────────────────────────────
export async function logoutUser() {
  await signOut(auth);
  window.location.href = 'login.html';
}

// ── Password Reset ───────────────────────────────────────────
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Get Current User's Firestore Data ───────────────────────
// Returns the user's profile document from Firestore
export async function getCurrentUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ── Protect a Page (Student) ─────────────────────────────────
// Call this at the top of every student page.
// If not logged in → sends to login page.
// Returns the Firebase user object if logged in.
export function requireAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Stop listening after first check
      if (user) {
        resolve(user);
      } else {
        window.location.href = 'login.html';
        reject(new Error('Not authenticated'));
      }
    });
  });
}

// ── Protect a Page (Admin) ───────────────────────────────────
// Call this at the top of every admin page.
// Checks if user is logged in AND has isAdmin: true in Firestore.
export async function requireAdmin() {
  const user = await requireAuth();
  const data = await getCurrentUserData(user.uid);
  if (!data || !data.isAdmin) {
    window.location.href = 'dashboard.html';
    throw new Error('Not admin');
  }
  return { user, userData: data };
}

// ── Redirect If Already Logged In ────────────────────────────
// Used on login.html and register.html.
// If already logged in → go to dashboard (or admin panel).
export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const data = await getCurrentUserData(user.uid);
    if (data?.isAdmin) {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  });
}

// ── Friendly Firebase Error Messages ────────────────────────
// Turns Firebase error codes into plain English
export function friendlyAuthError(error) {
  const messages = {
    'auth/email-already-in-use':    'This email is already registered.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password. Please try again.',
    'auth/invalid-credential':      'Invalid email or password.',
    'auth/too-many-requests':       'Too many attempts. Please wait a moment.',
    'auth/network-request-failed':  'Network error. Check your connection.'
  };
  return messages[error.code] || 'Something went wrong. Please try again.';
}
