import { useFilePanel } from '../../workbench/FilePanelContext';
import { translate, useI18n } from '../../../i18n';
import {
  ArchiveRestore,
  Download,
  FileArchive,
  FileCode2,
  FolderInput,
  PackageOpen,
  FilePlus2,
  ListCollapse,
  Maximize2,
  Minus,
  MoreHorizontal,
  RefreshCw,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Upload,
  X,
  Check,
  Eye,
  ListTree,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';

import type { WorkspaceTreeNode } from '../workspaceTree';
import type { ThreadWorkspaceArchiveFormat } from '../../../adapters';
import { WorkspaceExplorerTree } from './WorkspaceExplorerTree';
import type { WorkspaceNodeActionProps } from './WorkspaceNodeActions';
import { useMenuKeyboard } from '../../menu/useMenuKeyboard';

const iconButtonClassName =
  'thread-graph-explorer-icon-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40';
const collapseButtonClassName =
  'thread-graph-explorer-collapse-button flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#222733] dark:hover:text-slate-100';

export function WorkspaceExplorerPanel({
  canEmptyGarbage,
  canUpload,
  pending,
  canImportArchive,
  archiveLimits,
  onImportArchive,
  onDownloadWorkspace,
  onDownloadWorkspaceZip,
  importFormats = ['tar'],
  downloadFormats = ['tar'],
  canTrash,
  onTrashFile,
  onOpenTrash,
  canDelete,
  canMove,
  onDeleteFile,
  onMoveFile,
  compactFolders,
  directoryErrors,
  expandedPaths,
  filterMode,
  filterQuery,
  initialLoading,
  loadingPaths,
  loading,
  liveNodes = [],
  onCollapseAll,
  onCopyPath,
  onDownload,
  onDownloadZip,
  canDownload,
  onRename,
  onDelete,
  onEmptyGarbage,
  onFilterModeChange,
  onFilterQueryChange,
  onPreview,
  onPin,
  onRefresh,
  onRetryDirectory,
  onSelect,
  onSelectNode,
  onToggle,
  onUpload,
  onCreateFile,
  showHidden,
  onShowHiddenChange,
  showThreadEvents,
  onShowThreadEventsChange,
  explorerScrollTopRef,
  explorerScrollerRef,
  selectedNodeId,
  revealRequestKey,
  tree,
  rootError,
  treeHidden = false,
  onToggleTree,
  renderBody,
}: {
  treeHidden?: boolean;
  onToggleTree?: () => void;
  renderBody?: (tree: ReactNode) => ReactNode;
  canEmptyGarbage?: boolean;
  canUpload?: boolean;
  pending?: boolean;
  canImportArchive?: boolean;
  archiveLimits?: string | undefined;
  onImportArchive?: () => void;
  onDownloadWorkspace?: () => void;
  onDownloadWorkspaceZip?: () => void;
  importFormats?: ThreadWorkspaceArchiveFormat[];
  downloadFormats?: ThreadWorkspaceArchiveFormat[];
  canTrash?: boolean;
  onTrashFile?: (() => void) | undefined;
  onOpenTrash?: (() => void) | undefined;
  canDelete?: boolean;
  canMove?: boolean;
  onDeleteFile?: (() => void) | undefined;
  onMoveFile?: () => void;
  compactFolders?: boolean;
  directoryErrors?: ReadonlyMap<string, string>;
  expandedPaths: ReadonlySet<string>;
  filterMode: 'highlight' | 'filter';
  filterQuery: string;
  initialLoading?: boolean;
  loadingPaths: ReadonlySet<string>;
  loading?: boolean;
  liveNodes?: WorkspaceTreeNode[];
  onCollapseAll: () => void;
  onDownload?: (node: WorkspaceTreeNode) => void;
  onDownloadZip?: (node: WorkspaceTreeNode) => void;
  canDownload?: (node: WorkspaceTreeNode) => boolean;
  onEmptyGarbage?: () => void;
  onFilterModeChange: (mode: 'highlight' | 'filter') => void;
  onFilterQueryChange: (query: string) => void;
  onPreview?: (node: WorkspaceTreeNode) => void;
  onPin?: (node: WorkspaceTreeNode) => void;
  onRefresh?: () => void;
  onRetryDirectory?: (path: string) => void;
  onSelect: (nodeId: string) => void;
  onSelectNode?: (node: WorkspaceTreeNode) => void;
  onToggle: (path: string) => void;
  onUpload?: () => void;
  /** Present when the host can list entries its visibility rules hide. */
  showHidden?: boolean;
  onShowHiddenChange?: (value: boolean) => void;
  /** Debug view of internal tool-call and reasoning records; hidden by default. */
  showThreadEvents?: boolean;
  onShowThreadEventsChange?: (value: boolean) => void;
  onCreateFile?: () => void;
  explorerScrollTopRef: MutableRefObject<number>;
  explorerScrollerRef: MutableRefObject<HTMLDivElement | null>;
  selectedNodeId: string | null;
  revealRequestKey?: number | undefined;
  tree: WorkspaceTreeNode;
  rootError?: string | null;
} & WorkspaceNodeActionProps) {
  useI18n();
  const filePanel = useFilePanel();
  const visibleTree = useMemo(
    () => ({
      ...tree,
      // Live artifacts have their own list; published artifacts (ELA-260) open
      // from Inspect and links only, never as a second copy of the files.
      children: tree.children.filter((node) => node.id !== 'live' && node.id !== 'artifacts'),
    }),
    [tree],
  );
  const [filterOpen, setFilterOpen] = useState(Boolean(filterQuery));
  const [filterResult, setFilterResult] = useState({
    matchCount: 0,
    hasUnresolvedDirectories: false,
  });
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const openFilter = useCallback(() => setFilterOpen(true), []);
  const handleFilterResultsChange = useCallback(
    (result: { matchCount: number; hasUnresolvedDirectories: boolean }) =>
      setFilterResult(result),
    [],
  );

  useEffect(() => {
    if (filterOpen && !treeHidden) {
      const frame = window.requestAnimationFrame(() => filterInputRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
  }, [filterOpen, treeHidden]);

  function closeFilter() {
    onFilterQueryChange('');
    setFilterOpen(false);
  }

  const treeBody = (<>
      {filterOpen ? (
        <div className="thread-graph-explorer-filter shrink-0 border-b border-[var(--theme-border)] px-3 py-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex w-full min-w-0 items-center gap-2 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" />
              <input
                ref={filterInputRef}
                value={filterQuery}
                onChange={(event) =>
                  onFilterQueryChange(event.currentTarget.value)
                }
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    if (filterQuery) {
                      onFilterQueryChange('');
                    } else {
                      closeFilter();
                    }
                  }
                }}
                className="h-8 min-w-0 flex-1 bg-transparent text-sm text-[var(--theme-fg)] outline-none"
                placeholder={translate("files.filterLoadedFiles")}
                aria-label={translate("files.filterWorkspaceFiles")}
              />
              <button
                type="button"
                onClick={closeFilter}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--theme-fg-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]"
                title={translate("files.closeFilter")}
                aria-label={translate("files.closeFilter")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              className="thread-graph-explorer-filter-mode inline-flex shrink-0 self-end rounded-md border border-[var(--theme-border)] p-0.5"
              role="group"
              aria-label={translate("files.explorerFilterMode")}
            >
              {(['filter', 'highlight'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onFilterModeChange(mode)}
                  className={`h-7 rounded px-2 text-xs ${filterMode === mode ? 'is-active' : ''}`}
                  aria-pressed={filterMode === mode}
                  title={
                    mode === 'filter'
                      ? translate("files.showMatchesOnly")
                      : translate("files.highlightMatches")
                  }
                >
                  {mode === 'filter' ? translate("files.filter") : translate("files.highlight")}
                </button>
              ))}
            </div>
          </div>
          {filterQuery ? (
            <div
              className="mt-1.5 text-xs text-[var(--theme-fg-muted)]"
              aria-live="polite"
            >
              {filterResult.matchCount}{' '}
              {filterResult.matchCount === 1 ? translate("files.match") : translate("files.matches")}
              {filterResult.hasUnresolvedDirectories
                ? translate("files.inLoadedFolders")
                : ''}
            </div>
          ) : null}
        </div>
      ) : null}

      {liveNodes.length > 0 ? (
        <div className="shrink-0 border-b border-slate-200 py-2 dark:border-[#2a2f3a]">
          <div className="thread-graph-workspace-label px-3 pb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {translate("files.live")}</div>
          {liveNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              data-testid="live-molecule-item"
              data-molecule-id={node.artifact?.id ?? node.id}
              onClick={() => onSelect(node.id)}
              className={`thread-graph-tree-row flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm transition sm:min-h-7 sm:py-1 ${selectedNodeId === node.id ? 'is-selected' : ''}`}
            >
              <FileCode2 className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {initialLoading ? (
        <div
          className="workspace-loading-skeleton flex-1 space-y-1 px-3 py-2"
          role="status"
          aria-label={translate("files.loadingWorkspaceFiles")}
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="h-7 animate-pulse rounded bg-[var(--theme-surface-strong)] motion-reduce:animate-none"
              style={{ width: `${72 - index * 6}%` }}
            />
          ))}
        </div>
      ) : rootError ? (
        <div role="alert" className="mx-3 mt-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-3 text-sm text-rose-700 dark:text-rose-200">
          <p>{rootError}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-2 h-8 rounded px-2 font-medium hover:bg-rose-500/10"
          >
            {translate("files.retry")}</button>
        </div>
      ) : (
        <WorkspaceExplorerTree
          tree={visibleTree}
          expandedPaths={expandedPaths}
          filterMode={filterMode}
          filterQuery={filterQuery}
          compactFolders={compactFolders}
          directoryErrors={directoryErrors}
          loadingPaths={loadingPaths}
          selectedNodeId={selectedNodeId}
          revealRequestKey={revealRequestKey}
          scrollerRef={explorerScrollerRef}
          scrollTopRef={explorerScrollTopRef}
          {...(onCopyPath ? { onCopyPath } : {})}
          {...(onRename ? { onRename } : {})}
          {...(onDelete ? { onDelete } : {})}
          {...(onDownload ? { onDownload } : {})}
          {...(onDownloadZip ? { onDownloadZip } : {})}
          {...(canDownload ? { canDownload } : {})}
          onOpenFilter={openFilter}
          onFilterResultsChange={handleFilterResultsChange}
          {...(onPreview ? { onPreview } : {})}
          {...(onPin ? { onPin } : {})}
          {...(onRetryDirectory ? { onRetryDirectory } : {})}
          onSelect={(node) => {
            onSelect(node.id);
            onSelectNode?.(node);
          }}
          onToggle={onToggle}
        />
      )}
      {!initialLoading &&
      !rootError &&
      filterQuery &&
      filterMode === 'filter' &&
      filterResult.matchCount === 0 ? (
        <p className="thread-graph-workspace-empty mx-4 mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-[#303642] dark:bg-[#1b1f29] dark:text-slate-400">
          {translate("files.noMatchesInLoadedFolders")}</p>
      ) : visibleTree.children.length === 0 ? (
        <p className="thread-graph-workspace-empty mx-4 mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-[#303642] dark:bg-[#1b1f29] dark:text-slate-400">
          {translate("files.thisWorkspaceIsEmptyAgentToolRuns")}</p>
      ) : null}

  </>);

  return (
    <aside className="thread-graph-explorer flex h-full min-h-0 flex-col overflow-hidden rounded-md">
      <div title={filePanel?.label} className="thread-graph-explorer-header flex h-9 shrink-0 items-center justify-between border-b px-2">
        <h2 className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">
          {translate("files.explorer")}</h2>
        <div className="thread-graph-explorer-toolbar flex items-center gap-1">
          {/* Window controls, as on a Mac: close the files view, or minimize it to its tree. */}
          {filePanel?.setMinimized ? (
            <span className="thread-graph-window-controls">
              <button type="button" data-testid="workbench-close-files" className="is-close" onClick={filePanel.close}
                aria-label={translate('workbench.closeFiles')} title={translate('workbench.closeFiles')}><X aria-hidden="true" /></button>
              <button type="button" className="is-minimize" aria-pressed={Boolean(filePanel.minimized)}
                onClick={() => filePanel.setMinimized?.(!filePanel.minimized)}
                aria-label={translate(filePanel.minimized ? 'workbench.restoreFiles' : 'workbench.minimizeFiles')}
                title={translate(filePanel.minimized ? 'workbench.restoreFiles' : 'workbench.minimizeFiles')}>{filePanel.minimized ? <Maximize2 aria-hidden="true" /> : <Minus aria-hidden="true" />}</button>
            </span>
          ) : filePanel && <button type="button" data-testid="workbench-close-files" className={iconButtonClassName} onClick={filePanel.close} aria-label={translate('workbench.closeFiles')} title={translate('workbench.closeFiles')}><X data-icon="close" size={16} /></button>}
          {onCreateFile && <button type="button" onClick={onCreateFile}
            className={iconButtonClassName} title={translate('files.newFile')}
            aria-label={translate('files.newFile')}>
            <FilePlus2 data-icon="new-file" className="h-4 w-4" />
          </button>}
          <button
            type="button"
            onClick={() => { if (treeHidden) onToggleTree?.(); openFilter(); }}
            className={iconButtonClassName}
            title={translate("files.filterWorkspace")}
            aria-label={translate("files.filterWorkspace")}
            aria-pressed={filterOpen}
          >
            <Search data-icon="filter" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            className={iconButtonClassName}
            title={translate("files.collapseFolders")}
            aria-label={translate("files.collapseFolders")}
          >
            <ListCollapse data-icon="collapse-folders" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={!onRefresh || pending}
            className={iconButtonClassName}
            title={translate("files.refreshWorkspace")}
            aria-label={translate("files.refreshWorkspace")}
          >
            <RefreshCw
              data-icon="refresh"
              className={`h-4 w-4 motion-reduce:animate-none ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          {canUpload || onDownloadWorkspace || onDownloadWorkspaceZip ||
          (onImportArchive && canImportArchive) || onTrashFile || onOpenTrash ||
          onMoveFile || onDeleteFile || onEmptyGarbage || onShowHiddenChange || onShowThreadEventsChange ? (
            <ExplorerMoreMenu triggerClassName={iconButtonClassName}>
              {(close) => <>
                {onShowHiddenChange ? (
                  <button type="button" role="menuitemcheckbox" aria-checked={Boolean(showHidden)}
                    onClick={() => { close(); onShowHiddenChange(!showHidden); }}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none">
                    <Eye data-icon="show-hidden" className="h-4 w-4" />
                    <span className="flex-1">{translate("files.showHiddenFiles")}</span>
                    {showHidden ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                  </button>
                ) : null}
                {onShowThreadEventsChange ? (
                  <button type="button" role="menuitemcheckbox" aria-checked={Boolean(showThreadEvents)}
                    onClick={() => { close(); onShowThreadEventsChange(!showThreadEvents); }}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none">
                    <ListTree data-icon="show-thread-events" className="h-4 w-4" />
                    <span className="flex-1">{translate("files.showThreadEvents")}</span>
                    {showThreadEvents ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                  </button>
                ) : null}
                {(onShowHiddenChange || onShowThreadEventsChange) && (canUpload || onDownloadWorkspace || onDownloadWorkspaceZip || onImportArchive || onMoveFile || onTrashFile || onOpenTrash || onDeleteFile || onEmptyGarbage) ? <div role="separator" className="my-1 border-t border-[var(--theme-border)]" /> : null}
                {canUpload ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { close(); onUpload?.(); }}
                    disabled={pending}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none"
                  >
                    <Upload data-icon="upload" className="h-4 w-4" />
                    {translate("files.uploadFile")}</button>
                ) : null}
                {/* ElAgente workspace operations, each gated by the host's advertised capabilities. */}
                {onDownloadWorkspace && downloadFormats.includes('tar') ? (
                  <button type="button" role="menuitem" onClick={() => { close(); onDownloadWorkspace(); }}
                    disabled={pending || (canDownload ? !canDownload(tree) : false)}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50">
                    <Download data-icon="download" className="h-4 w-4" />Download workspace (TAR)</button>
                ) : null}
                {onDownloadWorkspaceZip && downloadFormats.includes('zip') ? (
                  <button type="button" role="menuitem" onClick={() => { close(); onDownloadWorkspaceZip(); }}
                    disabled={pending || (canDownload ? !canDownload(tree) : false)}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50">
                    <FileArchive data-icon="download-zip" className="h-4 w-4" />Download workspace (ZIP)</button>
                ) : null}
                {onImportArchive && canImportArchive && importFormats.length > 0 ? (
                  <button type="button" role="menuitem" onClick={() => { close(); onImportArchive(); }} disabled={pending}
                    title={`${importFormats.map((format) => format.toUpperCase()).join(' / ')}. ${archiveLimits ?? 'Extraction limits are enforced by the server.'} Regular uploads store archive bytes without extraction.`}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50">
                    <PackageOpen data-icon="import-archive" className="h-4 w-4" />{importFormats.includes('zip') ? 'Import archive' : 'Import TAR archive'}</button>
                ) : null}
                {(canUpload || onDownloadWorkspace || onDownloadWorkspaceZip || onImportArchive) && (onMoveFile || onTrashFile || onOpenTrash || onDeleteFile || onEmptyGarbage) ? <div role="separator" className="my-1 border-t border-[var(--theme-border)]" /> : null}
                {onMoveFile ? (
                  <button type="button" role="menuitem" onClick={() => { close(); onMoveFile(); }} disabled={pending || !canMove}
                    title={canMove ? 'Move selected file to a new path' : 'Select a workspace file first.'}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50">
                    <FolderInput data-icon="move" className="h-4 w-4" />Move selected file</button>
                ) : null}
                {onTrashFile ? (
                  <button type="button" role="menuitem" onClick={() => { close(); onTrashFile(); }} disabled={pending || !canTrash}
                    title={canTrash ? 'Move the selected file to Trash' : 'Select a workspace file first.'}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50">
                    <Trash2 data-icon="trash" className="h-4 w-4" />Move selected file to Trash</button>
                ) : null}
                {onOpenTrash ? (
                  <button type="button" role="menuitem" onClick={() => { close(); onOpenTrash(); }} disabled={pending}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50">
                    <ArchiveRestore data-icon="open-trash" className="h-4 w-4" />Trash</button>
                ) : null}
                {onDeleteFile ? (
                  <button type="button" role="menuitem" onClick={() => { close(); onDeleteFile(); }} disabled={pending || !canDelete}
                    title={canDelete ? 'Confirm permanent deletion of selected file' : 'Select a workspace file first.'}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-rose-600 hover:bg-rose-500/10 focus-visible:bg-rose-500/10 focus-visible:outline-none disabled:opacity-50 dark:text-rose-300">
                    <Trash2 data-icon="delete" className="h-4 w-4" />Delete selected file…</button>
                ) : null}
                {onEmptyGarbage ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { close(); onEmptyGarbage(); }}
                    disabled={pending || !canEmptyGarbage}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-rose-600 hover:bg-rose-500/10 focus-visible:bg-rose-500/10 focus-visible:outline-none disabled:opacity-50 dark:text-rose-300"
                  >
                    <Trash2 data-icon="delete" className="h-4 w-4" />
                    {translate("files.emptyGarbage_b701de")}</button>
                ) : null}
              </>}
            </ExplorerMoreMenu>
          ) : null}
          {onToggleTree ? (
            <span className="ml-1 border-l border-[var(--theme-border)] pl-1">
              <button type="button" data-testid="toggle-explorer-tree" onClick={onToggleTree}
                className={collapseButtonClassName} aria-pressed={!treeHidden}
                title={translate(treeHidden ? 'files.showTree' : 'files.hideTree')}
                aria-label={translate(treeHidden ? 'files.showTree' : 'files.hideTree')}>
                {treeHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </span>
          ) : null}
        </div>
      </div>

      {renderBody ? renderBody(treeBody) : treeBody}
    </aside>
  );
}

/** The tree toolbar's ⋯: a menu like the others (arrows, Esc closes only the
    menu and returns to ⋯, a click outside or a chosen item closes it). */
function ExplorerMoreMenu({ triggerClassName, children }: {
  triggerClassName: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = (restore = false) => { setOpen(false); if (restore) trigger.current?.focus(); };
  useMenuKeyboard(menu, open, close);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div className="thread-graph-explorer-more relative">
      <button ref={trigger} type="button" className={triggerClassName} aria-haspopup="menu" aria-expanded={open}
        title={translate("files.moreExplorerActions")} aria-label={translate("files.moreExplorerActions")}
        onClick={() => setOpen(value => !value)}>
        <MoreHorizontal data-icon="more" className="h-4 w-4" />
      </button>
      {open ? (
        <div ref={menu} role="menu" aria-label={translate("files.moreExplorerActions")}
          className="absolute right-0 top-7 z-40 min-w-44 rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1 shadow-lg">
          {children(() => close(true))}
        </div>
      ) : null}
    </div>
  );
}
