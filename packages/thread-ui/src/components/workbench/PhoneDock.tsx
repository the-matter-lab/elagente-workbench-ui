import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronsUpDown, Ellipsis, FolderOpen, MessageSquare, Terminal } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import type { WorkbenchThread } from '../MatterWorkbench';
import { threadGroupActivity } from '../GroupedThreadTabs';
import type { WorkbenchPane, WorkbenchPaneSwitch } from './paneSwitch';
import { useModalFocus } from '../menu/useModalFocus';
import { StatusMark } from '../StatusMark';

export type PhonePane = 'chat' | 'shell' | 'files';

/** The phone's bottom navigation row: the current thread (tap, or swipe up on
    the panel, for the thread sheet), the chat / terminal / files views and a
    More sheet for everything the top bar used to hold. */
export function PhoneDock({
  title, thread, paneSwitch = null, pane, terminalEnabled, onPane, onOpenThreads, onOpenMore, moreOpen, threadsOpen, filesDisabled = false,
}: {
  title: string;
  thread: WorkbenchThread | undefined;
  /** A split's two conversations: pinned side by side, one tap switches. */
  paneSwitch?: WorkbenchPaneSwitch | null;
  pane: PhonePane;
  terminalEnabled: boolean;
  filesDisabled?: boolean;
  onPane: (pane: PhonePane) => void;
  onOpenThreads: () => void;
  onOpenMore: () => void;
  moreOpen: boolean;
  threadsOpen: boolean;
}) {
  useI18n();
  const activity = thread ? threadGroupActivity(thread) : null;
  return (
    <nav className="matter-phone-dock" aria-label={translate('workbench.phoneDock')}>
      {paneSwitch ? <PinnedThreads value={paneSwitch} threadsOpen={threadsOpen} onOpenThreads={onOpenThreads} /> : <button
        type="button"
        className="matter-phone-thread"
        aria-haspopup="dialog"
        aria-expanded={threadsOpen}
        aria-label={translate('workbench.phoneDockThread', { title })}
        onClick={onOpenThreads}
      >
        <span className="matter-status-dot" data-status={activity?.status ?? 'idle'} role="img" aria-label={activity?.label ?? ''} />
        <span className="matter-phone-thread-title">{title}</span>
        <ChevronsUpDown aria-hidden="true" />
      </button>}
      <div className="matter-phone-panes" role="group" aria-label={translate('workbench.phoneDockPanes')}>
        <button type="button" aria-label={translate('workbench.chat')} aria-pressed={pane === 'chat'} onClick={() => onPane('chat')}><MessageSquare data-icon="chat" /></button>
        <button type="button" aria-label={translate('workbench.toggleExplorer')} aria-pressed={pane === 'files'} disabled={filesDisabled} onClick={() => onPane('files')}><FolderOpen data-icon="explorer" /></button>
        {terminalEnabled && <button type="button" aria-label={translate('workbench.terminal')} aria-pressed={pane === 'shell'} onClick={() => onPane('shell')}><Terminal data-icon="terminal" /></button>}
      </div>
      <button type="button" className="matter-phone-more" aria-label={translate('workbench.moreActions')} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={onOpenMore}><Ellipsis data-icon="more" /></button>
    </nav>
  );
}

/** A split pins two conversations to the dock. The one not shown comes forward
    with a tap; tapping the shown one opens the thread list, like the single
    thread button. The dock takes over both panes' switches. */
function PinnedThreads({ value, threadsOpen, onOpenThreads }: {
  value: WorkbenchPaneSwitch;
  threadsOpen: boolean;
  onOpenThreads: () => void;
}) {
  const { claim } = value;
  useEffect(() => {
    const releasePrimary = claim('primary');
    const releaseReference = claim('reference');
    return () => { releasePrimary(); releaseReference(); };
  }, [claim]);
  return (
    <div className="matter-phone-pins" role="group" aria-label={translate('workbench.pinnedThreads')}>
      {(['primary', 'reference'] as WorkbenchPane[]).map(side => {
        const shown = value.active === side;
        return (
          <button key={side} type="button" className="matter-phone-pin" data-side={side} aria-pressed={shown}
            {...(shown ? { 'aria-haspopup': 'dialog' as const, 'aria-expanded': threadsOpen } : {})}
            aria-label={shown
              ? translate('workbench.phoneDockThread', { title: value.titles[side] })
              : translate(side === 'primary' ? 'workbench.showLeftConversation' : 'workbench.showRightConversation', { value1: value.titles[side] })}
            title={value.titles[side]}
            onClick={() => (shown ? onOpenThreads() : value.select(side))}>
            {value.marks?.[side] ? <StatusMark status={value.marks[side]!} /> : null}
            <span className="matter-phone-pin-title">{value.titles[side]}</span>
            {shown ? <ChevronsUpDown aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A bottom sheet that stays mounted while closed, so host controls inside it
    (settings, automations, split picker) keep their dialogs open after it hides.
    Dragging it down from the top of its list closes it. */
export function PhoneSheet({ open, label, onClose, children, footer }: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useI18n();
  const sheet = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>('[data-sheet-autofocus], button, a')?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    const node = sheet.current;
    // A height held while agent threads opened lasts until the sheet closes.
    if (!open) { if (node) node.style.height = ''; return; }
    if (!node) return;
    node.style.transform = '';
    const body = node.querySelector<HTMLElement>('.matter-phone-sheet-body');
    let start: { x: number; y: number; time: number } | null = null;
    let offset = 0;
    const begin = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      start = null;
      // Inside the list a pull only drags the sheet once the list is at its top.
      if (event.touches.length !== 1 || !target || target.closest('input, textarea, [contenteditable="true"]')) return;
      if (body?.contains(target) && body.scrollTop > 0) return;
      start = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY, time: event.timeStamp };
      offset = 0;
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      // A held row being dragged into place owns the finger; the sheet stays put.
      if (!node.hasAttribute('data-dragging') && node.querySelector('[data-reordering], [data-pressing]')) { start = null; return; }
      const dx = event.touches[0]!.clientX - start.x, dy = event.touches[0]!.clientY - start.y;
      if (!node.hasAttribute('data-dragging')) {
        if (Math.abs(dx) > 10 || dy < -10) { start = null; return; }
        if (dy < 10 || dy < Math.abs(dx) * 1.2 || (body && body.scrollTop > 0)) return;
        node.setAttribute('data-dragging', '');
      }
      event.preventDefault();
      offset = Math.max(0, dy);
      node.style.transform = `translateY(${offset}px)`;
    };
    const end = (event: TouchEvent) => {
      const from = start;
      start = null;
      if (!from || !node.hasAttribute('data-dragging')) return;
      node.removeAttribute('data-dragging');
      const fast = offset / Math.max(1, event.timeStamp - from.time) > 0.6;
      if (offset > Math.min(100, node.offsetHeight * 0.2) || (fast && offset > 24)) {
        // Slide on from where the finger left it.
        node.style.transform = 'translateY(105%)';
        close.current();
      } else node.style.transform = '';
    };
    node.addEventListener('touchstart', begin, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);
    return () => {
      node.removeEventListener('touchstart', begin);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    };
  }, [open]);
  // Keyboard focus moves into an open sheet, stays there and returns on close.
  useModalFocus(sheet, open, onClose);
  return (
    <>
      {open && <button type="button" className="matter-phone-sheet-scrim" aria-label={translate('workbench.closeSheet')} onClick={onClose} />}
      <section
        ref={sheet}
        className="matter-phone-sheet"
        role="dialog"
        aria-modal={open}
        aria-label={label}
        data-open={open || undefined}
        aria-hidden={!open}
        inert={!open}
        // Actions and modal dialog triggers hide the sheet (their dialogs live in
        // portals); popover triggers keep it, since their popovers anchor inside.
        onClick={event => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest('[data-sheet-keep]')) return;
          if (target?.closest('a[href], button:not([aria-expanded]), [data-slot="dialog-trigger"]')) window.setTimeout(onClose, 0);
        }}
      >
        <div className="matter-phone-sheet-grabber" aria-hidden="true" />
        <div className="matter-phone-sheet-body">{children}</div>
        {footer && <div className="matter-phone-sheet-footer">{footer}</div>}
      </section>
    </>
  );
}
