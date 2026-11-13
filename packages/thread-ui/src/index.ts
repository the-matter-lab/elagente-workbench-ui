import './styles/base.css';
import './styles/timeline-shell.css';
import './styles/layout-workspace.css';
import './styles/history-markdown.css';
import './styles/composer-plan.css';
import './styles/export-dialog.css';
import './styles/matter-workbench.css';
import './styles/phone-dock.css';
import './styles/composer-compact.css';
import './styles/composer-reasoning.css';
import './styles/mermaid-diagrams.css';
import './styles/plugin-reports.css';
import './styles/live-structures.css';
import './styles/terminal-panel.css';
import './styles/transcript-log.css';
import './styles/thread-map.css';
import './styles/attachments.css';
import './styles/copy.css';
import './styles/touch.css';

export { CopyButton, useCopy } from './components/copy/CopyButton';
export { formatFileSize } from './components/attachments/attachmentFiles';
export { copyText } from './components/shell/terminalClipboard';
export { PathChip } from './components/copy/PathChip';
export { useMenuKeyboard } from './components/menu/useMenuKeyboard';
export { useModalFocus } from './components/menu/useModalFocus';
export { useLongPress } from './components/menu/useLongPress';
export { confirmAsync } from './components/menu/confirmAsync';
export { StatusMark, navigationStatusLabel } from './components/StatusMark';
export {
  LiveStructuresPanel,
  type LiveStructuresPanelProps,
} from './components/live-structures/LiveStructuresPanel';
export { LiveStructureFrameViewer } from './components/live-structures/LiveStructureFrameViewer';
export {
  LIVE_TRAJECTORY_UPDATE_MS,
  LiveTrajectoryPlayer,
  type LiveTrajectoryPlayerProps,
} from './components/live-structures/LiveTrajectoryPlayer';
export {
  deriveLiveStructureColumns,
  formatLiveStructureValue,
  LIVE_STRUCTURES_MAX_SELECTED,
  LIVE_STRUCTURES_PAGE_SIZE,
  liveStructureCell,
  liveStructureKey,
  liveStructurePageCount,
  liveStructureTrajectoryPath,
  sameLiveStructure,
  toggleLiveStructure,
  type LiveStructureColumn,
  type LiveStructureFrame,
  type LiveStructureKey,
  type LiveStructureProducer,
  type LiveStructureRow,
  type LiveStructureStatus,
  type LiveStructureStatusFilter,
  type LiveStructureSummary,
  type LiveStructureSummaryValue,
  type LiveStructureTotals,
  type LiveTrajectoryFrame,
} from './components/live-structures/liveStructures';

export type {
  DescribeThread,
  ShellSocketConnection,
  ShellSocketHandlers,
  ThreadDetailUiAdapter,
  ThreadLinkInfo,
  ThreadImageAssetVariant,
  ThreadShellAdapter,
  ThreadTimelineAdapter,
  ThreadToolArtifact,
  ThreadWorkspaceAdapter,
  ThreadWorkspaceCapabilities,
  ThreadWorkspaceArchiveFormat,
  ThreadWorkspaceTrashEntry,
  ThreadWorkspaceTrashList,
} from './adapters';
export type {
  PromptAttachmentUpload,
  SendPromptInput,
  ThreadShellControlState,
} from './types';

export {
  ThreadComposer,
  type ThreadComposerProps,
  type ComposerSendShortcut,
} from './components/ThreadComposer';
export { TurnClockContext, type TurnClock } from './components/timeline/turnStatus';
export type {
  ComposerModelPolicyProps,
  ModelPolicyDisplay,
  ModelPolicyGroupDto,
  ModelPolicyPresetDto,
  ModelPolicySelectionDto,
  ModelPolicyUpdateSelection,
  ModelPolicyViewDto,
} from './components/composer/modelPolicy';
export { TokenUsageCost, type TokenUsageCostProps } from './components/timeline/TokenUsageCost';
export {
  ThreadCards,
  ThreadWorkspaceLayout,
} from './components/ThreadWorkspaceLayout';
export {
  ThreadTimeline,
  type ThreadTimelineProps,
} from './components/ThreadTimeline';
export {
  ThreadShellPanel,
  type ThreadShellPanelHandle,
} from './components/ThreadShellPanel';
export {
  MemoizedThreadGraphWorkspacePanel,
  ThreadGraphWorkspacePanel,
  type ThreadGraphWorkspaceFeatures,
  type ThreadGraphWorkspacePanelProps,
  type WorkspaceHostPanel,
  type WorkspaceHostPanelRequest,
  type WorkspaceTab,
} from './components/ThreadGraphWorkspacePanelLazy';
export { ConfirmDialog } from './components/ConfirmDialog';
export { isStaleBuildError, RenderErrorBoundary, RenderErrorFallback } from './components/RenderErrorBoundary';
export {
  ExportTranscriptDialog,
  ThreadActionsDialog,
  type CreateThreadShareInput,
  type ThreadActionsDialogProps,
  type ThreadShareSummary,
} from './components/ExportTranscriptDialog';
export { LongTextDialog } from './components/LongTextDialog';
export {
  formatLongTimestamp,
  formatShortTimestamp,
  historyItemAccentClassName,
  historyItemLabel,
  threadStatusClassName,
  threadStatusLabel,
  turnStatusLabel,
} from './components/threadPresentation';
export { hasLikelyMarkdownSyntax } from './components/markdownHeuristics';
export {
  ThreadDetailSurface,
  type ThreadDetailSurfaceProps,
} from './ThreadDetailSurface';

export {
  createDefaultPluginContextValue,
  PluginContext,
  mergePluginState,
  type PluginContextValue,
} from './plugins/plugin-context';
export { PluginProvider } from './plugins/PluginProvider';
export { usePlugins } from './plugins/usePlugins';
export { PluginActionOutput } from './plugins/PluginActionOutput';
export { PluginSettingsButton } from './plugins/PluginSettingsButton';
export {
  ThreadPluginScope,
  useDevicePlugins,
} from './plugins/ThreadPluginScope';
export { ThreadPluginsControl } from './plugins/ThreadPluginsControl';
export type {
  ArtifactRenderContext,
  FrontendPluginModule,
  PluginSettingsSnapshot,
  PluginSettingsContext,
  PluginSettingsContribution,
  MessagePresentation,
  MessagePresentationContext,
  PluginActionOutputContext,
  InlineCodeRenderContext,
  ThreadPanelContribution,
  UpstreamConnectionHost,
  UpstreamConnectionPickerProps,
  UpstreamConnectionPickerValue,
  UpstreamConnectionProtocol,
  ThreadPluginAdapter,
  ThreadPluginDto,
  ThreadPluginSettingsInput,
  ThreadPluginSettingsSnapshot,
} from './plugins/plugin-types';
export type { PluginProviderAdapter } from './plugins/PluginProvider';
export {
  AppShellNavContext,
  useAppShellNav,
  type AgentBackendId,
  type AppShellNavContextValue,
  type PhoneHand,
  type ThemeMode,
} from './app-shell/AppShellNavContext';
export { PhoneHandChoice } from './app-shell/PhoneHandChoice';
export {
  AppShellMenuButton,
  AppShellNavigationMenu,
  AppShellSettingsDialog,
  type AppShellNavigationItem,
  type AppShellNavigationMenuProps,
  type AppShellSettingsDialogProps,
} from './app-shell/AppShellNavigation';
export type { MatterWorkbenchOptions, ThreadMenuContext, WorkbenchThread, WorkbenchNotification, WorkbenchToolPanel } from './components/MatterWorkbench';
export { MatterWorkbench } from './components/MatterWorkbench';
export { ThreadMap } from './components/threadMap/ThreadMap';
export { ThreadMapDialog } from './components/threadMap/ThreadMapDialog';
export type { ThreadMapDevice, ThreadMapPrice, ThreadMapThread, ThreadMapWorkspace } from './components/threadMap/model';
export { PublicTranscript, transcriptSnapshot, type PublicTranscriptSnapshot } from './components/PublicTranscript';

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/graph-ui/Dialog";
export { SettingsPanels, type SettingsSection } from './components/SettingsPanels';

export {createExtensionPluginApi, extensionModuleAvailable, type ExtensionPluginApi} from './plugins/extension-api';
export type {ExtensionHostAdapter, ExtensionRenderContext, ViewerToolbarContext, ViewerToolbarContribution} from './plugins/plugin-types';
export { structureDisplayName, type StructureDisplayName } from './components/graph-workspace/explorer/publishedStructureArtifact';


export { I18nProvider, LanguageSwitcher, useI18n, initializeI18n, getLocale, setLocale, translate, t, formatDate, formatNumber, normalizeLocale, detectLocale, LOCALE_STORAGE_KEY, LOCALE_OPTIONS, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n';
export type { Locale, TranslationKey, TranslationValues } from './i18n';
export {
  ConversationSearchScopePicker,
  ConversationSearchExcerpt,
  type ConversationSearchScope,
} from './components/ConversationSearchControls';

export type { WorkspaceDocumentSnapshot, WorkspaceDocumentSaveInput, WorkspaceSaveReceipt } from "./adapters";
export { confirmWorkspaceDocumentLeave } from "./components/graph-workspace/explorer/workspaceDocuments";
export { useWorkbenchPresentation } from "./components/workbench/presentation";
export type { WorkbenchPresentation, ReferenceMode } from "./components/workbench/presentation";
export type { WorkbenchPanelsOptions } from "./components/workbench/WorkbenchPanels";
export type { WorkbenchToolPanelControls } from "./components/workbench/toolPanel";

export { SettingsDialog } from './components/SettingsDialog';

export { createWorkspacePathResolver } from './components/workspacePathLinks';

export { GraphChatThreadChatPanel } from './components/graph-chat/GraphChatThreadChatPanel';

export { THEME_FEATURES, isThemeFeature, useThemeFeature, documentThemeFeatures, type ThemeFeature } from './components/themeHooks';
export { THEME_AGENT_KEY_PATTERN, themeAgentKey, themeAgentName, threadThemeAgentKey } from './components/themeAgent';
export { ThreadLoadingIndicator } from './components/ThreadLoadingIndicator';

export { TurnNotificationButton } from './components/timeline/TurnNotificationButton';
import './styles/notifications.css';
