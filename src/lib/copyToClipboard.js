function clipboardHost(hostWindow) {
  if (hostWindow?.navigator || hostWindow?.document) return hostWindow;
  if (typeof window !== "undefined") return window;
  return null;
}

export async function copyRichText(plain, html, hostWindow) {
  if (!plain) return false;
  const host = clipboardHost(hostWindow);
  const nav = host?.navigator;
  const ClipItem = host?.ClipboardItem || (typeof ClipboardItem !== "undefined" ? ClipboardItem : null);
  try {
    if (nav?.clipboard?.write && ClipItem) {
      await nav.clipboard.write([
        new ClipItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html || plain], { type: "text/html" }),
        }),
      ]);
      return true;
    }
  } catch {
    // Fall through to plain text when the page cannot write both formats.
  }
  return copyToClipboard(plain, hostWindow);
}

export async function copyToClipboard(text, hostWindow) {
  if (!text) return false;
  const host = clipboardHost(hostWindow);
  const nav = host?.navigator;
  const doc = host?.document;
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand.
  }
  try {
    if (!doc?.body) return false;
    const textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    doc.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = doc.execCommand("copy");
    doc.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
