const KEY = "ts-session-ended";

/** Remembers that the person was signed out because their session ran out, so the sign-in page can say so. */
export function noteSessionEnded(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage can be blocked; the sign-in page just won't have the explanation.
  }
}

export function sessionEndedNoted(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSessionEnded(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
