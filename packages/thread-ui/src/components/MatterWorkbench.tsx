import { WorkbenchPanels, type WorkbenchPanelsOptions } from './workbench/WorkbenchPanels';
import { useWorkbenchToolPanel } from './workbench/toolPanel';
import { getLocale } from '../i18n';
import { translate, useI18n } from '../i18n';
import { Fragment, useEffect, useLayoutEffect, useMemo, useState, useRef, type ReactNode, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  Home,
  FolderOpen,
  Hand,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  PanelLeft,
  Search,
  SlidersHorizontal,
  Star,
  Terminal,
  X,
} from 'lucide-react';
import { useTabScrollEdges } from './useTabScrollEdges';
import { TabScrollButtons } from './TabScrollButtons';
import { WorkbenchContext } from './WorkbenchContext';
import { homeRelativePath, isCopyableWorkspacePath } from './WorkbenchPath';
import { PathChip } from './copy/PathChip';
import { ThreadToolsMenu } from './workbench/ThreadToolsMenu';
import { ThreadHeader } from './workbench/ThreadHeader';
import { createPortal } from 'react-dom';
import { StatusMark } from './StatusMark';
import { GroupedThreadTabs, groupThreads, threadGroupActivity } from './GroupedThreadTabs';
import { useThemeFeature } from './themeHooks';
import { PhoneDock, PhoneSheet, type PhonePane } from './workbench/PhoneDock';
import { PhoneDockContext } from './workbench/phoneDockContext';
import { ShortcutList } from './workbench/ShortcutList';
import { inOrder, useDragReorder, usePendingOrder } from './workbench/useDragReorder';
import type { WorkbenchPaneSwitch } from './workbench/paneSwitch';
import { useModalFocus } from './menu/useModalFocus';
import { ComposerSubscriptionUsage, visibleSubscriptionWindows } from './composer/ComposerSubscriptionUsage';
import type { AgentSubscriptionUsageDto } from '@remote-codex/shared';
import { useAppShellNav } from '../app-shell/AppShellNavContext';


const SIDEBAR_SECTIONS_KEY = 'pockymoe.sidebar-sections.v1';
const SIDEBAR_WIDTH_KEY = 'pockymoe.sidebar-width';
const SIDEBAR_MIN = 200, SIDEBAR_MAX = 420;
const clampSidebar = (width: number) => Math.round(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, width)));

/** Where a right-click opened a thread's menu, and how to end it. */
export interface ThreadMenuContext {
  x: number;
  y: number;
  /** Takes focus back when the menu closes from the keyboard. */
  returnFocus?: HTMLElement | undefined;
  onClose: () => void;
}

export interface WorkbenchThread {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  status: string;
  favorite: boolean;
  parentKey?: string;
  rootKey?: string;
  /** Harness id such as `codex` or `claude`; themes may show it as an avatar. */
  agent?: string;
  /** A shortcut's place in the account's own order; unordered ones follow by recency. */
  shortcutOrder?: number;
}
/** The latest notifications, those of a conversation's agent threads listed
    together under its root (titled), the rest alone. */
export function notificationGroups(notifications: WorkbenchNotification[]) {
  const groups: { key: string; title?: string; href?: string; items: WorkbenchNotification[] }[] = [];
  for (const n of [...notifications].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 10)) {
    const key = n.rootKey ?? n.threadKey ?? n.id;
    const group = groups.find(item => item.key === key);
    if (group) group.items.push(n);
    else groups.push({ key, items: [n] });
    const target = group ?? groups.at(-1)!;
    if (n.rootKey && n.rootTitle) { target.title = n.rootTitle; target.href = n.rootHref; }
  }
  return groups;
}

export interface WorkbenchNotification {
  id: string;
  title: string;
  href: string;
  occurredAt: string;
  summary?: string;
  /** The thread it is about, and for an agent thread its conversation's root:
      such notifications are listed under that conversation. */
  threadKey?: string;
  rootKey?: string;
  rootTitle?: string;
  rootHref?: string;
  /** How the turn ended: a completed one is marked like an unread thread. */
  status?: 'unread' | 'failed' | 'interrupted';
}
/** A plugin's thread panel in the workbench rail (it opens in the tools drawer). */
export interface WorkbenchToolPanel {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onToggle: () => void;
}
export interface MatterWorkbenchOptions {
  /** Host integration (ElAgente): its product name, an outer rail that replaces
      this one, and features the host cannot back. Omitted keeps upstream behavior. */
  brandName?: string;
  hideRail?: boolean;
  showShortcuts?: boolean;
  showNotifications?: boolean;
  showSearch?: boolean;
  searchLabel?: string;
  sidebarFooter?: ReactNode;
  renderNavigationHeader?: (input: { collapsed: boolean; closeNavigation: () => void }) => ReactNode;
  panels?: WorkbenchPanelsOptions;
  /** Opt-in thread toolbar. Lifecycle belongs to the host. */
  threadHeader?: {
    /** Desktop: replace the tab row with one 44px header. Search and collapsed
        sidebar navigation stay in this row; phone navigation is unchanged.
        Empty workspaces omit both rows. Defaults to false. */
    singleRow?: boolean;
    status: string;
    /** Optional hover/focus explanation for the lifecycle pill. */
    statusDescription?: string;
    tone: 'running' | 'stopped' | 'failed' | 'pending';
    /** Defaults to disabled unless running; controls remain visible. */
    toolsDisabled?: boolean;
    /** Opens the host's existing Tool Usage panel. */
    onOpenToolUsage?: () => void;
    /** Opens the existing conversation export dialog directly. When omitted,
        Save & export opens the existing host action menu. */
    onSaveExport?: () => void;
  };
  /** Move the existing settings control/dialog to this global host rail slot.
      Only the visible workbench should receive a target. */
  settingsPortalTargetId?: string;
  statusActions?: ReactNode;
  /** Subscription usage windows (5-hour, weekly); the phone dock shows them in its status bar. */
  subscriptionUsage?: AgentSubscriptionUsageDto | null;
  emptyWorkspace?: boolean;
  navigationReady?: boolean;
  harnessSessionId?: string | null;
  harnessSessionUrl?: string | null;
  threads: WorkbenchThread[];
  workspaceThreads?: WorkbenchThread[];
  /** Heading of the `workspaceThreads` section; hosts that scope it (to one
      Agent, say) name that scope. Defaults to "This workspace". */
  workspaceSectionLabel?: string | undefined;
  /** Threads that want the reader, for the running count and its sheet: running
      ones beyond `threads` (other workspaces and devices, threads never opened)
      and finished ones the reader opened before and has not read since. */
  activeThreads?: WorkbenchThread[];
  currentKey: string;
  favorite: boolean;
  favoriteBusy?: boolean;
  error?: string | null;
  workspacePath: string;
  activeView: 'chat' | 'shell';
  terminalEnabled: boolean;
  onViewChange: (view: 'chat' | 'shell') => void;
  toolPanels?: WorkbenchToolPanel[];
  onToggleFavorite: () => void;
  onNavigate: (href: string) => void;
  /** Warm a thread's detail before it is opened (a row is pressed, or it is a
      dock swipe away), so opening it shows the conversation at once. */
  onPrefetchThread?: (href: string) => void;
  /** Store a new shortcut order (thread keys, first to last). */
  onReorderShortcuts?: (keys: string[]) => void;
  /** Store a new order of this workspace's conversations (root thread keys,
      first to last); `workspaceThreads` should then arrive in it. Without it
      tabs and lists keep the host's order and cannot be dragged. */
  onReorderWorkspaceThreads?: ((rootKeys: string[]) => void) | undefined;
  /** Desktop tabs: the conversations the reader opened (roots with their agent
      threads, in tab order), each closable; without it tabs list this workspace. */
  openTabs?: WorkbenchThread[] | undefined;
  onCloseTab?: ((rootKey: string) => void) | undefined;
  onReorderOpenTabs?: ((rootKeys: string[]) => void) | undefined;
  onSearch: () => void;
  search?: ReactNode;
  searchOpen?: boolean;
  notifications: WorkbenchNotification[];
  unreadCount: number;
  onReadNotifications: () => void;
  /** A thread's menu: its ⋯ button in a row, or, with `context`, the same menu
      opened where the thread was right-clicked (a tab or a row). */
  renderThreadMenu?: (thread: WorkbenchThread, context?: ThreadMenuContext) => ReactNode;
}

export function MatterWorkbench({
  options: o,
  title,
  homeHref,
  settings,
  newThread,
  actions,
  threadMenu,
  connection,
  deviceMonitor,
  explorer,
  revealExplorer,
  children,
}: {
  options: MatterWorkbenchOptions;
  title: string;
  homeHref?: string | undefined;
  settings: ReactNode;
  newThread: ReactNode;
  actions: ReactNode;
  threadMenu: ReactNode;
  connection: ReactNode;
  deviceMonitor?: ReactNode;
  explorer: ReactNode;
  revealExplorer: number;
  children: ReactNode;
}) {
  useI18n();
  const [settingsTarget, setSettingsTarget] = useState<{ id: string; element: HTMLElement } | null>(null);
  useLayoutEffect(() => {
    const id = o.settingsPortalTargetId;
    if (!id) { setSettingsTarget(null); return; }
    const find = () => {
      const element = document.getElementById(id);
      if (!element) return false;
      setSettingsTarget(current => current?.id === id && current.element === element ? current : { id, element });
      return true;
    };
    // Layout effects run after all siblings commit, including a host slot that
    // follows this workbench in JSX. Also support a slot mounted asynchronously.
    if (find()) return;
    const observer = new MutationObserver(() => { if (find()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [o.settingsPortalTargetId]);
  const localSettings = o.settingsPortalTargetId || o.threadHeader ? null : settings;
  const brandName = o.brandName ?? 'Pockymoe';
  const showSearch = o.showSearch !== false;
  const searchLabel = o.searchLabel ?? translate("workbench.searchConversation");
  const listedTabs = o.workspaceThreads ?? o.threads.filter(thread => thread.key === o.currentKey);
  // Conversations keep the order the reader dragged them into, shown at once
  // while the host stores it. An agent thread stays with its root.
  const rootOfTab = (thread: WorkbenchThread) => thread.rootKey && thread.rootKey !== thread.key && listedTabs.some(tab => tab.key === thread.rootKey) ? thread.rootKey : thread.key;
  const [workspaceOrder, setPendingWorkspaceOrder] = usePendingOrder(groupThreads(listedTabs).map(group => group.root.key));
  const tabs = inOrder(listedTabs, rootOfTab, workspaceOrder);
  const reorderable = Boolean(o.onReorderWorkspaceThreads && o.workspaceThreads);
  const reorderWorkspace = useRef<(keys: string[]) => void>(() => undefined);
  reorderWorkspace.current = keys => { setPendingWorkspaceOrder(keys); o.onReorderWorkspaceThreads?.(keys); };
  const commitWorkspaceOrder = useMemo(() => (keys: string[]) => reorderWorkspace.current(keys), []);
  const tabsRef = useRef<HTMLElement>(null);
  // A mouse wheel scrolls the tab strip sideways, as in an editor; sideways
  // trackpad gestures keep their own scrolling, and the ends let the page have it.
  useEffect(() => {
    const strip = tabsRef.current;
    if (!strip) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const room = strip.scrollWidth - strip.clientWidth;
      if (room <= 0) return;
      const delta = event.deltaMode === 1 ? event.deltaY * 32 : event.deltaMode === 2 ? event.deltaY * strip.clientWidth : event.deltaY;
      const next = Math.max(0, Math.min(room, strip.scrollLeft + delta));
      if (next === strip.scrollLeft) return;
      event.preventDefault();
      strip.scrollLeft = next;
    };
    strip.addEventListener('wheel', wheel, { passive: false });
    return () => strip.removeEventListener('wheel', wheel);
  });
  // On the desktop the tabs are the open conversations, like an editor's files.
  const desktopTabs = typeof window !== 'undefined' && !window.matchMedia('(max-width: 639px)').matches;
  const editorTabs = desktopTabs && o.openTabs?.length ? o.openTabs : null;
  const rootOfOpen = (thread: WorkbenchThread) => thread.rootKey && thread.rootKey !== thread.key && (o.openTabs ?? []).some(tab => tab.key === thread.rootKey) ? thread.rootKey : thread.key;
  const [openOrder, setPendingOpenOrder] = usePendingOrder(groupThreads(o.openTabs ?? []).map(group => group.root.key));
  const tabStrip = editorTabs ? inOrder(editorTabs, rootOfOpen, openOrder) : tabs;
  const reorderOpen = useRef<(keys: string[]) => void>(() => undefined);
  reorderOpen.current = keys => { setPendingOpenOrder(keys); o.onReorderOpenTabs?.(keys); };
  const commitTabOrder = useMemo(() => (keys: string[]) => (editorTabsRef.current ? reorderOpen.current : reorderWorkspace.current)(keys), []);
  const editorTabsRef = useRef(Boolean(editorTabs));
  editorTabsRef.current = Boolean(editorTabs);
  useDragReorder(tabsRef, { axis: 'x', itemSelector: '.matter-thread-group', enabled: editorTabs ? Boolean(o.onReorderOpenTabs) : reorderable, onCommit: commitTabOrder });
  const tabScrollEdges = useTabScrollEdges(tabsRef);
  useEffect(() => {
    tabsRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [o.currentKey, tabs.length]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const change = () => setMobile(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  // A theme with phone drawer tools keeps the phone top bar to touch-sized
  // essentials and moves Home and Chat into the drawer; the device monitor stays.
  const drawerTools = useThemeFeature('workbench.phoneDrawerTools') && mobile;
  // One-handed phone layout: status-only top bar, navigation at the bottom.
  // A setting (Settings → Preferences), on by default; off keeps the classic phone bars.
  const shellNav = useAppShellNav();
  const dock = mobile && (shellNav?.phoneDock ?? true);
  const singleRowHeader = !mobile && Boolean(o.threadHeader?.singleRow);
  // Left-handed: the dock, the composer's buttons and the turn strip are mirrored.
  const leftHanded = dock && shellNav?.phoneHand === 'left';
  const openThreadMap = shellNav?.openThreadMap;
  const [threadsOpen, setThreadsOpen] = useState(false);
  // A phone split's pinned conversations, switched from the dock.
  const [paneSwitch, setPaneSwitch] = useState<WorkbenchPaneSwitch | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [runningOpen, setRunningOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A dock switched off and on (crossing 640px, or the setting) starts from the
    // focus as it is now, not from a stale typing state.
    if (!dock) { setTyping(false); return; }
    // The keyboard needs the room: hide the navigation row while a field has focus.
    const editing = () => {
      const target = document.activeElement;
      return target instanceof HTMLElement && !target.closest('.matter-phone-sheet, .matter-topbar')
        && target.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), [contenteditable]:not([contenteditable="false"])');
    };
    let timer = 0;
    setTyping(editing());
    const settle = () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', afterTap, true);
      setTyping(editing());
    };
    const afterTap = () => { window.clearTimeout(timer); timer = window.setTimeout(settle, 0); };
    const focusIn = () => { if (editing()) settle(); };
    // A tap moves focus on mousedown, before mouseup and click: bringing the row
    // back then would move the tapped control (Send, New terminal) from under the
    // finger. It returns once that tap has clicked, or shortly after a blur
    // without one (the keyboard's own close button).
    const focusOut = () => window.setTimeout(() => {
      if (editing()) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 400);
      document.addEventListener('click', afterTap, { capture: true, once: true });
    }, 0);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', afterTap, true);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
    };
  }, [dock]);
  const sidebarRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  // The open phone drawer is modal: focus moves to its close button, Tab stays
  // inside, Esc closes it and focus returns to the control that opened it.
  useModalFocus(sidebarRef, mobile && sidebarOpen, () => setSidebarOpen(false), '.matter-mobile-close');
  // An opener that has gone (the More sheet closes under the drawer) hands focus to More, or to the drawer toggle.
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpen = useRef(false);
  useEffect(() => {
    if (mobile && sidebarOpen) { drawerWasOpen.current = true; return; }
    if (!drawerWasOpen.current) return;
    drawerWasOpen.current = false;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && active.getClientRects().length && !active.closest('[inert]')) return;
    (dock ? rootRef.current?.querySelector<HTMLElement>('.matter-phone-more') : drawerToggleRef.current)?.focus({ preventScroll: true });
  }, [mobile, sidebarOpen, dock]);
  useEffect(() => {
    const root = rootRef.current, drawer = sidebarRef.current;
    if (!dock || !root || !drawer) return;
    // The workspace drawer follows a sideways drag: rightwards from the left part
    // of the conversation opens it, leftwards on it or on the dimmed page closes
    // it. Browsers give pages no way to reserve the screen edge from the system
    // back gesture, so the drag may start anywhere in the left 40%, not only at
    // the edge. The right side and the bottom panel keep their own gestures.
    let start: { x: number; y: number; time: number } | null = null;
    let dragging = false, offset = 0;
    const width = () => drawer.getBoundingClientRect().width || 270;
    const paint = (shown: number) => {
      drawer.style.transform = `translateX(${Math.round(shown - width())}px)`;
      if (scrimRef.current) scrimRef.current.style.opacity = String(Math.max(0, Math.min(1, shown / width())));
    };
    const reset = () => {
      drawer.removeAttribute('data-dragging');
      drawer.style.transform = '';
      if (scrimRef.current) { scrimRef.current.removeAttribute('data-dragging'); scrimRef.current.style.opacity = ''; }
    };
    const begin = (event: TouchEvent) => {
      start = null; dragging = false; offset = 0;
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || !target) return;
      const x = event.touches[0]!.clientX;
      if (sidebarOpen) {
        if (!target.closest('.matter-sidebar, .matter-sidebar-scrim')) return;
      } else {
        if (x > window.innerWidth * 0.4 || !target.closest('.matter-main')) return;
        if (target.closest('.thread-graph-composer-host, .file-ask-bar, .matter-phone-dock, .xterm, .terminal-panel, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [role="dialog"], [data-no-swipe]')) return;
        // A row that can still scroll back to its start keeps the swipe.
        for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
          if (node.scrollLeft > 0 && node.scrollWidth > node.clientWidth) return;
        }
      }
      start = { x, y: event.touches[0]!.clientY, time: event.timeStamp };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      const dx = event.touches[0]!.clientX - start.x, dy = event.touches[0]!.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { start = null; return; }
        // A long press before moving is a text selection, not a drag.
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3 || (sidebarOpen ? dx > 0 : dx < 0) || event.timeStamp - start.time > 450) return;
        if (window.getSelection()?.toString()) { start = null; return; }
        dragging = true;
        drawer.setAttribute('data-dragging', '');
        scrimRef.current?.setAttribute('data-dragging', '');
      }
      event.preventDefault();
      offset = dx;
      paint(sidebarOpen ? Math.max(0, width() + dx) : Math.min(width(), Math.max(0, dx)));
    };
    const end = (event: TouchEvent) => {
      const from = start;
      start = null;
      if (!from || !dragging) return;
      dragging = false;
      const fast = Math.abs(offset) / Math.max(1, event.timeStamp - from.time) > 0.5;
      const far = Math.abs(offset) > width() * 0.3;
      reset();
      if (sidebarOpen && offset < 0 && (far || fast)) setSidebarOpen(false);
      else if (!sidebarOpen && offset > 0 && (far || fast)) setSidebarOpen(true);
    };
    root.addEventListener('touchstart', begin, { passive: true });
    root.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);
    return () => {
      reset();
      root.removeEventListener('touchstart', begin);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', end);
      root.removeEventListener('touchcancel', end);
    };
  }, [dock, sidebarOpen]);
  useEffect(() => {
    const root = rootRef.current;
    if (!dock || !root) return;
    // Swiping up on the bottom panel (the composer or the dock) opens the thread
    // sheet. A prompt that can scroll keeps the gesture for itself.
    let start: { x: number; y: number } | null = null;
    const begin = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      start = null;
      if (event.touches.length !== 1 || !target?.closest('.thread-graph-composer-host, .matter-phone-dock')) return;
      if (target.closest('[role="menu"], [role="listbox"], [role="dialog"], .thread-jump-latest-cluster')) return;
      const scroller = target.closest<HTMLElement>('[role="textbox"], textarea');
      if (scroller && /auto|scroll/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight + 1) return;
      start = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
    };
    const end = (event: TouchEvent) => {
      const from = start;
      start = null;
      const touch = event.changedTouches[0];
      if (!from || !touch) return;
      const dx = touch.clientX - from.x, dy = touch.clientY - from.y;
      if (dy > -40 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
      if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) document.activeElement.blur();
      setMoreOpen(false);
      setThreadsOpen(true);
    };
    const cancel = () => { start = null; };
    root.addEventListener('touchstart', begin, { passive: true });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', cancel);
    return () => {
      root.removeEventListener('touchstart', begin);
      root.removeEventListener('touchend', end);
      root.removeEventListener('touchcancel', cancel);
    };
  }, [dock]);
  const toolPanel = useWorkbenchToolPanel();
  // With the bottom panel the conversation stays visible beside the terminal:
  // Chat is "pressed" unless a maximized terminal covers it.
  const chatCovered = Boolean(o.panels && o.activeView === 'shell' && toolPanel.maximized && !toolPanel.collapsed);
  // A compact workbench draws Files over the conversation: Chat closes it.
  const filesCoverChat = () => explorerOpen && (mobile || Boolean(rootRef.current?.querySelector('.workbench-panels.is-compact')));
  const showChat = () => {
    if (filesCoverChat()) setExplorerOpen(false);
    if (o.panels) {
      if (chatCovered) toolPanel.update({ maximized: false });
    } else o.onViewChange('chat');
  };
  const viewChange = useRef(o.onViewChange);
  viewChange.current = o.onViewChange;
  useEffect(() => {
    if (!o.terminalEnabled) return;
    // VS Code's Ctrl+` toggles the terminal, even while xterm has focus.
    const toggle = (event: KeyboardEvent) => {
      if (event.key !== '`' || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      viewChange.current('shell');
    };
    window.addEventListener('keydown', toggle, true);
    return () => window.removeEventListener('keydown', toggle, true);
  }, [o.terminalEnabled]);
  // Ctrl/⌘+F opens the conversation search instead of the browser's find; a
  // terminal or code editor keeps its own find.
  const searchKey = useRef({ open: o.onSearch, available: !o.emptyWorkspace, searchOpen: Boolean(o.searchOpen) });
  searchKey.current = { open: o.onSearch, available: !o.emptyWorkspace, searchOpen: Boolean(o.searchOpen) };
  const showSearchRef = useRef(showSearch);
  showSearchRef.current = showSearch || Boolean(o.search);
  useEffect(() => {
    const find = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'f') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.xterm, .monaco-editor, .cm-editor, [data-native-find]')) return;
      const { open, available, searchOpen } = searchKey.current;
      if (!showSearchRef.current) return;
      if (!available) return;
      event.preventDefault();
      const field = rootRef.current?.querySelector<HTMLInputElement>('.workbench-search.is-open input');
      if (searchOpen && field) { field.focus(); field.select(); } else open();
    };
    window.addEventListener('keydown', find, true);
    return () => window.removeEventListener('keydown', find, true);
  }, []);
  // On the desktop the sidebar opens with shortcuts and this workspace; recent
  // chats wait folded, since the tabs hold the recently opened ones. A phone's
  // drawer keeps its own defaults (shortcuts folded, recent chats open). Each
  // fold is remembered per form factor.
  const sectionsKey = `${SIDEBAR_SECTIONS_KEY}:${mobile ? 'phone' : 'desktop'}`;
  const sectionDefaults = mobile ? { shortcuts: false, workspace: true, recents: true } : { shortcuts: true, workspace: true, recents: false };
  const readSections = () => { try { return { ...sectionDefaults, ...JSON.parse(localStorage.getItem(sectionsKey) ?? '{}') }; } catch { return sectionDefaults; } };
  const [sections, setSections] = useState<{ shortcuts: boolean; workspace: boolean; recents: boolean }>(readSections);
  const [sectionsFor, setSectionsFor] = useState(sectionsKey);
  if (sectionsFor !== sectionsKey) { setSectionsFor(sectionsKey); setSections(readSections()); }
  const fold = (section: 'shortcuts' | 'workspace' | 'recents', open: boolean) => setSections(current => {
    const next = { ...current, [section]: open };
    try { localStorage.setItem(sectionsKey, JSON.stringify(next)); } catch { /* Folds still hold for this visit. */ }
    return next;
  });
  const shortcutsOpen = sections.shortcuts, workspaceOpen = sections.workspace, recentsOpen = sections.recents;
  const setShortcutsOpen = (open: boolean) => fold('shortcuts', open);
  const setWorkspaceOpen = (open: boolean) => fold('workspace', open);
  const setRecentsOpen = (open: boolean) => fold('recents', open);
  const [sheetRecentsOpen, setSheetRecentsOpen] = useState(true);
  // The desktop sidebar's width follows a drag on its edge, within bounds.
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(() => {
    try { const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)); return stored ? clampSidebar(stored) : null; } catch { return null; }
  });
  const sidebarDrag = useRef<{ x: number; width: number } | null>(null);
  const resizeSidebar = (width: number | null) => {
    const next = width === null ? null : clampSidebar(width);
    setSidebarWidth(next);
    try { if (next === null) localStorage.removeItem(SIDEBAR_WIDTH_KEY); else localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(next))); } catch { /* Optional preference. */ }
  };
  const workspaceListRef = useRef<HTMLDivElement>(null);
  const sheetListRef = useRef<HTMLDivElement>(null);
  const workspaceScroll = useMemo(() => ({ get current() { return workspaceListRef.current?.closest<HTMLElement>('.matter-sidebar-scroll') ?? null; } }), []);
  const sheetScroll = useMemo(() => ({ get current() { return sheetListRef.current?.closest<HTMLElement>('.matter-phone-sheet-body') ?? null; } }), []);
  useDragReorder(workspaceListRef, { axis: 'y', itemSelector: '.matter-thread-group-entry', enabled: reorderable && workspaceOpen && tabs.length > 1, onCommit: commitWorkspaceOrder, scrollRef: workspaceScroll });
  useDragReorder(sheetListRef, { axis: 'y', itemSelector: '.matter-thread-group-entry', enabled: reorderable && workspaceOpen && threadsOpen && tabs.length > 1, onCommit: commitWorkspaceOrder, scrollRef: sheetScroll });
  const [bellOpen, setBellOpen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const toolbarToggleRef = useRef<HTMLButtonElement>(null);
  const [legacyExplorerOpen, setLegacyExplorerOpen] = useState(false);
  const explorerOpen = o.panels ? o.panels.presentation.mode === 'files' : legacyExplorerOpen;
  const setExplorerOpen = (value: boolean | ((open: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(explorerOpen) : value;
    if (o.panels) o.panels.onPresentationChange({ mode: next ? 'files' : o.panels.presentation.referenceId ? 'thread' : 'focus' });
    else setLegacyExplorerOpen(next);
  };
  const [explorerWidth, setExplorerWidth] = useState(() => {
    try { return Math.max(260, Math.min(800, Number(localStorage.getItem('remote-codex.explorer-width')) || 360)); } catch { return 360; }
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeOrigin = useRef<{ x: number; width: number } | null>(null);
  const resizeExplorer = (width: number) => {
    const max = Math.max(260, (contentRef.current?.clientWidth ?? 1000) - 320);
    const next = Math.round(Math.max(260, Math.min(max, width)));
    setExplorerWidth(next);
    try { localStorage.setItem('remote-codex.explorer-width', String(next)); } catch { /* Optional preference. */ }
  };
  // A drawer opened by a swipe has no focused control inside it; Esc still closes it.
  useEffect(() => {
    if (!sidebarOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [sidebarOpen]);
  // On a phone, closing search hands focus back to More, where it was opened.
  const searchWasOpen = useRef(o.searchOpen);
  useEffect(() => {
    if (dock && searchWasOpen.current && !o.searchOpen) rootRef.current?.querySelector<HTMLElement>('.matter-phone-more')?.focus({ preventScroll: true });
    searchWasOpen.current = o.searchOpen;
  }, [dock, o.searchOpen]);
  // The current thread's row stays in sight in the workspace list, which scrolls on its own.
  useEffect(() => {
    sidebarRef.current?.querySelector('[data-testid="workspace-threads"] [aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [o.currentKey]);
  const [lastReveal, setLastReveal] = useState(revealExplorer);
  if (lastReveal !== revealExplorer) {
    setLastReveal(revealExplorer);
    if (revealExplorer > 0 && !o.panels) setLegacyExplorerOpen(true);
  }
  // Closing the open conversation's tab moves to its neighbour, as an editor does.
  const closeTab = (rootKey: string) => {
    const groups = groupThreads(tabStrip);
    const at = groups.findIndex(group => group.root.key === rootKey);
    const active = groups[at] && (groups[at]!.root.key === o.currentKey || groups[at]!.children.some(child => child.key === o.currentKey));
    if (active) {
      const neighbour = groups[at + 1] ?? groups[at - 1];
      if (neighbour) navigate(neighbour.root.href);
      else if (homeHref) navigate(homeHref);
    }
    o.onCloseTab?.(rootKey);
  };
  const navigate = (href: string) => {
    setSidebarOpen(false);
    setBellOpen(false);
    setThreadsOpen(false);
    setMoreOpen(false);
    o.onNavigate(href);
  };
  // Home stays inside the app: a full page load flashed the bare page and lost
  // its state. A modified or middle click keeps the browser's own behaviour.
  const goHome = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!homeHref || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(homeHref);
  };
  const pane: PhonePane = explorerOpen ? 'files' : o.activeView === 'shell' ? 'shell' : 'chat';
  const choosePane = (next: PhonePane) => {
    if (next === 'files') { setExplorerOpen(true); return; }
    if (explorerOpen) setExplorerOpen(false);
    // The host's view change toggles the terminal.
    if ((next === 'shell') !== (o.activeView === 'shell')) o.onViewChange('shell');
  };
  const currentThread = o.threads.find(thread => thread.key === o.currentKey) ?? tabs.find(thread => thread.key === o.currentKey)
    ?? o.openTabs?.find(thread => thread.key === o.currentKey);
  const knownThreads = [...o.threads, ...tabs.filter(tab => !o.threads.some(thread => thread.key === tab.key))];
  // The account's running threads, then finished ones not read yet: what the
  // running count in the status bar counts and opens.
  const accountThreads = [...knownThreads, ...(o.activeThreads ?? []).filter(thread => !knownThreads.some(known => known.key === thread.key))];
  const runningThreads = accountThreads.filter(thread => thread.status === 'running');
  const threadByKey = new Map(accountThreads.map(thread => [thread.key, thread]));
  // An agent thread is never listed alone: its conversation's root comes first.
  const inConversations = (list: WorkbenchThread[]) => {
    const shown: WorkbenchThread[] = [];
    const add = (thread: WorkbenchThread) => { if (!shown.some(item => item.key === thread.key)) shown.push(thread); };
    for (const thread of list) {
      const root = thread.rootKey && thread.rootKey !== thread.key ? threadByKey.get(thread.rootKey) : undefined;
      if (root) add(list.find(item => item.key === root.key) ?? root);
      add(thread);
    }
    return shown;
  };
  const runningConversations = inConversations(runningThreads);
  const runningCount = groupThreads(runningConversations).length;
  // A host that names the unread threads knows which were read before; without
  // it, the listed threads stand in.
  const unreadThreads = inConversations((o.activeThreads ?? o.threads).filter(thread => thread.status === 'unread' && thread.key !== o.currentKey));
  const unreadCount = groupThreads(unreadThreads).length;
  const favorites = o.threads.filter(thread => thread.favorite);
  // The sidebar and the thread sheet list this workspace's threads apart from
  // the recent ones elsewhere.
  const workspaceThreads = o.workspaceThreads ? tabs : [];
  const recentThreads = o.threads.filter(thread => !workspaceThreads.some(tab => tab.key === thread.key));
  const attention = (thread: WorkbenchThread) => thread.status === 'running' ? 0 : thread.status === 'unread' || thread.status === 'failed' ? 1 : 2;
  // The thread sheet lists the current thread's group first, then by attention.
  const currentRootKey = tabs.find(thread => thread.key === o.currentKey)?.rootKey ?? o.currentKey;
  const inCurrentGroup = (thread: WorkbenchThread) => thread.key === o.currentKey || thread.key === currentRootKey || thread.rootKey === currentRootKey;
  // Desktop navigation: the sidebar switch, Back and Forward head the sidebar,
  // level with the tabs row; with the sidebar folded they lead the tabs row.
  const navStrip = (
    <div className="matter-nav-strip" role="group" aria-label={translate('workbench.pageNavigation')}
      style={singleRowHeader && sidebarHidden ? { height: 30, borderBottom: 0, padding: 0 } : undefined}>
      <button aria-label={translate("workbench.toggleShortcutsSidebar")} aria-expanded={!sidebarHidden}
        title={translate("workbench.toggleShortcutsSidebar")} onClick={() => setSidebarHidden(!sidebarHidden)}>
        <PanelLeft data-icon="sidebar" />
      </button>
      <button aria-label={translate("workbench.goBack")} title={translate("workbench.goBack")} onClick={() => history.back()}><ArrowLeft data-icon="back" /></button>
      <button data-action="go-forward" aria-label={translate("workbench.goForward")} title={translate("workbench.goForward")} onClick={() => history.forward()}><ArrowRight data-icon="forward" /></button>
      {/* Out of the conversations, back to choosing a workspace. */}
      {homeHref && <a href={homeHref} onClick={goHome} aria-label={translate("workbench.backToWorkspaces")} title={translate("workbench.workspaces")}><Home data-icon="home" /></a>}
    </div>
  );
  // Right-click (or the menu key) on a tab or a row opens the thread's own ⋯ menu
  // there instead of the browser's. Touch keeps the ⋯ button and the long-press drag.
  const [contextMenu, setContextMenu] = useState<{ thread: WorkbenchThread; x: number; y: number; returnFocus?: HTMLElement; id: number } | null>(null);
  const openThreadMenuAt = (thread: WorkbenchThread, x: number, y: number, returnFocus?: HTMLElement) => {
    setContextMenu({ thread, x, y, ...(returnFocus ? { returnFocus } : {}), id: Date.now() });
  };
  const openThreadMenuFrom = (event: ReactMouseEvent<HTMLElement>, thread: WorkbenchThread) => {
    if (!o.renderThreadMenu || mobile || event.defaultPrevented) return;
    event.preventDefault();
    openThreadMenuAt(thread, event.clientX, event.clientY, event.currentTarget);
  };
  const openThreadMenuFromKey = (event: ReactKeyboardEvent<HTMLElement>, thread: WorkbenchThread) => {
    if (!o.renderThreadMenu || !(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    openThreadMenuAt(thread, box.left, box.bottom + 4, event.currentTarget);
  };
  const bell = o.showNotifications === false ? null : (
    <button
      aria-label={translate("workbench.notifications")}
      aria-expanded={bellOpen}
      onClick={() => {
        setBellOpen(!bellOpen);
        o.onReadNotifications();
      }}
    >
      <Bell data-icon="notifications" />
      {o.unreadCount > 0 && <span className="matter-unread" />}
    </button>
  );
  const renderNotification = (n: WorkbenchNotification) => (
    <a
      key={n.id}
      href={n.href}
      onClick={(e) => {
        e.preventDefault();
        navigate(n.href);
      }}
    >
      <StatusMark status={n.status ?? 'unread'} />
      <span>
        {n.title}
        {n.summary && <p className="matter-notification-summary">{n.summary}</p>}
        <small>{new Date(n.occurredAt).toLocaleString(getLocale())}</small>
      </span>
    </a>
  );
  // A conversation's agent threads open under its row from a small toggle in it.
  const [agentsOpen, setAgentsOpen] = useState<Record<string, boolean>>({});
  // They open downward: the row that was tapped keeps its place on screen. A
  // bottom sheet would grow upward, so it keeps its height and scrolls instead.
  const agentToggle = useRef<{ row: HTMLElement; top: number } | null>(null);
  useLayoutEffect(() => {
    const held = agentToggle.current;
    agentToggle.current = null;
    if (!held?.row.isConnected) return;
    const drift = held.row.getBoundingClientRect().top - held.top;
    if (!drift) return;
    let scroller: HTMLElement | null = held.row.parentElement;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    if (scroller) scroller.scrollTop += drift;
  }, [agentsOpen]);
  const renderThread = (thread: WorkbenchThread, activity = threadGroupActivity(thread), agents?: { count: number; running: number; open: boolean }) => (
    <div key={thread.key} className="matter-thread-entry">
    <a
      href={thread.href}
      onClick={(e) => {
        e.preventDefault();
        navigate(thread.href);
      }}
      onPointerDown={() => o.onPrefetchThread?.(thread.href)}
      onMouseEnter={() => o.onPrefetchThread?.(thread.href)}
      onContextMenu={event => openThreadMenuFrom(event, thread)}
      onKeyDown={event => openThreadMenuFromKey(event, thread)}
      className="matter-thread-row"
      aria-current={thread.key === o.currentKey ? 'page' : undefined}
      title={`${thread.title}\n${thread.subtitle} · ${activity.label}`}
    >
      {thread.agent && <span className="matter-thread-avatar" data-agent={thread.agent} aria-hidden="true" />}
      <span
        className="matter-status-dot"
        data-status={activity.status}
        role="img"
        aria-label={activity.label}
      />
      <span className="matter-thread-copy">
        <span>{thread.title}</span>
        <small>{thread.subtitle}</small>
      </span>
    </a>
    {agents && <button type="button" className="matter-agent-toggle" aria-expanded={agents.open} data-running={agents.running > 0 || undefined}
      aria-label={translate('workbench.agentThreads', { value1: thread.title, value2: agents.count })} title={translate('workbench.agentThreads', { value1: thread.title, value2: agents.count })}
      onClick={event => {
        const row = event.currentTarget.closest<HTMLElement>('.matter-thread-entry');
        const sheet = event.currentTarget.closest<HTMLElement>('.matter-phone-sheet');
        if (sheet && !sheet.style.height) sheet.style.height = `${sheet.offsetHeight}px`;
        if (row) agentToggle.current = { row, top: row.getBoundingClientRect().top };
        setAgentsOpen(open => ({ ...open, [thread.key]: !agents.open }));
      }}>
      <Bot aria-hidden="true" /><span>{agents.count}</span><ChevronRight className="matter-agent-toggle-chevron" aria-hidden="true" />
    </button>}
    {o.renderThreadMenu?.(thread)}
    </div>
  );
  const renderThreadGroups = (threads: WorkbenchThread[], reorder = false) => groupThreads(threads).map(({ root, children }) => {
    const open = agentsOpen[root.key] ?? children.some(child => child.key === o.currentKey);
    return <div key={root.key} className="matter-thread-group-entry" data-reorder-key={reorder ? root.key : undefined}>
      {renderThread(root, threadGroupActivity(root, children), children.length > 0 ? { count: children.length, running: children.filter(child => child.status === 'running').length, open } : undefined)}
      {children.length > 0 && open && <div className="matter-agent-children" role="group" aria-label={translate('workbench.agentThreads_187f89', { value1: root.title })}>
        {children.map(child => renderThread(child))}
      </div>}
    </div>;
  });
  // ElAgente: a phone status bar with nothing to show (no device monitor, connection,
  // notifications, usage, running threads or search) collapses to the safe area.
  // ElAgente: the thread tools toggle shows only when its menu has something in it
  // (upstream always has the workspace path and the shortcut star).
  const hasThreadTools = Boolean(actions || threadMenu || o.statusActions) ||
    isCopyableWorkspacePath(o.workspacePath) || o.showShortcuts !== false;
  const statusEmpty = !deviceMonitor && !connection && !bell && !o.searchOpen &&
    visibleSubscriptionWindows(o.subscriptionUsage).length === 0 && runningCount === 0;
  return (
    <div
      ref={rootRef}
      style={!mobile && sidebarWidth ? { '--matter-sidebar-width': `${sidebarWidth}px` } as CSSProperties : undefined}
      className={`matter-workbench ${sidebarHidden ? 'is-sidebar-hidden' : ''} ${o.hideRail ? 'has-host-rail' : ''} ${dock ? 'has-phone-dock' : ''} ${leftHanded ? 'is-left-handed' : ''} ${dock && typing ? 'is-typing' : ''}`}
      onClick={(e) => {
        if (
          e.target instanceof Element &&
          !e.target.closest('.matter-thread-menu')
        ) {
          e.currentTarget
            .querySelector('.matter-thread-menu[open]')
            ?.removeAttribute('open');
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setBellOpen(false);
          setSidebarOpen(false);
          setThreadsOpen(false);
          setMoreOpen(false);
          setRunningOpen(false);
          e.currentTarget
            .querySelector('.matter-thread-menu[open]')
            ?.removeAttribute('open');
        }
      }}
    >
      {!mobile && !o.hideRail && <nav className="matter-rail" aria-label={translate("workbench.workspaceTools")}>
        {homeHref && <a
          className="matter-brand"
          href={homeHref} onClick={goHome}
          aria-label={o.brandName ? `${o.brandName} home` : translate("workbench.pockymoeHome")}
        >
          {o.brandName ? o.brandName.slice(0, 1) : <>p<span>m</span></>}
        </a>}
        <button
          aria-label={translate("workbench.chat")}
          aria-pressed={o.panels ? !chatCovered : o.activeView === 'chat'}
          onClick={showChat}
        >
          <MessageSquare data-icon="chat" />
        </button>
        {o.terminalEnabled && (
          <button
            aria-label={translate("workbench.terminal")}
            aria-pressed={o.activeView === 'shell'}
            title={`${translate("workbench.terminal")} (Ctrl+\`)`}
            onClick={() => o.onViewChange('shell')}
          >
            <Terminal data-icon="terminal" />
          </button>
        )}
        {o.toolPanels?.map(panel => (
          <button key={panel.id} aria-label={panel.label} title={panel.label}
            aria-pressed={panel.active} onClick={panel.onToggle}>{panel.icon}</button>
        ))}
        {!o.threadHeader && <button aria-label={translate("workbench.toggleExplorer")} aria-pressed={explorerOpen} aria-expanded={explorerOpen}
          title={translate("workbench.explorer")} onClick={() => setExplorerOpen(open => !open)}><FolderOpen data-icon="explorer" /></button>}
        {openThreadMap && <button aria-label={translate('workbench.threadMap')} title={translate('workbench.threadMap')} onClick={openThreadMap}><LayoutDashboard data-icon="thread-map" /></button>}
        <div className="matter-rail-bottom">{deviceMonitor}{localSettings}</div>
      </nav>}
      {dock ? <header className={`matter-topbar is-status-only ${o.searchOpen ? 'is-search-open' : ''} ${statusEmpty ? 'is-empty' : ''}`}>
        <div className="matter-topbar-status">{deviceMonitor}</div>
        {o.searchOpen && <div className="matter-topbar-search">{o.search}</div>}
        <span className="matter-topbar-spacer" />
        {/* Usage windows are read, rarely touched: they live in the status bar. */}
        {visibleSubscriptionWindows(o.subscriptionUsage).length > 0 && <div className="matter-topbar-usage"><ComposerSubscriptionUsage usage={o.subscriptionUsage} /></div>}
        {runningCount > 0 && <button className="matter-running-chip" aria-expanded={runningOpen}
          aria-label={translate('workbench.runningChip', { count: runningCount })} title={translate('workbench.runningChip', { count: runningCount })}
          onClick={() => { setThreadsOpen(false); setMoreOpen(false); setRunningOpen(true); }}>
          <span className="matter-running-icon" aria-hidden="true"><MessagesSquare /><i /></span>
          <span>{runningCount}</span><span className="matter-running-label">{translate('workbench.running')}</span>
        </button>}
        <div className="matter-connection">{connection}</div>
        {bell}
      </header> : mobile && <header className={`matter-topbar ${o.searchOpen ? 'is-search-open' : ''}`}>
        <button
          ref={drawerToggleRef}
          aria-label={translate("workbench.toggleShortcutsSidebar")}
          aria-expanded={mobile ? sidebarOpen : !sidebarHidden}
          onClick={() => {
            if (mobile) setSidebarOpen(!sidebarOpen);
            else setSidebarHidden(!sidebarHidden);
          }}
        >
          <PanelLeft data-icon="sidebar" />
        </button>
        <span className="matter-topbar-brand">{brandName}</span>
        <span className="matter-topbar-separator" />
        <button aria-label={translate("workbench.goBack")} onClick={() => history.back()}>
          <ArrowLeft data-icon="back" />
        </button>
        <button data-action="go-forward" aria-label={translate("workbench.goForward")} onClick={() => history.forward()}>
          <ArrowRight data-icon="forward" />
        </button>
        {!drawerTools && homeHref && <a href={homeHref} onClick={goHome} aria-label={translate("workbench.backToWorkspaces")} title={translate("workbench.workspaces")}>
          <Home data-icon="home" />
        </a>}
        <div className="matter-topbar-search">{o.search ?? (showSearch && <button
          className="matter-search-trigger"
          aria-label={searchLabel}
          disabled={o.emptyWorkspace}
          onClick={o.onSearch}
        >
          <Search data-icon="search" />
          <span>{searchLabel}</span>
        </button>)}</div>
        <div className="matter-topbar-end">
          {mobile && deviceMonitor}
          {mobile && <>
            {!drawerTools && <button aria-label={translate("workbench.chat")} aria-pressed={!explorerOpen && (o.panels ? !chatCovered : o.activeView === 'chat')} onClick={showChat}><MessageSquare data-icon="chat" /></button>}
            {o.terminalEnabled && <button aria-label={translate("workbench.terminal")} aria-pressed={!explorerOpen && o.activeView === 'shell'} onClick={() => {
              // Over Files, the terminal button shows the terminal rather than hiding it unseen.
              if (explorerOpen) {
                setExplorerOpen(false);
                if (o.activeView === 'shell') return;
              }
              o.onViewChange('shell');
            }}><Terminal data-icon="terminal" /></button>}
            {o.toolPanels?.map(panel => <button key={panel.id} aria-label={panel.label} title={panel.label} aria-pressed={panel.active} onClick={panel.onToggle}>{panel.icon}</button>)}
            {!o.threadHeader && <button aria-label={translate("workbench.toggleExplorer")} aria-pressed={explorerOpen} aria-expanded={explorerOpen} title={translate("workbench.explorer")} onClick={() => setExplorerOpen(open => !open)}><FolderOpen data-icon="explorer" /></button>}
            {localSettings}
          </>}
          <div className="matter-connection">{connection}</div>
          {bell}
        </div>
      </header>}
      {/* Under the dock the scrim stays mounted so a drag can fade it in. */}
      {(sidebarOpen || dock) && (
        <button
          ref={scrimRef}
          className="matter-sidebar-scrim"
          aria-label={translate("workbench.closeNavigation")}
          data-open={sidebarOpen || undefined}
          {...(sidebarOpen ? {} : { 'aria-hidden': true, tabIndex: -1 })}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`matter-sidebar ${sidebarOpen ? 'is-open' : ''}`}
        aria-label={translate("workbench.threadNavigation")}
        inert={mobile && !sidebarOpen}
        role={mobile && sidebarOpen ? 'dialog' : undefined}
        aria-modal={mobile && sidebarOpen ? true : undefined}
      >
        {!mobile && !sidebarHidden && navStrip}
        {/* The upper half holds this workspace's threads; recent chats from
            everywhere start halfway down, so the two read apart. Each scrolls on its own. */}
        <div className={`matter-sidebar-upper ${recentThreads.length && recentsOpen ? '' : 'is-alone'}`}>
        <div className="matter-sidebar-heading">
          {dock
            ? <span className="matter-drawer-brand"><b aria-hidden="true">{o.brandName ? o.brandName.slice(0, 1) : <>p<i>m</i></>}</b>{brandName}</span>
            : <span>{translate("workbench.workspace")}</span>}
          <button
            className="matter-mobile-close"
            aria-label={translate("workbench.closeSidebar")}
            onClick={() => setSidebarOpen(false)}
          >
            <X data-icon="close" />
          </button>
        </div>
        {o.renderNavigationHeader?.({ collapsed: !mobile && sidebarHidden, closeNavigation: () => setSidebarOpen(false) })}
        {/* Under the dock, Chat lives in the dock and Home in the row below. */}
        {drawerTools && !dock && (
          <div className="matter-drawer-tools" role="group" aria-label={translate("workbench.workspaceTools")}>
            {homeHref && <a href={homeHref} onClick={goHome}><Home data-icon="home" /><span>{translate("workbench.workspaces")}</span></a>}
            <button aria-pressed={o.panels ? !chatCovered : o.activeView === 'chat'} onClick={() => { showChat(); setSidebarOpen(false); }}><MessageSquare data-icon="chat" /><span>{translate("workbench.chat")}</span></button>
          </div>
        )}
        {dock && homeHref && (
          <a className="matter-drawer-home" href={homeHref} onClick={goHome}>
            <Home data-icon="home" /><span>{translate("workbench.allWorkspaces")}</span><ChevronRight aria-hidden="true" />
          </a>
        )}
        {mobile && openThreadMap && (
          <button type="button" className="matter-drawer-home" onClick={() => { setSidebarOpen(false); openThreadMap(); }}>
            <LayoutDashboard data-icon="thread-map" /><span>{translate('workbench.threadMap')}</span><ChevronRight aria-hidden="true" />
          </button>
        )}
        {o.error && (
          <p className="matter-sidebar-error" role="alert">
            {o.error}
          </p>
        )}
        <div className="matter-sidebar-scroll">
        {o.showShortcuts !== false && <button
          className="matter-section-heading"
          aria-expanded={shortcutsOpen}
          onClick={() => setShortcutsOpen(!shortcutsOpen)}
        >
          {shortcutsOpen ? <ChevronDown /> : <ChevronRight />}
          <span>{translate("workbench.shortcuts")}</span>
          {favorites.length > 0 ? <span className="matter-section-count">{favorites.length}</span> : <Star data-icon="shortcuts" />}
        </button>}
        {o.showShortcuts !== false && shortcutsOpen && (
          <div className="matter-thread-section" data-testid="shortcuts">
            <ShortcutList threads={favorites} onReorder={o.onReorderShortcuts}
              renderRow={thread => renderThread(thread, threadGroupActivity(thread, o.threads.filter(child => child.rootKey === thread.key && child.key !== thread.key)))} />
            {!o.threads.some((t) => t.favorite) && (
              <p className="matter-sidebar-hint">
                {translate("workbench.starAThreadToKeepItClose")}<br />
                {translate("workbench.acrossWorkspacesAndDevices")}</p>
            )}
          </div>
        )}
        {workspaceThreads.length > 0 && <>
          {/* New thread sits right after the count: this is where the workspace's threads are. */}
          <div className="matter-section-heading-row">
            <button
              className="matter-section-heading"
              aria-expanded={workspaceOpen}
              onClick={() => setWorkspaceOpen(!workspaceOpen)}
            >
              {workspaceOpen ? <ChevronDown /> : <ChevronRight />}
              <span>{o.workspaceSectionLabel ?? translate("workbench.thisWorkspace")}</span>
              <span className="matter-section-count">{groupThreads(workspaceThreads).length}</span>
            </button>
            {newThread ? <div className="matter-section-add">{newThread}</div> : null}
          </div>
          {workspaceOpen && (
            <div ref={workspaceListRef} className="matter-thread-section" data-testid="workspace-threads">
              {renderThreadGroups(workspaceThreads, reorderable)}
            </div>
          )}
        </>}
        </div>
        </div>
        {recentThreads.length > 0 && <div className={`matter-sidebar-recents ${recentsOpen ? '' : 'is-folded'}`}>
          <button
            className="matter-section-heading"
            aria-expanded={recentsOpen}
            onClick={() => setRecentsOpen(!recentsOpen)}
          >
            {recentsOpen ? <ChevronDown /> : <ChevronRight />}
            <span>{translate("workbench.recentChats")}</span>
            <span className="matter-section-count" title={translate("workbench.conversationsGroups", { value1: recentThreads.length, value2: groupThreads(recentThreads).length })}>{groupThreads(recentThreads).length}</span>
          </button>
          {recentsOpen && (
            <div className="matter-thread-section matter-sidebar-scroll" data-testid="recent-chats">
              {renderThreadGroups(recentThreads)}
            </div>
          )}
        </div>}
        {!dock && o.sidebarFooter !== '' && <div className="matter-sidebar-footer">
          {o.sidebarFooter ?? translate("workbench.yourConversationsTogether")}</div>}
      </aside>
      <main className="matter-main">
        {!mobile && !sidebarHidden && <div role="separator" aria-orientation="vertical" tabIndex={0} className="matter-sidebar-resize"
          aria-label={translate('workbench.resizeSidebar')} aria-valuemin={SIDEBAR_MIN} aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={Math.round(sidebarWidth ?? sidebarRef.current?.offsetWidth ?? 236)} title={translate('workbench.resizeSidebarHint')}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); sidebarDrag.current = { x: event.clientX, width: sidebarRef.current?.offsetWidth ?? 236 }; }}
          onPointerMove={event => { if (sidebarDrag.current) resizeSidebar(sidebarDrag.current.width + event.clientX - sidebarDrag.current.x); }}
          onPointerUp={event => { sidebarDrag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
          onLostPointerCapture={() => { sidebarDrag.current = null; }}
          onDoubleClick={() => resizeSidebar(null)}
          onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); resizeSidebar((sidebarWidth ?? sidebarRef.current?.offsetWidth ?? 236) + (event.key === 'ArrowLeft' ? -16 : 16)); } }} />}
        {!dock && !singleRowHeader && <div className="matter-tabs-row">
        {!mobile && sidebarHidden && navStrip}
        <div className="matter-tabs-main">
        {/* Desktop: search opens over the tabs rather than pushing them aside. */}
        {!mobile && (o.search || showSearch) && <div className={`matter-tabs-search ${o.searchOpen ? 'is-open' : ''}`}>{o.search ?? <button
          className="matter-search-trigger"
          aria-label={searchLabel}
          title={`${searchLabel} (Ctrl+F)`}
          disabled={o.emptyWorkspace}
          onClick={o.onSearch}
        >
          <Search data-icon="search" />
          <span>{searchLabel}</span>
        </button>}</div>}
        <div className="tab-scroll-surface matter-tab-scroll" {...tabScrollEdges}>
        <nav ref={tabsRef} className="matter-thread-tabs" aria-label={translate("workbench.workspaceThreads")}>
          <GroupedThreadTabs threads={tabStrip} currentKey={o.currentKey} onNavigate={navigate}
            onThreadMenu={o.renderThreadMenu && !mobile ? openThreadMenuAt : undefined}
            onPrefetch={o.onPrefetchThread}
            onClose={editorTabs && o.onCloseTab ? closeTab : undefined} />
        </nav>
        <TabScrollButtons targetRef={tabsRef} edges={tabScrollEdges} />
        </div>
        {/* New thread stays in reach however many tabs there are. */}
        <div className="matter-tab-add">{newThread}</div>
        {!o.threadHeader && !o.emptyWorkspace && hasThreadTools && <button ref={toolbarToggleRef} className="matter-toolbar-toggle" aria-label={translate("workbench.threadTools")} aria-haspopup="menu" aria-expanded={toolbarOpen} aria-controls="matter-thread-tools" onClick={() => setToolbarOpen(open => !open)} title={toolbarOpen ? translate("workbench.hideThreadTools") : translate("workbench.showThreadTools")}><SlidersHorizontal data-icon="thread-tools" /></button>}
        {!o.threadHeader && <ThreadToolsMenu id="matter-thread-tools" open={toolbarOpen && !o.emptyWorkspace} anchorRef={toolbarToggleRef} panels={o.statusActions}
          path={o.workspacePath} title={title} favorite={o.favorite} favoriteBusy={o.favoriteBusy} onToggleFavorite={o.showShortcuts === false ? undefined : o.onToggleFavorite}
          onClose={(restore) => { setToolbarOpen(false); if (restore) toolbarToggleRef.current?.focus(); }}>
          {actions}
          {threadMenu}
        </ThreadToolsMenu>}
        </div>
        {!mobile && <div className="matter-tabs-end">
          {o.hideRail && !o.threadHeader && <button aria-label={translate("workbench.toggleExplorer")} aria-pressed={explorerOpen} aria-expanded={explorerOpen}
            title={translate("workbench.explorer")} onClick={() => setExplorerOpen(open => !open)}><FolderOpen data-icon="explorer" /></button>}
          <div className="matter-connection">{connection}</div>
          {bell}
          {/* The rail's thread map, beside its explorer toggle and settings (same markup). */}
          {o.hideRail && !o.threadHeader && openThreadMap && <button aria-label={translate('workbench.threadMap')} title={translate('workbench.threadMap')} onClick={openThreadMap}><LayoutDashboard data-icon="thread-map" /></button>}
          {o.hideRail && !o.threadHeader && localSettings}
        </div>}
        </div>}
        {o.threadHeader && !(singleRowHeader && o.emptyWorkspace) && <ThreadHeader header={o.threadHeader} title={title || currentThread?.title || ''} threadKey={o.currentKey}
          singleRow={singleRowHeader} navigation={singleRowHeader && sidebarHidden ? navStrip : null}
          search={singleRowHeader && (o.search || showSearch) ? <div className={`matter-tabs-search ${o.searchOpen ? 'is-open' : ''}`}>{o.search ?? <button
            className="matter-search-trigger" aria-label={searchLabel} title={`${searchLabel} (Ctrl+F)`}
            onClick={o.onSearch}><Search data-icon="search" /><span>{searchLabel}</span></button>}</div> : null}
          indicators={singleRowHeader ? <><div className="matter-connection">{connection}</div>{bell}</> : null}
          explorerOpen={explorerOpen} onToggleExplorer={() => setExplorerOpen(open => !open)} options={o}
          actions={<>{actions}{threadMenu}</>} />}
        <PhoneDockContext.Provider value={dock}>
        {o.panels ? <WorkbenchContext.Provider value={true}><WorkbenchPanels options={dock ? { ...o.panels, onPaneSwitchChange: setPaneSwitch } : o.panels} explorer={explorer} revealExplorer={revealExplorer} toolPanel={toolPanel}>{children}</WorkbenchPanels></WorkbenchContext.Provider> : (
        <div ref={contentRef} style={{ '--explorer-width': `${explorerWidth}px` } as CSSProperties} className={`matter-content ${explorerOpen ? 'has-explorer' : ''}`}>
          <div className="matter-chat">
            <WorkbenchContext.Provider value={true}>
              {children}
            </WorkbenchContext.Provider>
          </div>
          {explorerOpen && (
            <aside className="matter-explorer" aria-label={translate("workbench.explorer")}>
              {!mobile && <div role="separator" aria-label={translate("workbench.resizeExplorer")} aria-orientation="vertical" aria-valuemin={260} aria-valuemax={Math.max(260, (contentRef.current?.clientWidth ?? 1000) - 320)} aria-valuenow={explorerWidth} tabIndex={0} className="matter-explorer-resize"
                onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); resizeOrigin.current = { x: e.clientX, width: explorerWidth }; }}
                onPointerMove={e => { if (resizeOrigin.current) resizeExplorer(resizeOrigin.current.width + resizeOrigin.current.x - e.clientX); }}
                onPointerUp={e => { resizeOrigin.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
                onLostPointerCapture={() => { resizeOrigin.current = null; }}
                onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); resizeExplorer(explorerWidth + (e.key === 'ArrowLeft' ? 24 : -24)); } }}
              />}
              {!o.threadHeader && <div className="matter-explorer-heading">
                {translate("workbench.explorer")}<button
                  aria-label={translate("workbench.closeExplorer")}
                  onClick={() => setExplorerOpen(false)}
                >
                  <X data-icon="close" />
                </button>
              </div>}
              {explorer}
            </aside>
          )}
        </div>
        )}
        </PhoneDockContext.Provider>
      </main>
      {dock && <>
        <PhoneDock title={title} thread={currentThread} paneSwitch={paneSwitch} pane={pane}
          filesDisabled={o.threadHeader ? o.threadHeader.toolsDisabled ?? o.threadHeader.tone !== 'running' : false}
          terminalEnabled={o.terminalEnabled} onPane={choosePane}
          onOpenThreads={() => { setMoreOpen(false); setThreadsOpen(true); }} onOpenMore={() => { setThreadsOpen(false); setMoreOpen(true); }}
          threadsOpen={threadsOpen} moreOpen={moreOpen} />
        <PhoneSheet open={threadsOpen} label={translate('workbench.threadSheet')} onClose={() => setThreadsOpen(false)}
          footer={newThread}>
          {/* Both sections fold; this workspace's conversations keep the order dragged into them. */}
          <button type="button" className="matter-section-heading matter-sheet-section-heading" aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen(!workspaceOpen)}>
            {workspaceOpen ? <ChevronDown /> : <ChevronRight />}
            <span>{o.workspaceSectionLabel ?? translate('workbench.thisWorkspace')}</span>
            <span className="matter-section-count">{groupThreads(tabs).length}</span>
          </button>
          {workspaceOpen && <div ref={sheetListRef} className="matter-thread-section" data-testid="sheet-workspace-threads">{renderThreadGroups(reorderable ? tabs : [...tabs].sort((a, b) => Number(inCurrentGroup(b)) - Number(inCurrentGroup(a)) || attention(a) - attention(b)), reorderable)}</div>}
          {o.threads.some(thread => !tabs.some(tab => tab.key === thread.key)) && <>
            <button type="button" className="matter-section-heading matter-sheet-section-heading" aria-expanded={sheetRecentsOpen} onClick={() => setSheetRecentsOpen(!sheetRecentsOpen)}>
              {sheetRecentsOpen ? <ChevronDown /> : <ChevronRight />}
              <span>{translate('workbench.recentChats')}</span>
              <span className="matter-section-count">{groupThreads(o.threads.filter(thread => !tabs.some(tab => tab.key === thread.key))).length}</span>
            </button>
            {sheetRecentsOpen && <div className="matter-thread-section">{renderThreadGroups(o.threads.filter(thread => !tabs.some(tab => tab.key === thread.key)))}</div>}
          </>}
        </PhoneSheet>
        <PhoneSheet open={runningOpen} label={translate('workbench.runningSheet')} onClose={() => setRunningOpen(false)}
          footer={<button type="button" className="matter-phone-sheet-all" onClick={() => { setRunningOpen(false); setThreadsOpen(true); }}>
            <MessagesSquare aria-hidden="true" /><span>{translate('workbench.allThreads')}</span>
          </button>}>
          <h3>{translate('workbench.runningNow')} <span className="matter-section-count">{runningCount}</span></h3>
          {runningCount
            ? <div className="matter-thread-section">{renderThreadGroups(runningConversations)}</div>
            : <p className="matter-sidebar-hint">{translate('workbench.noRunningThreads')}</p>}
          {unreadCount > 0 && <>
            <h3>{translate('workbench.finishedUnread')} <span className="matter-section-count">{unreadCount}</span></h3>
            <div className="matter-thread-section">{renderThreadGroups(unreadThreads)}</div>
          </>}
        </PhoneSheet>
        {/* The app's destinations sit in the footer, so Settings shows however many tools there are. */}
        <PhoneSheet open={moreOpen} label={translate('workbench.moreActions')} onClose={() => setMoreOpen(false)}
          footer={<nav className="matter-phone-sheet-apps" aria-label={translate('workbench.app')}>
            {openThreadMap && <button type="button" onClick={() => { setMoreOpen(false); openThreadMap(); }}><LayoutDashboard data-icon="thread-map" /><span>{translate('workbench.threadMap')}</span></button>}
            <button type="button" aria-label={translate('workbench.workspaceAndShortcuts')} onClick={() => { setMoreOpen(false); setSidebarOpen(true); }}><PanelLeft data-icon="sidebar" /><span>{translate('workbench.drawerShort')}</span></button>
            {homeHref && <a href={homeHref} aria-label={translate('workbench.backToWorkspaces')} onClick={goHome}><Home data-icon="home" /><span>{translate('workbench.homeShort')}</span></a>}
            <button type="button" onClick={() => history.back()}><ArrowLeft data-icon="back" /><span>{translate('workbench.goBack')}</span></button>
            {localSettings && <div className="matter-phone-sheet-settings">{localSettings}<span>{translate('workbench.settings')}</span></div>}
          </nav>}>
          {/* Copying the path keeps the sheet open, so its check mark shows. */}
          <div className="matter-phone-sheet-head" data-sheet-keep="">
            <h3 className="matter-phone-sheet-title">{title}</h3>
            {!o.emptyWorkspace && isCopyableWorkspacePath(o.workspacePath) ? <PathChip path={o.workspacePath} display={homeRelativePath(o.workspacePath)} className="matter-phone-sheet-path" /> : null}
          </div>
          <div className="matter-phone-sheet-tools">
            {!o.emptyWorkspace && showSearch && <button type="button" onClick={o.onSearch}><Search data-icon="search" /><span>{searchLabel}</span></button>}
            {!o.emptyWorkspace && o.showShortcuts !== false && <button type="button" aria-pressed={o.favorite} disabled={o.favoriteBusy} onClick={o.onToggleFavorite}><Star data-icon="shortcut" fill={o.favorite ? 'currentColor' : 'none'} /><span>{o.favorite ? translate('workbench.removeShortcut') : translate('workbench.addShortcut')}</span></button>}
            {o.toolPanels?.map(panel => <button type="button" key={panel.id} aria-pressed={panel.active} onClick={panel.onToggle}>{panel.icon}<span>{panel.label}</span></button>)}
            {shellNav?.setPhoneHand && <button type="button" aria-pressed={leftHanded} onClick={() => shellNav.setPhoneHand?.(leftHanded ? 'right' : 'left')}><Hand className="matter-phone-hand-icon" /><span>{translate('workbench.leftHanded')}</span></button>}
            {!o.threadHeader && <div className="matter-phone-sheet-host">{actions}{threadMenu}{o.statusActions}</div>}
          </div>
        </PhoneSheet>
      </>}
      {o.settingsPortalTargetId && settingsTarget?.id === o.settingsPortalTargetId
        ? createPortal(settings, settingsTarget.element) : null}
      {contextMenu && o.renderThreadMenu && <Fragment key={contextMenu.id}>{o.renderThreadMenu(contextMenu.thread, {
        x: contextMenu.x, y: contextMenu.y, returnFocus: contextMenu.returnFocus,
        onClose: () => setContextMenu(current => current?.id === contextMenu.id ? null : current),
      })}</Fragment>}
      {bellOpen && (
        <>
          <button
            className="matter-popover-scrim"
            aria-label={translate("workbench.closeNotifications")}
            onClick={() => setBellOpen(false)}
          />
          <section
            className="matter-notifications"
            aria-label={translate("workbench.notifications")}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setBellOpen(false);
            }}
          >
            <div className="matter-notifications-heading">
              {translate("workbench.notifications")}<button
                aria-label={translate("workbench.closeNotificationPanel")}
                onClick={() => setBellOpen(false)}
              >
                <X data-icon="close" />
              </button>
            </div>
            {o.notifications.length ? (
              notificationGroups(o.notifications).map(group => group.title
                ? <div key={group.key} className="matter-notification-group">
                  <a className="matter-notification-root" href={group.href} onClick={(e) => { e.preventDefault(); navigate(group.href!); }}>
                    <MessagesSquare aria-hidden="true" /><span>{group.title}</span>
                  </a>
                  {group.items.map(renderNotification)}
                </div>
                : group.items.map(renderNotification))
            ) : (
              <p>{translate("workbench.allCaughtUpCompletedThreadsWillAppear")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
