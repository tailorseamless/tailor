import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type Auth,
  type User,
} from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

const configured = Boolean(config.apiKey && config.authDomain && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
/** The forced token fetch in progress, if any. */
let refreshing: Promise<string> | null = null;

/** The initialised Firebase app (push messaging needs it too). */
export function firebaseApp(): FirebaseApp {
  getAuthOrThrow();
  return app as FirebaseApp;
}

function getAuthOrThrow(): Auth {
  if (!configured) throw new Error("Sign-in is not set up yet. Add the VITE_FIREBASE_* values to client/.env.");
  if (!auth) {
    app = initializeApp(config);
    auth = getAuth(app);
  }
  return auth;
}

function continueUrl(): string {
  return `${window.location.origin}/sign-in`;
}

/** The only place the app touches Firebase Auth. Everything else asks this object. */
export const authClient = {
  configured,

  currentUser(): User | null {
    return configured ? getAuthOrThrow().currentUser : null;
  },

  /** Fires with the signed-in user (or null) now and whenever the token changes. */
  onChange(listener: (user: User | null) => void): () => void {
    if (!configured) {
      listener(null);
      return () => {};
    }
    return onIdTokenChanged(getAuthOrThrow(), listener);
  },

  /**
   * The current token. Firebase renews it by itself shortly before it expires; `forceRefresh` fetches a new one now
   * (the API said ours is too old). Calls that ask at the same moment share one fetch instead of one each.
   */
  async token(forceRefresh = false): Promise<string | null> {
    const user = this.currentUser();
    if (!user) return null;
    if (!forceRefresh) return user.getIdToken(false);
    refreshing ??= user.getIdToken(true).finally(() => {
      refreshing = null;
    });
    return refreshing;
  },

  async signIn(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(getAuthOrThrow(), email, password);
    return cred.user;
  },

  async signUp(email: string, password: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(getAuthOrThrow(), email, password);
    await sendEmailVerification(cred.user, { url: continueUrl() });
    return cred.user;
  },

  async signInWithGoogle(): Promise<User> {
    const cred = await signInWithPopup(getAuthOrThrow(), new GoogleAuthProvider());
    return cred.user;
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(getAuthOrThrow(), email, { url: continueUrl() });
  },

  async resendVerification(): Promise<void> {
    const user = this.currentUser();
    if (user) await sendEmailVerification(user, { url: continueUrl() });
  },

  /**
   * Makes the token agree with the user. On every page load Firebase re-reads the user, so `emailVerified` turns true
   * as soon as the link is clicked (even in another tab or app), but the token saved on the device keeps saying
   * `email_verified: false` for up to an hour. The API reads the token, so it would refuse to create the business
   * while the app shows the form. Fetches a new token only when the two disagree; otherwise costs no network call.
   */
  async syncVerifiedToken(user: User): Promise<void> {
    if (!user.emailVerified) return;
    const { claims } = await user.getIdTokenResult();
    if (claims.email_verified !== true) await this.token(true);
  },

  /** Re-reads the user from Firebase (after they click the verification link) and refreshes the token. */
  async reload(): Promise<User | null> {
    const user = this.currentUser();
    if (!user) return null;
    await user.reload();
    await user.getIdToken(true);
    return getAuthOrThrow().currentUser;
  },

  async signOut(): Promise<void> {
    if (configured) await fbSignOut(getAuthOrThrow());
  },
};

/** Firebase's error codes, in words. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "That email and password don't match.",
    "auth/wrong-password": "That email and password don't match.",
    "auth/user-not-found": "That email and password don't match.",
    "auth/email-already-in-use": "There's already an account with that email. Sign in instead.",
    "auth/weak-password": "Use at least 8 characters for your password.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/too-many-requests": "Too many tries. Wait a few minutes, then try again.",
    "auth/network-request-failed": "You seem to be offline. Check your connection.",
    "auth/popup-closed-by-user": "The Google window was closed before you finished.",
    "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups and try again.",
  };
  if (messages[code]) return messages[code];
  return err instanceof Error && err.message ? err.message : "Couldn't sign you in. Please try again.";
}
