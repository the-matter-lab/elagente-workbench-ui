/** Copy raw preview text, including empty files, with a fallback for insecure
 * pages or browsers that deny the asynchronous clipboard API. */
export async function copyWorkspacePreviewContents(content: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch { /* A denied clipboard can still allow a user-initiated copy. */ }

  if (typeof document === 'undefined' || !document.body) return false;
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
  const field = document.createElement('textarea');
  field.value = content;
  field.setAttribute('readonly', '');
  Object.assign(field.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
  try {
    document.body.append(field);
    field.focus({ preventScroll: true });
    field.select();
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    field.remove();
    active?.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
  }
}
