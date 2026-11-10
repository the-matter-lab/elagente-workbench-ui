import { ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useMenuKeyboard } from '../menu/useMenuKeyboard';
import type { ViewerStyle } from './GraphMoleculeViewerCommands';

/** Use View's menu surface and rows, rather than an OS-owned select popup. */
export function GraphMoleculeRepresentationMenu({
  value,
  options,
  onChange,
}: {
  value: ViewerStyle;
  options: readonly ViewerStyle[];
  onChange: (value: ViewerStyle) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  // The controls scroll. Keep the popup outside that clipping panel, but inside
  // the figure so it inherits the theme and remains in an expanded dialog.
  const host = open
    ? (trigger.current?.closest('.molecule-figure') ??
      trigger.current?.closest('.thread-ui-shell') ??
      document.body)
    : null;
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setPlace(null);
    if (restoreFocus) trigger.current?.focus();
  }, []);
  const shown = open && place !== null;
  useMenuKeyboard(menu, shown, close);
  useEffect(() => {
    if (shown)
      menu.current
        ?.querySelector<HTMLElement>('[aria-checked="true"]')
        ?.focus();
  }, [shown, value]);

  useLayoutEffect(() => {
    if (!open || !host) return;
    const update = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor || !menu.current) return;
      const bounds = host.getBoundingClientRect();
      const leftEdge = Math.max(0, bounds.left) + 8;
      const rightEdge = Math.min(window.innerWidth, bounds.right) - 8;
      const topEdge = Math.max(0, bounds.top) + 8;
      const bottomEdge = Math.min(window.innerHeight, bounds.bottom) - 8;
      const width = Math.min(210, Math.max(0, rightEdge - leftEdge));
      const maxHeight = Math.max(0, bottomEdge - topEdge);
      const borderHeight =
        menu.current.offsetHeight - menu.current.clientHeight;
      const height = Math.min(
        menu.current.scrollHeight + borderHeight,
        maxHeight,
      );
      const preferredTop =
        anchor.top - height - 4 >= topEdge
          ? anchor.top - height - 4
          : anchor.bottom + 4;
      setPlace({
        left: Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)),
        top: Math.max(topEdge, Math.min(preferredTop, bottomEdge - height)),
        width,
        maxHeight,
      });
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target))
        close(false);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerdown', outside, true);
    };
  }, [open, host, close]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="molecule-representation-trigger"
        aria-label="Representation"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {value}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && host
        ? createPortal(
            <div
              className="molecule-view-menu molecule-representation-menu"
              style={{
                left: place?.left ?? 0,
                top: place?.top ?? 0,
                width: place?.width ?? 210,
                visibility: shown ? 'visible' : 'hidden',
              }}
            >
              <div
                ref={menu}
                id={id}
                role="menu"
                aria-label="Representation"
                style={{ maxHeight: place?.maxHeight }}
                onKeyDownCapture={(event) => {
                  // Tab leaves in the trigger's control order, not the portal's DOM order.
                  if (event.key === 'Tab') trigger.current?.focus();
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    tabIndex={-1}
                    aria-label={option}
                    aria-checked={value === option}
                    onClick={() => {
                      onChange(option);
                      close(true);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>,
            host,
          )
        : null}
    </>
  );
}
