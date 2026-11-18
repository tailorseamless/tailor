import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { buttonClass } from "../components/shared/Button";

/** Shown when a page crashes or its code can't load (often a new version was deployed). */
export function RouteError() {
  const error = useRouteError();
  const chunkFailed = error instanceof Error && /dynamically imported module|Failed to fetch/i.test(error.message);
  const title = isRouteErrorResponse(error) && error.status === 404 ? "Page not found" : "Something went wrong";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-fg">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-fg-muted">
        {chunkFailed
          ? "Tailor Seamless was updated, or you went offline. Reload to get the latest version."
          : "This screen hit a problem. Reloading usually fixes it."}
      </p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          className={buttonClass("primary")}
          onClick={() => window.location.reload()}
          data-cy="reload"
        >
          Reload
        </button>
        <a href="/" className={buttonClass("secondary")} data-cy="go-home">
          Go home
        </a>
      </div>
    </div>
  );
}
