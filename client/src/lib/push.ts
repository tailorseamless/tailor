import { authClient, firebaseApp } from "./firebase";

/**
 * Browser push through Firebase Cloud Messaging. The server sends DATA-ONLY messages;
 * `public/sw.js` turns them into notifications. Messaging loads only when someone turns push on.
 */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const TOKEN_KEY = "tf-push-token";

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: push still works, we just forget the token */
  }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // In production pwa.ts has registered it already; in development this registers it.
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export const pushClient = {
  /** This browser can receive pushes and the app has a key to ask for them. */
  async supported(): Promise<boolean> {
    if (!VAPID_KEY || !authClient.configured) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
    const { isSupported } = await import("firebase/messaging");
    return isSupported();
  },

  permission(): NotificationPermission {
    return "Notification" in window ? Notification.permission : "denied";
  },

  /** The token this device registered with the server, if push is on here. */
  token: storedToken,

  /** Asks the person, then returns this device's FCM token (null if they said no). */
  async enable(): Promise<string | null> {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const { getMessaging, getToken } = await import("firebase/messaging");
    const token = await getToken(getMessaging(firebaseApp()), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await registration(),
    });
    storeToken(token);
    return token;
  },

  /** Stops pushes to this browser. Returns the old token so the server can forget it too. */
  async disable(): Promise<string | null> {
    const token = storedToken();
    storeToken(null);
    try {
      const { deleteToken, getMessaging } = await import("firebase/messaging");
      await deleteToken(getMessaging(firebaseApp()));
    } catch {
      /* already gone */
    }
    return token;
  },
};
