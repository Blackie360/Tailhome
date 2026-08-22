export async function copyText(
  text: string,
  fallbackNode: HTMLElement | null
): Promise<"copied" | "manual"> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    const selection = window.getSelection();
    if (selection && fallbackNode) {
      const range = document.createRange();
      range.selectNodeContents(fallbackNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return "manual";
  }
}
