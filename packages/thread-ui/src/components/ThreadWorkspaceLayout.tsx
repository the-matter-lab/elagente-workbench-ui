import { translate, useI18n } from '../i18n';
import { SettingsDialog } from "./SettingsDialog";
import { WorkbenchThreadMenu } from "./workbench/WorkbenchThreadMenu";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Copy,
  Folder,
  MessageSquare,
  LoaderCircle,
  CircleAlert,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Rows3,
  Settings,
  SlidersHorizontal,
  Sun,
  Trash2,
  X,
} from "lucide-react";

import type { AgentRuntimeStatusDto, ThreadDto } from "@remote-codex/shared";
import { useAppShellNav } from "../app-shell/AppShellNavContext";
import {
  formatShortTimestamp,
  threadStatusClassName,
  threadStatusLabel,
} from "./threadPresentation";
import { RenameDialog } from "./RenameDialog";
import { MatterWorkbench, type MatterWorkbenchOptions } from './MatterWorkbench';
import type { ThemeMode } from "../app-shell/AppShellNavContext";
import {
  GraphChatMainShell,
  GraphChatMobileScrim,
  GraphChatRoomsRailShell,
  GraphChatShellFrame,
  GraphChatShellRoot,
  GraphChatSplitRegion,
  GraphChatTopbarShell,
} from "./graph-chat/GraphChatShellLayout";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./graph-workspace/GraphResizablePanels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./graph-ui/Dialog";

import { Tooltip, TooltipContent, TooltipTrigger } from "./graph-ui/Tooltip";

const THEME_MODE_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  icon: typeof Monitor;
}> = [
  { value: "system", get label() { return translate("files.followSystem"); }, icon: Monitor },
  { value: "dark", get label() { return translate("files.dark"); }, icon: Moon },
  { value: "light", get label() { return translate("files.light"); }, icon: Sun },
];

interface ThreadWorkspaceLayoutProps {
  workbench?: MatterWorkbenchOptions;
  /** Host navigation (ElAgente's Agent switcher) above the workbench thread list. */
  renderNavigationHeader?: (input: { collapsed: boolean; closeNavigation: () => void }) => ReactNode;
  threads: ThreadDto[];
  status?: AgentRuntimeStatusDto | null;
  loading?: boolean;
  error?: string | null;
  viewportConstrained?: boolean;
  layoutMode?: "desktop" | "responsive" | "mobile";
  effectiveTheme?: "light" | "dark";
  themeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
  showMobileAppMenu?: boolean;
  showMobileThreadNavToggle?: boolean;
  showMobileNewThreadShortcut?: boolean;
  hideRoomsRail?: boolean;
  settingsDialogOpen?: boolean;
  onSettingsDialogOpenChange?: (open: boolean) => void;
  mobileHeaderAction?: ReactNode;
  currentThreadId?: string | undefined;
  currentThreadLabel?: string | null | undefined;
  currentWorkspaceId?: string | null | undefined;
  currentWorkspaceLabel?: string | null | undefined;
  harnessLabel?: string | null | undefined;
  sessionLabel?: string | null | undefined;
  usageLabel?: string | null | undefined;
  threadActionsButton?: ReactNode;
  topbarActions?: ReactNode;
  deviceMonitor?: ReactNode;
  workspaceLabels?: Record<string, string>;
  metaContent?: ReactNode;
  settingsContent?: ReactNode;
  globalSettingsContent?: ReactNode;
  settingsSections?: import("./SettingsPanels").SettingsSection[];
  appMenuButton?: ReactNode;
  appNavigationMenu?: ReactNode;
  workspaceReturnHref?: string;
  onWorkspaceReturn?: () => void;
  getThreadHref?: (threadId: string) => string;
  onOpenThread?: (threadId: string) => void;
  getNewThreadHref?: (workspaceId?: string | null) => string;
  newThreadHref?: string;
  newThreadLabel?: string;
  /** Host scope disables global settings and home navigation; conversation creation stays available. */
  restrictedNavigation?: boolean;
  /** Keep Settings under restrictedNavigation; the host passes only the sections its scope allows. */
  scopedSettings?: boolean;
  onNewThread?: () => void;
  onNewThreadTitle?: (title: string) => Promise<void> | void;
  renderNewThreadDialogContent?: (input: {
    close: () => void;
    closeNavigation: () => void;
    currentWorkspaceId?: string | null;
  }) => ReactNode;
  renderThreadLink?: (input: {
    thread: ThreadDto;
    children: ReactNode;
    className: string;
    onClick: () => void;
  }) => ReactNode;
  onCloseAppNavigation?: () => void;
  onRenameThread?:
    | ((threadId: string, title: string) => Promise<void> | void)
    | undefined;
  onDeleteThread?: ((thread: ThreadDto) => void) | undefined;
  workspaceContent?: ReactNode;
  workspaceTitle?: string;
  workspaceActions?: ReactNode;
  workspaceRevealRequestKey?: number;
  children: ReactNode;
}

interface ThreadCardsProps {
  threads: ThreadDto[];
  currentThreadId?: string | undefined;
  currentWorkspaceId?: string | null | undefined;
  workspaceLabels?: Record<string, string>;
  onOpenThread: (threadId: string) => void;
  getThreadHref?: ((threadId: string) => string) | undefined;
  renderThreadLink?: ThreadWorkspaceLayoutProps["renderThreadLink"] | undefined;
  onBeginRenameThread?: ((thread: ThreadDto) => void) | undefined;
  onDeleteThread?: ((thread: ThreadDto) => void) | undefined;
  scrollable?: boolean;
  maxHeightClassName?: string;
  showDeleteButton?: boolean;
  showSessionCopyButton?: boolean;
  collapsed?: boolean;
}

function ThreadCard({
  thread,
  currentThreadId,
  currentWorkspaceId,
  workspaceLabels = {},
  onOpenThread,
  getThreadHref,
  renderThreadLink,
  onBeginRenameThread,
  onDeleteThread,
  showDeleteButton = false,
  showSessionCopyButton = false,
  collapsed = false,
}: {
  thread: ThreadDto;
  currentThreadId?: string | undefined;
  currentWorkspaceId?: string | null | undefined;
  workspaceLabels?: Record<string, string>;
  onOpenThread: (threadId: string) => void;
  getThreadHref?: ((threadId: string) => string) | undefined;
  renderThreadLink?: ThreadWorkspaceLayoutProps["renderThreadLink"] | undefined;
  onBeginRenameThread?: ((thread: ThreadDto) => void) | undefined;
  onDeleteThread?: ((thread: ThreadDto) => void) | undefined;
  showDeleteButton?: boolean;
  showSessionCopyButton?: boolean;
  collapsed?: boolean;
}) {
  const { locale: i18nLocale } = useI18n();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const resetTimerRef = useRef<number | null>(null);
  const workspaceLabel = workspaceLabels[thread.workspaceId];
  const roomMetaLabel =
    workspaceLabel && !currentWorkspaceId ? workspaceLabel : null;
  const isCurrentThread = currentThreadId === thread.id;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopySessionId() {
    const sessionId = thread.providerSessionId;
    if (!sessionId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sessionId);
      setCopyState("copied");
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(
        () => setCopyState("idle"),
        1200,
      );
    } catch {
      setCopyState("failed");
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(
        () => setCopyState("idle"),
        1600,
      );
    }
  }

  const openThread = () => onOpenThread(thread.id);
  const cardClassName = `thread-graph-room-card group flex w-full items-center gap-3 rounded-xl border text-left transition ${
    isCurrentThread ? "is-active" : ""
  } ${collapsed ? "justify-center px-2 py-2" : "px-3 py-2.5"}`;
  const cardContent = (
    <>
      <div
        data-thread-status={thread.status}
        className={`thread-graph-room-card-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isCurrentThread ? "is-active" : ""
        }`}
      >
        {thread.status === "running" ? <LoaderCircle className="thread-room-running h-4 w-4" aria-label={translate("files.running")} /> : thread.status === "failed" ? <CircleAlert className="h-4 w-4" aria-label={translate("files.failed")} /> : <MessageSquare className="h-4 w-4" />}
      </div>
      <div
        className={`min-w-0 flex-1 ${
          collapsed ? "thread-desktop-collapsed-hidden" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <p
            className="thread-graph-room-card-title min-w-0 flex-1 truncate text-sm font-medium"
            title={thread.title}
          >
            {thread.title}
          </p>
          {onBeginRenameThread && !collapsed ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onBeginRenameThread(thread);
              }}
              aria-label={translate("files.renameThread", { value1: thread.title })}
              title={translate("files.renameThread_1ebf84")}
              className="thread-card-quiet-button inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition"
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : null}
          {showSessionCopyButton && thread.providerSessionId ? (
            <button
              type="button"
              aria-label={translate("files.copySessionID")}
              title={
                copyState === "copied"
                  ? translate("files.copied")
                  : copyState === "failed"
                    ? translate("files.copyFailed")
                    : translate("files.copySessionID")
              }
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                void handleCopySessionId();
              }}
              className="thread-card-quiet-button thread-card-session-copy-button inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition"
            >
              {copyState === "copied" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          {roomMetaLabel ? (
            <p
              className="thread-graph-room-card-meta min-w-0 flex-1 truncate text-[11px] text-[var(--theme-fg-muted)]"
              title={roomMetaLabel}
            >
              {roomMetaLabel}
            </p>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden="true" />
          )}
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-normal ${threadStatusClassName(thread.status)}`}
          >
            {threadStatusLabel(thread.status)}
          </span>
          <time
            className="shrink-0 text-[11px] text-[var(--theme-fg-muted)]"
            dateTime={thread.lastTurnStartedAt ?? thread.updatedAt}
          >
            {formatShortTimestamp(thread.lastTurnStartedAt ?? thread.updatedAt)}
          </time>
        </div>
      </div>
      {showDeleteButton && onDeleteThread && !collapsed ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onDeleteThread(thread);
          }}
          aria-label={translate("files.deleteThread", { value1: thread.title })}
          className="thread-card-danger-button shrink-0 rounded-full p-1 transition"
          title={translate("files.deleteThread_d6d95f")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </>
  );
  const href = getThreadHref?.(thread.id);

  const card = renderThreadLink ? renderThreadLink({
    thread, children: cardContent, className: cardClassName, onClick: openThread,
  }) : href ? (
    <a href={href} onClick={(event) => { event.preventDefault(); openThread(); }} className={cardClassName}>
      {cardContent}
    </a>
  ) : (
    <div role="link" tabIndex={0} onClick={openThread} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openThread(); }
    }} className={cardClassName}>{cardContent}</div>
  );
  return collapsed ? (
    <Tooltip delayDuration={180}>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} collisionPadding={12} className="thread-room-tooltip">
        <span className="block font-medium">{thread.title}</span>
        <span className="mt-1 block text-[11px] opacity-70">{threadStatusLabel(thread.status)}</span>
      </TooltipContent>
    </Tooltip>
  ) : card;
}

export function ThreadCards({
  threads,
  currentThreadId,
  currentWorkspaceId,
  workspaceLabels = {},
  onOpenThread,
  getThreadHref,
  renderThreadLink,
  onBeginRenameThread,
  onDeleteThread,
  scrollable = false,
  maxHeightClassName = "max-h-full",
  showDeleteButton = false,
  showSessionCopyButton = false,
  collapsed = false,
}: ThreadCardsProps) {
  const { locale: i18nLocale } = useI18n();
  const containerClassName = scrollable
    ? `min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 ${maxHeightClassName}`
    : "";

  return (
    <div className={containerClassName}>
      <div className="min-w-0 space-y-1">
        {threads.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            currentThreadId={currentThreadId}
            currentWorkspaceId={currentWorkspaceId}
            workspaceLabels={workspaceLabels}
            onOpenThread={onOpenThread}
            showDeleteButton={showDeleteButton}
            showSessionCopyButton={showSessionCopyButton}
            collapsed={collapsed}
            {...(getThreadHref ? { getThreadHref } : {})}
            {...(renderThreadLink ? { renderThreadLink } : {})}
            {...(onBeginRenameThread ? { onBeginRenameThread } : {})}
            {...(onDeleteThread ? { onDeleteThread } : {})}
          />
        ))}
      </div>
    </div>
  );
}

export function ThreadWorkspaceLayout({
  workbench,
  renderNavigationHeader,
  threads,
  status,
  loading = false,
  error,
  viewportConstrained = false,
  layoutMode = "responsive",
  effectiveTheme: effectiveThemeProp,
  themeMode: themeModeProp,
  onThemeModeChange,
  showMobileNewThreadShortcut = true,
  hideRoomsRail = false,
  settingsDialogOpen,
  onSettingsDialogOpenChange,
  mobileHeaderAction,
  currentThreadId,
  currentThreadLabel = null,
  currentWorkspaceId = null,
  currentWorkspaceLabel = null,
  harnessLabel = null,
  sessionLabel = null,
  usageLabel = null,
  threadActionsButton,
  topbarActions,
  deviceMonitor,
  metaContent,
  settingsContent,
  globalSettingsContent,
  settingsSections,
  restrictedNavigation = false,
  scopedSettings = false,
  workspaceLabels = {},
  workspaceReturnHref,
  onWorkspaceReturn,
  getThreadHref,
  onOpenThread,
  getNewThreadHref,
  newThreadHref: explicitNewThreadHref,
  newThreadLabel = translate("files.newChat"),
  onNewThread,
  onNewThreadTitle,
  renderNewThreadDialogContent,
  renderThreadLink,
  onCloseAppNavigation,
  onRenameThread,
  onDeleteThread,
  workspaceContent,
  workspaceTitle = translate("files.workspace"),
  workspaceActions,
  workspaceRevealRequestKey,
  children,
}: ThreadWorkspaceLayoutProps) {
  const { locale: i18nLocale } = useI18n();
  const shellNav = useAppShellNav();
  const initialShellMobileViewport =
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 639px)").matches
      : layoutMode === "mobile";
  const initialWorkspaceFocusViewport =
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : layoutMode === "mobile";
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );
  const themeMode = themeModeProp ?? shellNav?.themeMode ?? "system";
  const effectiveTheme =
    effectiveThemeProp ??
    shellNav?.effectiveTheme ??
    (themeMode === "system"
      ? systemPrefersDark
        ? "dark"
        : "light"
      : themeMode);
  const [mobileRoomsOpen, setMobileRoomsOpen] = useState(false);
  // The settings button moves between the phone dock's More sheet and the top
  // bar when the one-handed layout is switched from inside settings, which
  // remounts the dialog: keep it open, on the same section, from here.
  const [ownSettingsOpen, setOwnSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | undefined>();
  const settingsScroll = useRef(0);
  const settingsOpen = settingsDialogOpen ?? ownSettingsOpen;
  const changeSettingsOpen = (open: boolean) => {
    if (settingsDialogOpen === undefined) setOwnSettingsOpen(open);
    if (!open) { setSettingsSection(undefined); settingsScroll.current = 0; }
    onSettingsDialogOpenChange?.(open);
  };
  const [roomsRailCollapsed, setRoomsRailCollapsed] = useState(false);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(
    !initialWorkspaceFocusViewport,
  );
  const [isShellMobileViewport, setIsShellMobileViewport] = useState(
    initialShellMobileViewport,
  );
  const [isWorkspaceFocusViewport, setIsWorkspaceFocusViewport] = useState(
    initialWorkspaceFocusViewport,
  );
  const [mobileWorkspace, setMobileWorkspace] = useState<"chat" | "workspace">(
    "chat",
  );
  const [workspaceVisited, setWorkspaceVisited] = useState(false);
  useEffect(() => {
    if (mobileWorkspace === "workspace") setWorkspaceVisited(true);
  }, [mobileWorkspace]);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [createThreadDialogOpen, setCreateThreadDialogOpen] = useState(false);
  const [newThreadTitleDraft, setNewThreadTitleDraft] = useState("");
  const [creatingThread, setCreatingThread] = useState(false);
  const [topbarDetailsOpen, setTopbarDetailsOpen] = useState(false);

  useEffect(() => {
    if (workspaceRevealRequestKey === undefined) {
      return;
    }
    setWorkspaceCollapsed(false);
    setMobileWorkspace("workspace");
  }, [workspaceRevealRequestKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const handleViewportChange = () => {
      setIsShellMobileViewport(mediaQuery.matches);
    };

    handleViewportChange();
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const handleViewportChange = () => {
      setIsWorkspaceFocusViewport(mediaQuery.matches);
    };

    handleViewportChange();
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      setSystemPrefersDark(mediaQuery.matches);
    };

    handleSystemThemeChange();
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const visibleThreads = useMemo(() => {
    const scopedThreads = currentWorkspaceId
      ? threads.filter((thread) => thread.workspaceId === currentWorkspaceId)
      : threads;

    return [...scopedThreads].sort((left, right) => {
      if (left.id === currentThreadId) {
        return -1;
      }
      if (right.id === currentThreadId) {
        return 1;
      }

      const leftTimestamp = Date.parse(
        left.lastTurnStartedAt ?? left.updatedAt,
      );
      const rightTimestamp = Date.parse(
        right.lastTurnStartedAt ?? right.updatedAt,
      );
      return rightTimestamp - leftTimestamp;
    });
  }, [currentThreadId, currentWorkspaceId, threads]);

  const newThreadHref =
    explicitNewThreadHref ?? getNewThreadHref?.(currentWorkspaceId);
  const topbarWorkspaceLabel =
    currentWorkspaceLabel ?? currentWorkspaceId ?? translate("files.allWorkspaces");
  const topbarHarnessLabel = harnessLabel ?? translate("files.agent");
  const topbarSessionLabel =
    sessionLabel ?? currentThreadLabel ?? currentThreadId ?? "default_session";
  const topbarUsageLabel =
    usageLabel ??
    (status?.state ? `runtime ${status.state}` : translate("files.waitingForAgentUsage"));
  const setThemeMode = onThemeModeChange ?? shellNav?.setThemeMode;
  const canUpdateThemeMode = Boolean(setThemeMode);
  const closeNavigationSurfaces = () => {
    setMobileRoomsOpen(false);
    onCloseAppNavigation?.();
  };

  async function handleRenameThread(threadId: string) {
    if (!onRenameThread) {
      return;
    }

    const normalizedTitle = draftTitle.trim();
    if (!normalizedTitle) {
      return;
    }

    setRenamingThreadId(threadId);
    try {
      await onRenameThread(threadId, normalizedTitle);
      setEditingThreadId(null);
      setDraftTitle("");
    } finally {
      setRenamingThreadId(null);
    }
  }

  function beginRenameThread(thread: ThreadDto) {
    setEditingThreadId(thread.id);
    setDraftTitle(thread.title);
  }

  function cancelRenameThread() {
    setEditingThreadId(null);
    setDraftTitle("");
  }

  function openThread(threadId: string) {
    onOpenThread?.(threadId);
    closeNavigationSurfaces();
  }

  function closeCreateThreadDialog() {
    setCreateThreadDialogOpen(false);
    setNewThreadTitleDraft("");
  }

  function buildNewThreadHrefWithTitle(title: string) {
    if (!newThreadHref || !title.trim()) {
      return newThreadHref;
    }

    try {
      const url = new URL(newThreadHref, window.location.origin);
      url.searchParams.set("title", title.trim());
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      const separator = newThreadHref.includes("?") ? "&" : "?";
      return `${newThreadHref}${separator}title=${encodeURIComponent(title.trim())}`;
    }
  }

  async function handleCreateThreadFromDialog() {
    const title = newThreadTitleDraft.trim();
    setCreatingThread(true);

    try {
      if (title && onNewThreadTitle) {
        await onNewThreadTitle(title);
        setNewThreadTitleDraft("");
        setCreateThreadDialogOpen(false);
        closeNavigationSurfaces();
        return;
      }

      if (newThreadHref) {
        window.location.assign(
          buildNewThreadHrefWithTitle(title) ?? newThreadHref,
        );
        return;
      }

      await onNewThread?.();
      setNewThreadTitleDraft("");
      setCreateThreadDialogOpen(false);
      closeNavigationSurfaces();
    } finally {
      setCreatingThread(false);
    }
  }

  function renderNewThreadDialogButton(className: string, compact = false) {
    const content = compact ? (
      <>
        <Plus data-icon="new-thread" className="h-4 w-4" />
        <span className="sr-only">{newThreadLabel}</span>
      </>
    ) : (
      <>
        <Plus data-icon="new-thread" className="h-4 w-4" />
        <span>{newThreadLabel}</span>
      </>
    );

    return (
      <Dialog
        open={createThreadDialogOpen}
        onOpenChange={(open) => {
          if (!creatingThread) {
            setCreateThreadDialogOpen(open);
          }
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={compact ? newThreadLabel : undefined}
            title={newThreadLabel}
            className={className}
          >
            {content}
          </button>
        </DialogTrigger>
        <DialogContent
          data-testid="create-thread-dialog"
          data-theme-effective={effectiveTheme}
          data-theme-mode={themeMode}
          className="thread-graph-create-thread-dialog thread-graph-dialog max-h-[min(86vh,42rem)] overflow-hidden p-4 sm:max-w-[34rem]"
        >
          {renderNewThreadDialogContent ? (
            renderNewThreadDialogContent({
              close: closeCreateThreadDialog,
              closeNavigation: closeNavigationSurfaces,
              currentWorkspaceId,
            })
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{translate("files.createNewChat")}</DialogTitle>
                <DialogDescription>
                  {translate("files.nameTheRoomSoItIsEasy")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <input
                  id="thread-graph-create-thread-title"
                  name="thread-title"
                  value={newThreadTitleDraft}
                  onChange={(event) =>
                    setNewThreadTitleDraft(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateThreadFromDialog();
                    }
                  }}
                  placeholder={translate("files.chatName")}
                  aria-label={translate("files.chatName")}
                  autoComplete="off"
                  className="thread-graph-create-thread-input h-10 rounded-md border px-3 text-sm outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateThreadFromDialog()}
                  disabled={creatingThread}
                  className="thread-graph-create-thread-submit inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingThread ? translate("files.creating") : translate("files.create")}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  function renderSettingsDialog() {
    if (restrictedNavigation && !scopedSettings) return null;
    if (
      !settingsContent &&
      !metaContent &&
      !globalSettingsContent &&
      !settingsSections?.length &&
      !canUpdateThemeMode
    ) {
      return null;
    }

    const sections = [
      ...(settingsContent || metaContent ? [{ id: "session", label: translate("files.session"), description: translate("files.controlsAndDetailsForThisConversation"), content: <div className="space-y-5">{settingsContent}{metaContent && <details className="settings-detail"><summary>{translate("files.sessionDetails")}</summary><div>{metaContent}</div></details>}</div> }] : []),
      ...(settingsSections ?? (globalSettingsContent ? [{ id: "preferences", label: translate("files.preferences"), content: globalSettingsContent }] : [])),
    ];

    return (
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={changeSettingsOpen}
        section={settingsSection}
        onSectionChange={setSettingsSection}
        panelScroll={settingsScroll}
        themeMode={themeMode} effectiveTheme={effectiveTheme}
        contentProps={{ 'data-testid': 'settings-dialog' }}
        sections={sections}
        trigger={<button type="button" aria-label={translate("files.openSettings")} title={translate("files.settings")}
          className="thread-icon-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
          {workbench?.threadHeader
            ? <SlidersHorizontal data-icon="settings" className="h-4 w-4" />
            : <Settings data-icon="settings" className="h-4 w-4" />}
        </button>}
        extraContent={canUpdateThemeMode && !settingsSections ? (
            <div className="thread-graph-settings-card rounded-lg border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--theme-fg)]">
                    {translate("files.appearance")}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--theme-fg-muted)]">
                    {translate("files.currentTheme")} {effectiveTheme}
                  </p>
                </div>
                <div
                  className="thread-graph-theme-mode-group grid grid-cols-3 gap-1 rounded-lg border p-1"
                  role="group"
                  aria-label={translate("files.themeMode")}
                >
                  {THEME_MODE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = themeMode === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`theme-mode-${option.value}`}
                        aria-pressed={isSelected}
                        disabled={!canUpdateThemeMode}
                        onClick={() => setThemeMode?.(option.value)}
                        className={`thread-graph-theme-mode-button inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition ${
                          isSelected ? "is-selected" : ""
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
      />
    );
  }

  function renderRoomsRailContent(collapsed = false) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <section className="flex min-h-0 flex-1 flex-col">
          <div
            className={`mb-3 flex items-center gap-2 px-2 text-xs font-medium tracking-normal text-[var(--theme-fg-muted)] ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Rows3 className="h-3.5 w-3.5" />
            <span className={collapsed ? "sr-only" : ""}>{translate("files.rooms")}</span>
            {!collapsed && loading ? (
              <span className="ml-auto text-xs text-[var(--theme-fg-muted)]">
                {translate("files.refreshing")}</span>
            ) : null}
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-1">
            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-900 dark:text-rose-100">
                {error}
              </div>
            ) : null}

            {!error && visibleThreads.length === 0 && !loading ? (
              <div className="rounded-xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-6 text-sm text-[var(--theme-fg-muted)]">
                {translate("files.noThreadsAvailableInThisView")}</div>
            ) : null}

            {visibleThreads.length > 0 ? (
              <ThreadCards
                threads={visibleThreads}
                currentThreadId={currentThreadId}
                currentWorkspaceId={currentWorkspaceId}
                workspaceLabels={workspaceLabels}
                onOpenThread={openThread}
                collapsed={collapsed}
                {...(onRenameThread
                  ? { onBeginRenameThread: beginRenameThread }
                  : {})}
                showDeleteButton={Boolean(onDeleteThread)}
                {...(getThreadHref ? { getThreadHref } : {})}
                {...(renderThreadLink ? { renderThreadLink } : {})}
                {...(onDeleteThread ? { onDeleteThread } : {})}
              />
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  function renderWorkspacePanel() {
    if (workspaceContent) {
      return (
        <div className="thread-workspace-panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border">
          <button
            type="button"
            onClick={() => setWorkspaceCollapsed(true)}
            className="thread-workspace-collapse-tab thread-desktop-only-inline-flex"
            title={translate("files.collapseWorkspace")}
            aria-label={translate("files.collapseWorkspace")}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
          {workspaceActions ? (
            <div className="pointer-events-none absolute right-12 top-2 z-20 flex items-center gap-1">
              <div className="pointer-events-auto">{workspaceActions}</div>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden">
            {workspaceContent}
          </div>
        </div>
      );
    }

    return (
      <div className="thread-workspace-panel flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border">
        <div className="thread-workspace-panel-header flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--theme-border)] px-3 sm:h-[60px] sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--theme-fg)] sm:text-[18px]">
              {workspaceTitle}
            </p>
            <p className="truncate text-xs text-[var(--theme-fg-muted)]">
              {currentWorkspaceLabel ?? currentWorkspaceId ?? translate("files.currentContext")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {workspaceActions}
            <button
              type="button"
              onClick={() => setWorkspaceCollapsed(true)}
              className="thread-workspace-small-toggle thread-desktop-only-inline-flex"
              title={translate("files.collapseWorkspace")}
              aria-label={translate("files.collapseWorkspace")}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {workspaceContent ?? (
            <div className="grid h-full min-h-0 gap-3 overflow-y-auto p-3 text-sm text-[var(--theme-fg-soft)]">
              <div className="thread-workspace-card rounded-lg border p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--theme-fg-muted)]">
                  {translate("files.runtime")}</p>
                <p className="mt-2 text-[var(--theme-fg)]">
                  {status?.state ?? translate("files.unknown")}
                </p>
              </div>
              <div className="thread-workspace-card rounded-lg border p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--theme-fg-muted)]">
                  {translate("files.workspace")}</p>
                <p className="mt-2 break-words text-[var(--theme-fg)]">
                  {currentWorkspaceLabel ?? currentWorkspaceId ?? translate("files.allThreads")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const hasWorkspace = Boolean(workspaceContent);
  const renderMobileWorkspaceSplit =
    layoutMode === "mobile" ||
    (layoutMode === "responsive" && isShellMobileViewport);
  const renderWorkspaceFocusSplit =
    layoutMode === "mobile" ||
    (layoutMode === "responsive" && isWorkspaceFocusViewport);
  const renderMobileTopbarControls = renderMobileWorkspaceSplit;
  const canReturnToWorkspace = Boolean(
    !restrictedNavigation && (workspaceReturnHref || onWorkspaceReturn),
  );
  const workspaceReturnControl = canReturnToWorkspace ? (
    <a
      href={workspaceReturnHref ?? "#"}
      onClick={(event) => {
        if (onWorkspaceReturn) {
          event.preventDefault();
          onWorkspaceReturn();
        }
      }}
      className="thread-icon-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      title={translate("files.backToWorkspace")}
      aria-label={translate("files.backToWorkspace")}
    >
      <ArrowLeft className="h-4 w-4" />
    </a>
  ) : null;

  if (workbench) {
    return <GraphChatShellRoot effectiveTheme={effectiveTheme} layoutMode={layoutMode} themeMode={themeMode} viewportConstrained={viewportConstrained}>
      <MatterWorkbench options={{ ...workbench,
        renderNavigationHeader: workbench.renderNavigationHeader ?? renderNavigationHeader,
        // Hosts that rename and delete through the layout get the thread menu on rows and tabs.
        renderThreadMenu: workbench.renderThreadMenu ?? (onRenameThread || onDeleteThread ? (entry, context) => {
          const thread = threads.find(value => value.id === entry.key);
          if (!thread) return null;
          return <WorkbenchThreadMenu thread={entry} context={context} copyIdLabel={translate("files.copySessionID")}
            onNavigate={workbench.onNavigate}
            onRename={onRenameThread ? () => beginRenameThread(thread) : undefined}
            onDelete={onDeleteThread ? () => onDeleteThread(thread) : undefined} />;
        } : undefined),
      }} title={currentThreadLabel ?? (currentThreadId ? "" : translate("files.newThread"))} homeHref={restrictedNavigation ? undefined : workspaceReturnHref ?? '/workspaces'}
        settings={renderSettingsDialog()} newThread={renderNewThreadDialogButton('matter-new-thread', true)}
        actions={threadActionsButton} connection={topbarActions ?? mobileHeaderAction} deviceMonitor={deviceMonitor}
        threadMenu={null}
        explorer={workspaceContent} revealExplorer={workspaceRevealRequestKey ?? 0}>
        {children}
      </MatterWorkbench>
      <RenameDialog open={editingThreadId !== null} title={translate("files.renameThread_c51d25")} label={translate("files.threadTitle")} value={draftTitle} busy={renamingThreadId !== null} onChange={setDraftTitle} onCancel={cancelRenameThread} onSubmit={() => editingThreadId ? handleRenameThread(editingThreadId) : undefined} />
    </GraphChatShellRoot>;
  }

  return (
    <>
      <GraphChatShellRoot
        effectiveTheme={effectiveTheme}
        layoutMode={layoutMode}
        themeMode={themeMode}
        viewportConstrained={viewportConstrained}
      >
            <GraphChatTopbarShell>
              <div className="thread-topbar-row flex min-h-12 items-center px-3 py-1.5 sm:min-h-12 sm:px-4">
                <div className="flex w-full items-center justify-between gap-3 sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {!hideRoomsRail ? (
                      renderMobileTopbarControls ? (
                        <button
                          type="button"
                          aria-label={translate("files.openRooms")}
                          title={translate("files.openRooms")}
                          aria-expanded={mobileRoomsOpen}
                          onClick={() => setMobileRoomsOpen(true)}
                          className="thread-icon-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                        >
                          <PanelLeftOpen className="h-4 w-4" />
                        </button>
                      ) : renderSettingsDialog()
                    ) : null}
                    {workspaceReturnControl}
                    <div className="min-w-0">
                      <h1
                        className="min-w-0 truncate text-sm font-semibold leading-tight text-[var(--theme-fg)] sm:text-base"
                        title={currentThreadLabel ?? translate("files.sharedWorkspace")}
                      >
                        {currentThreadLabel ?? translate("files.sharedWorkspace")}
                      </h1>
                      <div className="relative mt-0.5 flex min-w-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTopbarDetailsOpen((open) => !open);
                          }}
                          aria-expanded={topbarDetailsOpen}
                          aria-haspopup="dialog"
                          className="thread-topbar-meta-row flex min-w-0 max-w-full items-center gap-1 text-left text-[11px] leading-none sm:text-xs"
                          title={translate("files.sessionAndUsage")}
                        >
                          <span className="shrink-0 font-medium text-[var(--theme-fg-soft)]">
                            {topbarHarnessLabel}
                          </span>
                          <span aria-hidden="true" className="shrink-0">
                            ·
                          </span>
                          <span className="truncate">
                            {topbarWorkspaceLabel}
                          </span>
                        </button>
                        {topbarDetailsOpen ? (
                          <div
                            className="thread-topbar-details-popover absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(28rem,calc(100vw-1.5rem))] rounded-lg border p-2.5 shadow-lg"
                            role="dialog"
                            aria-label={translate("files.sessionAndUsage")}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (!topbarSessionLabel) {
                                  return;
                                }
                                void navigator.clipboard?.writeText(
                                  topbarSessionLabel,
                                );
                              }}
                              className="thread-topbar-meta-row flex min-w-0 max-w-full items-center gap-2 text-left text-xs leading-5"
                              title={translate("files.copySessionID")}
                            >
                              <span className="w-14 shrink-0">{translate("files.session")}</span>
                              <span className="min-w-0 break-all font-mono">
                                {topbarSessionLabel}
                              </span>
                            </button>
                            <div
                              className="thread-topbar-meta-row mt-1 flex min-w-0 max-w-full items-start gap-2 text-xs leading-5"
                              title={translate("files.sessionTokenUsageAndEstimatedCost")}
                            >
                              <span className="w-14 shrink-0">{translate("files.usage")}</span>
                              <span className="min-w-0 whitespace-normal break-words font-mono">
                                {topbarUsageLabel}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="relative z-[1] inline-flex shrink-0 items-center gap-2">
                    {threadActionsButton || topbarActions ? (
                      <div className="thread-graph-topbar-actions thread-desktop-only-inline-flex items-center rounded-lg border p-0.5 shadow-none">
                        {threadActionsButton}
                        {topbarActions}
                      </div>
                    ) : null}
                    {renderMobileTopbarControls && threadActionsButton ? (
                      <div className="thread-mobile-only-inline-flex">
                        {threadActionsButton}
                      </div>
                    ) : null}
                    {renderWorkspaceFocusSplit && hasWorkspace ? (
                      <button
                        type="button"
                        onClick={() => {
                          setWorkspaceCollapsed(false);
                          setMobileWorkspace((current) =>
                            current === "workspace" ? "chat" : "workspace",
                          );
                        }}
                        aria-label={
                          mobileWorkspace === "workspace"
                            ? translate("files.showChat")
                            : translate("files.showWorkspace")
                        }
                        title={
                          mobileWorkspace === "workspace"
                            ? translate("files.showChat")
                            : translate("files.showWorkspace")
                        }
                        className="thread-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full"
                      >
                        {mobileWorkspace === "workspace" ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : (
                          <Folder className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                    {renderMobileTopbarControls ? mobileHeaderAction : null}
                    {renderMobileTopbarControls &&
                    showMobileNewThreadShortcut &&
                    !hideRoomsRail
                      ? renderNewThreadDialogButton(
                          "thread-secondary-action inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium sm:h-9",
                        )
                      : null}
                  </div>
                </div>
              </div>
            </GraphChatTopbarShell>
        <GraphChatShellFrame
          roomsRailCollapsed={roomsRailCollapsed}
          hideRoomsRail={hideRoomsRail}
        >
          {!hideRoomsRail ? (
            <GraphChatMobileScrim
              open={mobileRoomsOpen}
              onClose={() => setMobileRoomsOpen(false)}
            />
          ) : null}

          {!hideRoomsRail ? (
            <GraphChatRoomsRailShell
              collapsed={roomsRailCollapsed}
              mobileOpen={mobileRoomsOpen}
            >
            <div
              className={`thread-rooms-rail-header flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-end border-b border-[var(--theme-border)] px-4 pb-2 sm:h-16 sm:items-center sm:pb-0 ${
                roomsRailCollapsed ? "sm:w-full sm:justify-center sm:px-2" : ""
              }`}
            >
              <div
                className={`flex w-full items-center gap-3 ${
                  roomsRailCollapsed ? "sm:justify-center" : "justify-between"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {renderMobileTopbarControls ? renderSettingsDialog() : null}
                  <button
                    type="button"
                    onClick={() => setRoomsRailCollapsed((current) => !current)}
                    className="thread-icon-button thread-desktop-only-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    title={
                      roomsRailCollapsed ? translate("files.expandRooms") : translate("files.collapseRooms")
                    }
                    aria-label={
                      roomsRailCollapsed ? translate("files.expandRooms") : translate("files.collapseRooms")
                    }
                  >
                    {roomsRailCollapsed ? (
                      <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div
                  className={`flex shrink-0 items-center gap-1 ${
                    roomsRailCollapsed ? "thread-desktop-collapsed-hidden" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setMobileRoomsOpen(false)}
                    aria-label={translate("files.closeRooms")}
                    title={translate("files.closeRooms")}
                    className="thread-icon-button thread-mobile-only-inline-flex h-10 w-10 items-center justify-center rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`thread-graph-new-room-strip flex shrink-0 items-center border-b ${
                roomsRailCollapsed
                  ? "h-12 w-full justify-center px-2 sm:h-12"
                  : "h-[68px] px-4"
              }`}
            >
              {renderNewThreadDialogButton(
                `thread-graph-new-room-button inline-flex items-center justify-center rounded-xl font-medium transition ${
                  roomsRailCollapsed
                    ? "h-9 w-9 p-0"
                    : "h-11 w-full gap-2 px-3 text-sm sm:h-9"
                }`,
                roomsRailCollapsed,
              )}
            </div>

            <div
              className={`flex min-h-0 flex-1 flex-col ${
                roomsRailCollapsed ? "w-full px-2 py-2" : "px-3 py-3"
              }`}
            >
              {renderRoomsRailContent(roomsRailCollapsed)}
            </div>
            </GraphChatRoomsRailShell>
          ) : null}

          <GraphChatMainShell>


            <GraphChatSplitRegion>
              {hasWorkspace && !workspaceCollapsed ? (
                renderWorkspaceFocusSplit ? (
                  <div className="thread-split-container h-full min-h-0 overflow-hidden">
                    <div
                      className={`h-full min-h-0 overflow-hidden ${
                        mobileWorkspace === "chat"
                          ? "block"
                          : renderMobileWorkspaceSplit
                            ? "thread-mobile-chat-hidden"
                            : "hidden"
                      }`}
                    >
                      {children}
                    </div>
                    <div
                      className={`h-full min-h-0 overflow-hidden ${
                        mobileWorkspace === "workspace"
                          ? "block"
                          : renderMobileWorkspaceSplit
                            ? "thread-mobile-workspace-hidden"
                            : "hidden"
                      }`}
                    >
                      {(mobileWorkspace === "workspace" || workspaceVisited) ? renderWorkspacePanel() : null}
                    </div>
                  </div>
                ) : (
                  <ResizablePanelGroup
                    direction="horizontal"
                    className="thread-split-container thread-graph-shell-resizable thread-graph-shell-desktop-split h-full min-h-0 overflow-hidden"
                  >
                    <ResizablePanel
                      defaultSize={47}
                      minSize={30}
                      maxSize={75}
                      className="thread-split-chat-pane min-w-0 overflow-hidden"
                    >
                      {children}
                    </ResizablePanel>
                    <ResizableHandle className="thread-resize-handle w-2 bg-transparent after:w-px after:bg-slate-200/80 after:transition-colors hover:after:bg-slate-300 dark:after:bg-[#303642] dark:hover:after:bg-[#475063]" />
                    <ResizablePanel
                      defaultSize={53}
                      minSize={30}
                      maxSize={70}
                      className="thread-split-workspace-pane min-w-0 overflow-hidden"
                    >
                      {renderWorkspacePanel()}
                    </ResizablePanel>
                  </ResizablePanelGroup>
                )
              ) : (
                <div className="thread-split-container relative h-full min-h-0 overflow-hidden">
                  {hasWorkspace && workspaceCollapsed ? (
                    <button
                      type="button"
                      onClick={() => setWorkspaceCollapsed(false)}
                      className="thread-workspace-expand-fab thread-desktop-only-inline-flex"
                      title={translate("files.expandWorkspace")}
                      aria-label={translate("files.expandWorkspace")}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </button>
                  ) : null}
                  {children}
                </div>
              )}
            </GraphChatSplitRegion>
          </GraphChatMainShell>
        </GraphChatShellFrame>
      </GraphChatShellRoot>

      <RenameDialog
        open={editingThreadId !== null}
        title={translate("files.renameThread_c51d25")}
        label={translate("files.threadTitle")}
        value={draftTitle}
        busy={renamingThreadId !== null}
        onChange={setDraftTitle}
        onCancel={cancelRenameThread}
        onSubmit={() =>
          editingThreadId ? handleRenameThread(editingThreadId) : undefined
        }
      />
    </>
  );
}
