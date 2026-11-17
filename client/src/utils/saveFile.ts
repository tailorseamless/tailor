/** Hands a downloaded file to the browser: saved, or opened in a new tab for a PDF. */
export function saveFile(blob: Blob, filename: string, open = false): void {
  const url = URL.createObjectURL(blob);
  if (open) {
    window.open(url, "_blank", "noopener");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
