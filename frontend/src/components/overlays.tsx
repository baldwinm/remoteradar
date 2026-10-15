import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { dismissToast, useLayerElement, useSiteElement, useToastMessage } from '../lib/chrome';
import Icon from './Icon';

/* Sheets (phones), popovers (desktop) and the toast. Sheets render in the fixed layer above the
   page; popovers render inside the page so they scroll with the button that opened them. */

/**
 * Keeps something mounted long enough to animate out. `shown` turns true a frame after mounting,
 * so the opening transition runs, and `mounted` stays true for `ms` after closing.
 */
export function usePresence(open: boolean, ms = 450) {
  const [kept, setKept] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      let second = 0;
      // Two frames, so the closed state paints before the opening transition starts.
      const first = requestAnimationFrame(() => {
        setKept(true);
        second = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    const timer = window.setTimeout(() => {
      setKept(false);
      setEntered(false);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [open, ms]);

  return { mounted: open || kept, shown: open && entered };
}

let locks = 0;

/** While a sheet or the search palette is open, the page behind it doesn't scroll. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    document.documentElement.classList.add('is-locked');
    return () => {
      locks -= 1;
      if (locks === 0) document.documentElement.classList.remove('is-locked');
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into a dialog when it opens, keeps Tab inside it, closes it on Escape, and puts focus
 * back on whatever opened it.
 */
export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    const target = initialFocus?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
    if (target && !node?.contains(document.activeElement)) target.focus({ preventScroll: true });

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null || item === document.activeElement,
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Only hand focus back if it's still inside the dialog (or lost to the body).
      const current = document.activeElement;
      if (opener?.isConnected && (!current || current === document.body || node?.contains(current))) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [active, ref, initialFocus]);
}

/* ---------- Sheets ---------- */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Read out by screen readers; usually the sheet's title. */
  label: string;
  /** Fills the screen (search) instead of rising from the bottom. */
  full?: boolean;
  children: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
}

/** A panel that rises from the bottom of the screen on phones. Drag it down to close. */
export function Sheet({ open, onClose, label, full = false, children, initialFocus }: SheetProps) {
  const layer = useLayerElement();
  const { mounted, shown } = usePresence(open);
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useDialogFocus(panel, open && mounted, onClose, initialFocus);
  const drag = useSheetDrag(onClose, !full);

  if (!layer || !mounted) return null;
  return createPortal(
    <div className={`sheet${full ? ' full' : ''}${shown ? ' is-open' : ''}`}>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet-panel" role="dialog" aria-modal="true" aria-label={label} ref={panel} {...drag}>
        {!full && <div className="sheet-grab" aria-hidden="true" />}
        <div className="sheet-content">{children}</div>
      </div>
    </div>,
    layer,
  );
}

export function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="sheet-head">
      <h3>{title}</h3>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
        <Icon name="x" size={22} />
      </button>
    </div>
  );
}

/** Pulling a sheet down by its top edge (grab bar or title) closes it, like a native sheet. */
function useSheetDrag(onClose: () => void, enabled: boolean) {
  const start = useRef<{ y: number; t: number; id: number } | null>(null);
  const last = useRef(0);
  if (!enabled) return {};

  function reset(node: HTMLDivElement) {
    node.style.transition = '';
    node.style.transform = '';
  }

  return {
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      const target = event.target as HTMLElement;
      if (event.pointerType === 'mouse' || !target.closest('.sheet-grab, .sheet-head')) return;
      if (target.closest('button, a, input')) return;
      start.current = { y: event.clientY, t: performance.now(), id: event.pointerId };
      last.current = 0;
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      if (!start.current || event.pointerId !== start.current.id) return;
      const dy = Math.max(0, event.clientY - start.current.y);
      last.current = dy;
      event.currentTarget.style.transition = 'none';
      event.currentTarget.style.transform = `translateY(${dy}px)`;
    },
    onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      const began = start.current;
      start.current = null;
      if (!began || event.pointerId !== began.id) return;
      const dy = last.current;
      const speed = dy / Math.max(1, performance.now() - began.t);
      reset(event.currentTarget);
      if (dy > 90 || (dy > 24 && speed > 0.5)) onClose();
    },
    onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
      start.current = null;
      reset(event.currentTarget);
    },
  };
}

/* ---------- Popovers ---------- */

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  label: string;
  align?: 'left' | 'right';
  /** "menu-pop" for lists of choices, "pop" for the larger dates picker. */
  className?: string;
  /** Header menus close when the page scrolls, since the header stays put and they wouldn't. */
  closeOnScroll?: boolean;
  children: ReactNode;
}

/** A small panel that drops from a button on desktop. */
export function Popover({
  open,
  onClose,
  anchor,
  label,
  align = 'left',
  className = 'menu-pop',
  closeOnScroll = false,
  children,
}: PopoverProps) {
  const site = useSiteElement();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Placed before the first paint, relative to the page, so it scrolls with its button.
  useLayoutEffect(() => {
    if (!open || !site) return;
    function measure() {
      const node = ref.current;
      const trigger = anchor.current;
      if (!node || !trigger || !site) return;
      const sr = site.getBoundingClientRect();
      const r = trigger.getBoundingClientRect();
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      let left = (align === 'right' ? r.right : r.left) - sr.left - (align === 'right' ? w : 0);
      left = Math.min(Math.max(left, 16), site.offsetWidth - w - 16);
      let top = r.bottom - sr.top + 8;
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      if (h > below && above > below) top = r.top - sr.top - h - 8;
      node.style.left = `${Math.round(left)}px`;
      node.style.top = `${Math.round(top)}px`;
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, site, anchor, align]);

  useEffect(() => {
    if (!open) return;
    // Focus moves into the panel, so Tab walks its items next.
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    const outside = (target: EventTarget | null) =>
      !(target instanceof Node) || !(ref.current?.contains(target) || anchor.current?.contains(target));
    function onPointer(event: PointerEvent) {
      if (outside(event.target)) closeRef.current();
    }
    function onFocus(event: FocusEvent) {
      if (outside(event.target)) closeRef.current();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      closeRef.current();
      anchor.current?.focus({ preventScroll: true });
    }
    function onScroll() {
      closeRef.current();
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onKey);
    if (closeOnScroll) window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [open, anchor, closeOnScroll]);

  if (!open || !site) return null;
  return createPortal(
    <div
      ref={ref}
      className={className}
      role="dialog"
      aria-label={label}
    >
      {children}
    </div>,
    site,
  );
}

/* ---------- Toast ---------- */

export function ToastHost() {
  const message = useToastMessage();
  return (
    <div className={`toast${message?.on ? ' is-on' : ''}`} role="status" aria-live="polite">
      {message && (
        <>
          <span>{message.text}</span>
          {message.undo && (
            <button
              type="button"
              className="toast-act"
              tabIndex={message.on ? 0 : -1}
              onClick={() => {
                message.undo?.();
                dismissToast(message.id);
              }}
            >
              Undo
            </button>
          )}
        </>
      )}
    </div>
  );
}
