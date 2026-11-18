import type {
  AgentBackendToolboxItemSchemaDto,
  CollaborationModeDto,
  ModelOptionDto,
  ReasoningEffortDto,
  SandboxModeDto,
  ThreadContextUsageDto,
  ThreadForkTurnOptionDto,
  ThreadGoalDto,
  ThreadHooksDto,
  ThreadMcpServersDto,
  ThreadSkillsDto,
  UpdateThreadSettingsInput,
} from '@remote-codex/shared';

import type { ThreadShellControlState } from '../../types';
import type { ComposerModelPolicyProps } from './modelPolicy';
import {
  toolboxItemClassName,
  toolboxItemDisabled,
  toolboxItemStatus,
} from './composerToolbox';
import type {
  ComposerAttachmentMenuProps,
  ComposerSettingsToolbarProps,
  ComposerShellToolsPanelProps,
  ComposerSlashToolboxProps,
  ComposerToolbarProps,
} from './ComposerToolbar';
import type {
  HookScope,
  HooksPanelMode,
  McpPanelMode,
  SettingsMenu,
  SlashPanelState,
  SlashPanelView,
} from './types';

export interface ComposerToolbarCapabilities {
  hostConfigFiles: boolean;
  hookTrust: boolean;
  mcpConfigEditing: boolean;
  planMode: boolean;
  sandboxMode: boolean;
  forkFromTurn: boolean;
  /** A model chosen mid-turn applies from the turn's next model call. */
  liveModelSwitch?: boolean;
}

export interface UseComposerToolbarPropsInput {
  isShellView: boolean;
  attachmentCapabilities?: { files: boolean; images: boolean };
  canToggleShellView: boolean;
  isMobileShell: boolean;
  shellPromptLabel: string | null;
  openMenu: SettingsMenu;
  toolbarClassName: string;
  iconButtonClassName: string;
  menuClassName: string;
  menuItemClassName: string;
  panelButtonClassName: string;
  chipButtonClassName: string;
  inlineToggleClassName: string;
  sendButtonBaseClassName: string;
  slashPanelView: SlashPanelView;
  availableToolboxItems: AgentBackendToolboxItemSchemaDto[];
  busy: boolean;
  settingsBusy: boolean;
  compactBusy: boolean;
  forkBusy: boolean;
  forkError?: string | null;
  fastMode: boolean;
  goalComposeMode: boolean;
  goalBusy: boolean;
  goalStatus: ThreadGoalDto['status'] | undefined;
  activeView: 'chat' | 'shell';
  disabled: boolean;
  sendDisabled?: boolean;
  promptEmpty?: boolean;
  model: string | null | undefined;
  agent?: string | undefined;
  modelOptions: ModelOptionDto[];
  modelContextTitle: string;
  contextUsage: ThreadContextUsageDto | null | undefined;
  reasoningEffort: ReasoningEffortDto | null | undefined;
  supportedEfforts: ModelOptionDto['supportedReasoningEfforts'];
  displayedCollaborationMode: CollaborationModeDto;
  sandboxMode: SandboxModeDto | null | undefined;
  sendButtonLabel: string;
  sendButtonClassName: string;
  modelControlsDisabled: boolean;
  effortControlsDisabled: boolean;
  effortControlTitle: string;
  forkTurnOptionsState: SlashPanelState<ThreadForkTurnOptionDto[]>;
  skillsState: SlashPanelState<ThreadSkillsDto>;
  goalState: ComposerSlashToolboxProps['goalState'];
  goalHistory: ComposerSlashToolboxProps['goalHistory'];
  copiedSkillName: string | null;
  hooksPanelMode: HooksPanelMode;
  hooksState: SlashPanelState<ThreadHooksDto>;
  hookConfigBusy: boolean;
  hookConfigError: string | null;
  hookConfigSuccess: string | null;
  editingHookTarget: ComposerSlashToolboxProps['editingHookTarget'];
  hookScope: HookScope;
  hookEventName: ComposerSlashToolboxProps['hookEventName'];
  hookMatcher: string;
  hookCommand: string;
  hookTimeoutSec: string;
  hookStatusMessage: string;
  mcpPanelMode: McpPanelMode;
  mcpState: SlashPanelState<ThreadMcpServersDto>;
  mcpConfigPath: string | null;
  mcpConfigError: string | null;
  mcpConfigSuccess: string | null;
  mcpConfigBusy: boolean;
  mcpHttpName: string;
  mcpHttpUrl: string;
  mcpRawBlock: string;
  capabilities: ComposerToolbarCapabilities;
  /** What follows a typed `/`, filtering the toolbox; null when not opened by typing. */
  slashQuery?: string | null;
  slashActive?: number;
  shellControlState: ThreadShellControlState | null;
  onToggleView?: () => void;
  onDismissPromptFocus: () => void;
  onSetOpenMenu: ComposerToolbarProps['onSetOpenMenu'];
  onToolboxItemClick: ComposerSlashToolboxProps['onToolboxItemClick'];
  onSetSlashPanelView: ComposerSlashToolboxProps['onSetSlashPanelView'];
  onViewGoals?: ComposerSlashToolboxProps['onViewGoals'];
  onUpdateGoal: ComposerSlashToolboxProps['onUpdateGoal'];
  onOpenForkTurns: ComposerSlashToolboxProps['onOpenForkTurns'];
  onForkLatest: ComposerSlashToolboxProps['onForkLatest'];
  onForkTurn: ComposerSlashToolboxProps['onForkTurn'];
  onCopySkillInvokeName: ComposerSlashToolboxProps['onCopySkillInvokeName'];
  onResetHookForm: ComposerSlashToolboxProps['onResetHookForm'];
  onSetHooksPanelMode: ComposerSlashToolboxProps['onSetHooksPanelMode'];
  onClearHookConfigStatus: ComposerSlashToolboxProps['onClearHookConfigStatus'];
  onSetEditingHookTarget: ComposerSlashToolboxProps['onSetEditingHookTarget'];
  onSetHookScope: ComposerSlashToolboxProps['onSetHookScope'];
  onSetHookEventName: ComposerSlashToolboxProps['onSetHookEventName'];
  onSetHookMatcher: ComposerSlashToolboxProps['onSetHookMatcher'];
  onSetHookCommand: ComposerSlashToolboxProps['onSetHookCommand'];
  onSetHookTimeoutSec: ComposerSlashToolboxProps['onSetHookTimeoutSec'];
  onSetHookStatusMessage: ComposerSlashToolboxProps['onSetHookStatusMessage'];
  onSaveHook: ComposerSlashToolboxProps['onSaveHook'];
  onStartEditingHook: ComposerSlashToolboxProps['onStartEditingHook'];
  onTrustHook: ComposerSlashToolboxProps['onTrustHook'];
  onUntrustHook: ComposerSlashToolboxProps['onUntrustHook'];
  onSetMcpPanelMode: ComposerSlashToolboxProps['onSetMcpPanelMode'];
  onClearMcpConfigStatus: ComposerSlashToolboxProps['onClearMcpConfigStatus'];
  onSetMcpHttpName: ComposerSlashToolboxProps['onSetMcpHttpName'];
  onSetMcpHttpUrl: ComposerSlashToolboxProps['onSetMcpHttpUrl'];
  onSetMcpRawBlock: ComposerSlashToolboxProps['onSetMcpRawBlock'];
  onPrepareRawMcpBlock: ComposerSlashToolboxProps['onPrepareRawMcpBlock'];
  onSaveHttpMcp: ComposerSlashToolboxProps['onSaveHttpMcp'];
  onSaveRawMcpBlock: ComposerSlashToolboxProps['onSaveRawMcpBlock'];
  onPickPhoto: ComposerAttachmentMenuProps['onPickPhoto'];
  onPickFile: ComposerAttachmentMenuProps['onPickFile'];
  onUpdateSettings: (input: UpdateThreadSettingsInput) => void;
  /** Group model policy; replaces the flat model list in the model menu. */
  modelPolicy?: ComposerModelPolicyProps | null;
  onPasteShell: ComposerShellToolsPanelProps['onPaste'];
  onCopyShell: ComposerShellToolsPanelProps['onCopy'];
  onClearShell: ComposerShellToolsPanelProps['onClear'];
  onShellControl: ComposerShellToolsPanelProps['onShellControl'];
}

export function useComposerToolbarProps({
  isShellView,
  sendDisabled = false,
  attachmentCapabilities,
  canToggleShellView,
  isMobileShell,
  shellPromptLabel,
  openMenu,
  toolbarClassName,
  iconButtonClassName,
  menuClassName,
  menuItemClassName,
  panelButtonClassName,
  chipButtonClassName,
  inlineToggleClassName,
  sendButtonBaseClassName,
  slashPanelView,
  availableToolboxItems,
  busy,
  settingsBusy,
  compactBusy,
  forkBusy,
  forkError,
  fastMode,
  goalComposeMode,
  goalBusy,
  goalStatus,
  activeView,
  disabled,
  promptEmpty,
  model,
  agent,
  modelOptions,
  modelContextTitle,
  contextUsage,
  reasoningEffort,
  supportedEfforts,
  displayedCollaborationMode,
  sandboxMode,
  sendButtonLabel,
  sendButtonClassName,
  modelControlsDisabled,
  effortControlsDisabled,
  effortControlTitle,
  forkTurnOptionsState,
  skillsState,
  goalState,
  goalHistory,
  copiedSkillName,
  hooksPanelMode,
  hooksState,
  hookConfigBusy,
  hookConfigError,
  hookConfigSuccess,
  editingHookTarget,
  hookScope,
  hookEventName,
  hookMatcher,
  hookCommand,
  hookTimeoutSec,
  hookStatusMessage,
  mcpPanelMode,
  mcpState,
  mcpConfigPath,
  mcpConfigError,
  mcpConfigSuccess,
  mcpConfigBusy,
  mcpHttpName,
  mcpHttpUrl,
  mcpRawBlock,
  capabilities,
  slashQuery = null,
  slashActive = 0,
  shellControlState,
  onToggleView,
  onDismissPromptFocus,
  onSetOpenMenu,
  onToolboxItemClick,
  onSetSlashPanelView,
  onViewGoals,
  onUpdateGoal,
  onOpenForkTurns,
  onForkLatest,
  onForkTurn,
  onCopySkillInvokeName,
  onResetHookForm,
  onSetHooksPanelMode,
  onClearHookConfigStatus,
  onSetEditingHookTarget,
  onSetHookScope,
  onSetHookEventName,
  onSetHookMatcher,
  onSetHookCommand,
  onSetHookTimeoutSec,
  onSetHookStatusMessage,
  onSaveHook,
  onStartEditingHook,
  onTrustHook,
  onUntrustHook,
  onSetMcpPanelMode,
  onClearMcpConfigStatus,
  onSetMcpHttpName,
  onSetMcpHttpUrl,
  onSetMcpRawBlock,
  onPrepareRawMcpBlock,
  onSaveHttpMcp,
  onSaveRawMcpBlock,
  onPickPhoto,
  onPickFile,
  onUpdateSettings,
  modelPolicy = null,
  onPasteShell,
  onCopyShell,
  onClearShell,
  onShellControl,
}: UseComposerToolbarPropsInput): ComposerToolbarProps {
  // ElAgente: a host with no toolbox items and no plan mode (a scientific Agent)
  // shows no slash button, rather than a menu that only says nothing is available.
  const slashToolboxProps: ComposerSlashToolboxProps | null = isShellView ||
    (availableToolboxItems.length === 0 && !capabilities.planMode)
    ? null
    : {
        open: openMenu === 'slash',
        slashPanelView,
        slashQuery,
        slashActive,
        availableToolboxItems,
        planModeAvailable: capabilities.planMode,
        forkFromTurnAvailable: capabilities.forkFromTurn,
        displayedCollaborationMode,
        settingsBusy,
        busy,
        forkBusy,
        forkError,
        forkTurnOptionsState,
        skillsState,
        goalState,
        goalHistory,
        goalBusy,
        copiedSkillName,
        hooksPanelMode,
        hooksState,
        hostConfigFilesAvailable: capabilities.hostConfigFiles,
        hookTrustAvailable: capabilities.hookTrust,
        hookConfigBusy,
        hookConfigError,
        hookConfigSuccess,
        editingHookTarget,
        hookScope,
        hookEventName,
        hookMatcher,
        hookCommand,
        hookTimeoutSec,
        hookStatusMessage,
        mcpPanelMode,
        mcpState,
        mcpConfigEditing: capabilities.mcpConfigEditing,
        mcpConfigPath,
        mcpConfigError,
        mcpConfigSuccess,
        mcpConfigBusy,
        mcpHttpName,
        mcpHttpUrl,
        mcpRawBlock,
        iconButtonClassName,
        menuClassName,
        menuItemClassName,
        panelButtonClassName,
        chipButtonClassName,
        onToggle: () =>
          onSetOpenMenu((current) =>
            current === 'slash' ? null : 'slash',
          ),
        onToolboxItemClick,
        onUpdateSettings,
        toolboxItemDisabled: (item) =>
          toolboxItemDisabled(item, {
            settingsBusy,
            compactBusy,
            busy,
            forkBusy,
          }),
        toolboxItemClassName: (item) =>
          toolboxItemClassName(item, {
            fastMode,
            goalComposeMode,
            goalStatus,
            menuItemClassName,
          }),
        toolboxItemStatus: (item) =>
          toolboxItemStatus(item, {
            fastMode,
            compactBusy,
            goalComposeMode,
            goalStatus,
            busy,
          }),
        onSetSlashPanelView,
        onViewGoals,
        onUpdateGoal,
        onOpenForkTurns,
        onForkLatest,
        onForkTurn,
        onCopySkillInvokeName,
        onResetHookForm,
        onSetHooksPanelMode,
        onClearHookConfigStatus,
        onSetEditingHookTarget,
        onSetHookScope,
        onSetHookEventName,
        onSetHookMatcher,
        onSetHookCommand,
        onSetHookTimeoutSec,
        onSetHookStatusMessage,
        onSaveHook,
        onStartEditingHook,
        onTrustHook,
        onUntrustHook,
        onSetMcpPanelMode,
        onClearMcpConfigStatus,
        onSetMcpHttpName,
        onSetMcpHttpUrl,
        onSetMcpRawBlock,
        onPrepareRawMcpBlock,
        onSaveHttpMcp,
        onSaveRawMcpBlock,
      };

  const attachmentMenuProps: ComposerAttachmentMenuProps | null = isShellView || (attachmentCapabilities && !attachmentCapabilities.files && !attachmentCapabilities.images)
    ? null
    : {
        open: openMenu === 'attachments',
        canPickPhoto: attachmentCapabilities?.images ?? true,
        canPickFile: attachmentCapabilities?.files ?? true,
        iconButtonClassName,
        menuClassName,
        menuItemClassName,
        onToggle: () =>
          onSetOpenMenu((current) =>
            current === 'attachments' ? null : 'attachments',
          ),
        onPickPhoto,
        onPickFile,
      };

  const settingsToolbarProps: ComposerSettingsToolbarProps | null = isShellView
    ? null
    : {
        openMenu,
        model,
        agent,
        modelOptions,
        modelContextTitle,
        contextUsage,
        reasoningEffort,
        supportedEfforts,
        sandboxMode,
        sandboxModeAvailable: capabilities.sandboxMode,
        liveModelSwitch: capabilities.liveModelSwitch ?? false,
        settingsBusy,
        goalComposeMode,
        goalBusy,
        activeView,
        disabled,
        sendDisabled,
        ...(promptEmpty !== undefined ? { promptEmpty } : {}),
        fastMode,
        sendButtonLabel,
        sendButtonClassName,
        modelControlsDisabled,
        effortControlsDisabled,
        effortControlTitle,
        inlineToggleClassName,
        menuItemClassName,
        sendButtonBaseClassName,
        onSetOpenMenu,
        onUpdateSettings,
        modelPolicy,
      };

  const shellToolsPanelProps: ComposerShellToolsPanelProps | null =
    openMenu === 'shellTools'
      ? {
          busy,
          shellControlState,
          onPaste: onPasteShell,
          onCopy: onCopyShell,
          onClear: onClearShell,
          onShellControl,
        }
      : null;

  return {
    isShellView,
    canToggleShellView,
    isMobileShell,
    shellPromptLabel,
    openMenu,
    toolbarClassName,
    iconButtonClassName,
    slashToolboxProps,
    attachmentMenuProps,
    settingsToolbarProps,
    shellToolsPanelProps,
    shellControlState,
    onToggleView,
    onDismissPromptFocus,
    onSetOpenMenu,
  };
}
