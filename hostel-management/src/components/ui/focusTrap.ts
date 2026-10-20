// Focus-management helpers for modal dialogs. The decision logic is pure so it
// can be unit-tested without a DOM (tests/ui/focusTrap.test.mjs).

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Where Tab / Shift+Tab should go inside a dialog.
 * Returns an index into the focusable list, -1 to focus the dialog container
 * itself (no focusable controls), or null to let the browser move focus
 * normally (focus is not at either edge).
 */
export function nextTrapIndex(count: number, currentIndex: number, backwards: boolean): number | null {
  if (count === 0) return -1;
  if (currentIndex === -1) return backwards ? count - 1 : 0;
  if (backwards && currentIndex === 0) return count - 1;
  if (!backwards && currentIndex === count - 1) return 0;
  return null;
}

export interface FocusCandidate {
  isConnected: boolean;
  hasAttribute?: (name: string) => boolean;
  focus: (options?: FocusOptions) => void;
}

/** First candidate that is still in the document and not disabled/hidden. */
export function pickRestoreTarget<T extends FocusCandidate>(candidates: Array<T | null | undefined>): T | null {
  for (const candidate of candidates) {
    if (!candidate || !candidate.isConnected) continue;
    if (candidate.hasAttribute?.('disabled') || candidate.hasAttribute?.('aria-hidden')) continue;
    return candidate;
  }
  return null;
}

/**
 * Restore focus only if the user has not deliberately moved it elsewhere:
 * focus is on nothing / <body>, or on an element that no longer exists
 * (the dialog that just closed).
 */
export function shouldRestoreFocus(active: { isConnected: boolean } | null, body: unknown): boolean {
  return !active || active === body || !active.isConnected;
}
