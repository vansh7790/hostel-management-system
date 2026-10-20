import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { FOCUSABLE_SELECTOR, nextTrapIndex, pickRestoreTarget, shouldRestoreFocus } from './focusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
}

// Visible, enabled, tabbable controls inside the dialog, in DOM (tab) order.
const focusableIn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.getClientRects().length > 0);

// Page-level fallback when the element that opened the dialog no longer exists.
// <main> is focusable via tabIndex={-1} in DashboardLayout; auth pages have none.
const fallbackTarget = () => document.querySelector<HTMLElement>('main');

/**
 * Return focus to the trigger, or to <main> if the trigger is gone. If the
 * trigger is removed shortly afterwards (e.g. a list reloads), fall back to
 * <main> then — but only while focus would otherwise be lost to <body>, and
 * stop watching as soon as the user moves focus themselves.
 */
function restoreFocus(previous: HTMLElement | null) {
  const target = pickRestoreTarget([previous, fallbackTarget()]);
  if (!target) return;
  target.focus({ preventScroll: true });
  if (target !== previous || !previous) return;

  const check = () => {
    if (previous.isConnected && document.activeElement === previous) return;
    stop();
    if (!previous.isConnected && shouldRestoreFocus(document.activeElement, document.body)) {
      pickRestoreTarget([fallbackTarget()])?.focus({ preventScroll: true });
    }
  };
  const onFocusOut = () => window.setTimeout(check, 0);
  const observer = new MutationObserver(check);
  const stop = () => {
    observer.disconnect();
    previous.removeEventListener('focusout', onFocusOut);
  };
  observer.observe(document.body, { childList: true, subtree: true });
  previous.addEventListener('focusout', onFocusOut);
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Move keyboard focus into the dialog when it opens; restore it when it closes.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
    const firstField = dialogRef.current?.querySelector<HTMLElement>('input, select, textarea');
    (firstField || dialogRef.current)?.focus();
    return () => {
      // Only restore when focus would otherwise be lost (on <body> or a removed node);
      // never override a deliberate focus move made by the user.
      if (shouldRestoreFocus(document.activeElement, document.body)) restoreFocus(previouslyFocused);
    };
  }, [isOpen]);

  // Focus trap: Tab / Shift+Tab cycle within the dialog; focus that escapes is pulled back.
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (e.key !== 'Tab' || !dialog) return;
      const items = focusableIn(dialog);
      const active = document.activeElement as HTMLElement | null;
      const index = active && dialog.contains(active) ? items.indexOf(active) : -1;
      const next = nextTrapIndex(items.length, index, e.shiftKey);
      if (next === null) return;
      e.preventDefault();
      (next === -1 ? dialog : items[next]).focus();
    };
    const handleFocusIn = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && e.target instanceof Node && !dialog.contains(e.target)) {
        (focusableIn(dialog)[0] || dialog).focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('keydown', handleTab);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop: clicking outside the dialog closes it (callers may guard onClose while saving). */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} bg-white rounded-xl shadow-xl focus:outline-none
          animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
