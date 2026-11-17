// Applies the saved theme before first paint, so there is no flash of the wrong colours.
// An external file because the CSP forbids inline scripts (Frontend Guide §24).
(function () {
  var theme = "system";
  try {
    theme = localStorage.getItem("tf-theme") || "system";
  } catch {
    /* storage blocked: follow the system */
  }
  var dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();
