import { saveToFirestore, loadFromFirestore, signInWithGoogle, signOutFirebase, registerWithEmail, signInWithEmail, forgotPassword, checkGoogleRedirectResult } from './firebase.js';

// Hubungkan fungsi Firestore & Auth ke window agar bisa dipanggil oleh script utama
window._firestoreSave         = saveToFirestore;
window._firestoreLoad         = loadFromFirestore;
window._googleSignIn          = signInWithGoogle;
window._checkGoogleRedirect   = checkGoogleRedirectResult;
window._firebaseSignOut       = signOutFirebase;
window._emailRegister         = registerWithEmail;
window._emailSignIn           = signInWithEmail;
window._forgotPassword        = forgotPassword;
