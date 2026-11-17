import { cert, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { env } from "../../config/env";

/**
 * The single Admin SDK initialisation (Firebase Guide §7).
 * With a service account → full admin; without → the project id alone, which is
 * enough to verify ID tokens against Google's public keys and nothing else.
 */
let app: App | undefined;
let auth: Auth | undefined;

function firebaseApp(): App {
  if (app) return app;
  // The Admin SDK reads the emulator host from the process environment.
  if (env.firebase.authEmulatorHost) process.env.FIREBASE_AUTH_EMULATOR_HOST = env.firebase.authEmulatorHost;

  const { serviceAccount, projectId } = env.firebase;
  app = serviceAccount ? initializeApp({ credential: cert(serviceAccount), projectId }) : initializeApp({ projectId });
  return app;
}

export function firebaseAuth(): Auth {
  auth ??= getAuth(firebaseApp());
  return auth;
}

let messaging: Messaging | undefined;

/** FCM. Needs the service account. */
export function firebaseMessaging(): Messaging {
  messaging ??= getMessaging(firebaseApp());
  return messaging;
}

/** Whether admin calls beyond token verification (createUser, deleteUser, custom tokens…) can work. */
export function firebaseAdminConfigured(): boolean {
  return env.firebase.serviceAccount !== null || env.firebase.authEmulatorHost !== null;
}
