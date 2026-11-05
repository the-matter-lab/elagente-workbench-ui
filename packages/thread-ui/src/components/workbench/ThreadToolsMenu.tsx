import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Folder, Star } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { CopyButton } from '../copy/CopyButton';
import { splitPath } from '../copy/PathChip';
import { useMenuKeyboard } from '../menu/useMenuKeyboard';
import { homeRelativePath, isCopyableWorkspacePath } from '../WorkbenchPath';

/** The thread tools: a dropdown under their toggle. Its head is the workspace
    path (with copy) and the thread it belongs to, beside that thread's shortcut
    star; below are the host's thread actions (share, permissions, download,
    port mappings), then the thread's panels (agents, automations, plugins,
    split), each an icon with its accessible name as the label.

    It stays mounted and only hides when closed: a control in it keeps the
    window it opened (those live in portals) and its state, like the phone's
    More sheet. */
export function ThreadToolsMenu({ id, open, anchorRef, path, title, favorite, favoriteBusy, onToggleFavorite, onClose, children, panels, showHeader = true, label }: {
  id: string;
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  path: string;
  title: string;
  favorite: boolean;
  favoriteBusy?: boolean;
  /** Omitted when the host has no shortcuts: no star. */
  onToggleFavorite?: (() => void) | undefined;
  onClose: (restoreFocus: boolean) => void;
  children: ReactNode;
  panels?: ReactNode;
  /** Compact entry menu; the existing host action menu keeps its heading. */
  showHeader?: boolean;
  label?: string;
}) {
  useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  // Found once its toggle is there, then kept: a portal that changed its host
  // would remount the controls. A host may mount the toggle after the menu (once
  // its thread loads); placed in the body before then, the menu would lose the
  // shell's styles and sit in the page flow under the workbench.
  const [host, setHost] = useState<Element | null>(null);
  useLayoutEffect(() => {
    if (host || !anchorRef.current) return;
    setHost(anchorRef.current.closest('.thread-ui-shell') ?? document.body);
  });
  const close = useRef(onClose);
  close.current = onClose;
  // Keyboard once it is placed and rendered: focus moves in, arrows move, Esc closes.
  useMenuKeyboard(menuRef, open && place !== null, (restore) => close.current(restore), 'button:not([disabled]), a[href]');

  useLayoutEffect(() => {
    // Closed, it keeps its place: windows its controls opened (the split picker)
    // stay anchored to them, even when they re-measure on a scroll.
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      // Right-aligned with its toggle, but never past either edge of the screen.
      const width = menuRef.current?.offsetWidth ?? 304;
      const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
      setPlace({ top: anchor.bottom + 6, left });
    };
    update();
    // It belongs to its toggle: a press outside closes it, a resize moves it.
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      // A window an action opened lives in a portal of its own; leave it alone.
      if (target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]')) return;
      close.current(false);
    };
    window.addEventListener('resize', update);
    document.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('resize', update); document.removeEventListener('pointerdown', outside, true); };
  }, [open, anchorRef]);

  if (!host) return null;
  const shown = open && place !== null;
  return createPortal(
    <div ref={menuRef} id={id} role="menu" aria-label={label ?? translate('workbench.threadTools')} className={`matter-thread-tools-menu${showHeader ? '' : ' is-compact'}`}
      data-open={shown || undefined} aria-hidden={!shown} inert={!shown}
      style={{ top: place?.top ?? 0, left: place?.left ?? 0 }}
      onClick={(event) => {
        // An action opens its window; the menu steps aside. The head's controls keep it open.
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.matter-thread-tools-items, .matter-thread-tools-panels') && target.closest('button, a')) window.setTimeout(() => close.current(false), 0);
      }}>
      {showHeader && <div className="matter-thread-tools-head">
        {/* ElAgente: a host without a filesystem path (a scientific Agent's sandbox) shows no path chip. */}
        {isCopyableWorkspacePath(path) ? <div className="matter-thread-tools-path" title={path}>
          <Folder aria-hidden="true" />
          {/* Shortened in the middle: the start and the last folder stay. */}
          <span className="matter-thread-tools-path-head">{splitPath(homeRelativePath(path)).head}</span>
          <span className="matter-thread-tools-path-tail">{splitPath(homeRelativePath(path)).tail}</span>
          <CopyButton value={path} label={translate('common.copyPath')} className="matter-thread-tools-copy" />
        </div> : null}
        {onToggleFavorite ? <button type="button" className="matter-thread-tools-star" aria-pressed={favorite} disabled={favoriteBusy}
          aria-label={favorite ? translate('workbench.removeShortcut') : translate('workbench.addShortcut')}
          title={favorite ? translate('workbench.removeShortcut') : translate('workbench.addShortcut')}
          onClick={onToggleFavorite}>
          <Star data-icon="shortcut" fill={favorite ? 'currentColor' : 'none'} />
        </button> : null}
        <div className="matter-thread-tools-title" title={title}>{title}</div>
      </div>}
      <div className="matter-thread-tools-items">{children}</div>
      {panels ? <div className="matter-thread-tools-panels">{panels}</div> : null}
    </div>,
    host,
  );
}
