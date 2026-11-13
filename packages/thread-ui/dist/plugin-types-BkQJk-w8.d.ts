import { ReactNode } from 'react';
import { ThreadHistoryItemDto, PluginDto, PluginManifestDto, ExtensionEnvelope, ExtensionDiscovery, ViewerInput, ViewerAcknowledgement, ThreadArtifactDto, ViewerRequest, ScientificTarget } from '@remote-codex/shared';

/** Host-owned callbacks. Runtime JSON cannot install frontend code. */
interface ExtensionHostAdapter {
    discovery: ExtensionDiscovery;
    submitInput?: (input: ViewerInput) => Promise<ViewerAcknowledgement>;
    /**
     * Optional (structure edits step 4, `structure/adopt`): publish an artifact
     * for a structure file revision that was never published, so it becomes an
     * editable target. `revision` is the file's sha256 as read. Resolves with the
     * published artifact, or nothing (it also arrives in the thread's artifact
     * list). Rejects with an Error whose `code` is one of `FILE_CONFLICT`,
     * `UNSUPPORTED_CAPABILITY`, `FILE_TOO_LARGE`, `INPUT_UNSUPPORTED`,
     * `INVALID_XYZ`, `TURN_BUSY` or `FILE_NOT_FOUND`. Hosts without it keep
     * the plain, view-only preview for such files.
     */
    adoptStructure?: (path: string, revision: string) => Promise<ThreadArtifactDto | void>;
    acknowledgeAction?: (request: ViewerRequest, acknowledgement: ViewerAcknowledgement) => Promise<void>;
}
interface ExtensionRenderContext {
    extension: ExtensionEnvelope<unknown>;
    host?: ExtensionHostAdapter;
}
interface ViewerToolbarContext {
    target: ScientificTarget;
    selectedIds: string[];
    host?: ExtensionHostAdapter;
}
interface ViewerToolbarContribution {
    id: string;
    label: string;
    capabilityId: string;
    render: (context: ViewerToolbarContext) => ReactNode;
}
interface ArtifactRenderContext {
    artifact: ThreadArtifactDto;
    expanded: boolean;
    presentation?: 'timeline' | 'workspace';
    onOpenFile?: () => void;
    onToggleExpanded: () => void;
    extensionHost?: ExtensionHostAdapter;
    /**
     * The object's display name (`structureDisplayName(...).label`, e.g.
     * "ethanol.xyz (edit 2)"); renderers show it instead of the revision's file
     * name and keep the file path as a tooltip.
     */
    displayName?: string;
}
interface InlineCodeRenderContext {
    code: string;
    isIncomplete: boolean;
    language: string;
    meta?: string;
}
interface ThreadPanelContribution {
    id: string;
    kind: string;
    label: string;
    capabilityId?: string;
    render?: (context: ExtensionRenderContext) => ReactNode;
}
interface PluginSettingsSnapshot {
    revision: number;
    values: Record<string, unknown>;
}
/** Wire formats a saved upstream connection can speak; not a model brand. */
type UpstreamConnectionProtocol = 'openai_chat' | 'openai_responses' | 'anthropic' | 'gemini';
interface UpstreamConnectionPickerValue {
    connectionId: string;
    model: string;
}
interface UpstreamConnectionPickerProps extends UpstreamConnectionPickerValue {
    /** Only connections speaking one of these protocols can be selected. */
    protocols?: UpstreamConnectionProtocol[];
    disabled?: boolean;
    onChange: (value: UpstreamConnectionPickerValue) => void;
}
/**
 * Optional host capability: the host renders its saved-connection selector, including
 * its own add/edit form. Selecting or saving a connection never applies it anywhere.
 */
interface UpstreamConnectionHost {
    renderPicker: (props: UpstreamConnectionPickerProps) => ReactNode;
}
interface PluginSettingsContext {
    pluginId: string;
    load: () => Promise<PluginSettingsSnapshot>;
    save: (settings: PluginSettingsSnapshot) => Promise<PluginSettingsSnapshot>;
    connections?: UpstreamConnectionHost;
    /** The device's (or conversation's) descriptor, for capability checks. */
    plugin?: PluginDto;
}
interface PluginSettingsContribution {
    id: string;
    label: string;
    description?: string;
    render: (context: PluginSettingsContext) => ReactNode;
}
interface MessagePresentationContext {
    item: ThreadHistoryItemDto;
    streaming: boolean;
}
interface PluginActionOutputContext {
    action: string;
    output: unknown;
}
/** An alternate body; the host keeps its existing markdown, expansion and copy controls. */
interface MessagePresentation {
    id: string;
    text: string;
    label: string;
    originalLabel: string;
    validate?: () => Promise<boolean>;
}
interface FrontendPluginModule {
    /** Historical receipts remain readable after disabling the plugin. */
    renderActionOutput?: (context: PluginActionOutputContext) => ReactNode | null;
    defaultEnabled?: boolean;
    presentMessage?: (context: MessagePresentationContext) => MessagePresentation | null;
    /** Available even when disabled so the plugin can be configured before enabling. */
    settingsSections?: PluginSettingsContribution[];
    /** Preferences kept in this browser, shown in settings only while the plugin is enabled. */
    browserSettingsSections?: Array<{
        id: string;
        readonly label: string;
        readonly description?: string;
        render: () => ReactNode;
    }>;
    manifest: PluginManifestDto;
    threadPanels?: ThreadPanelContribution[];
    viewerToolbar?: ViewerToolbarContribution[];
    renderExtension?: (context: ExtensionRenderContext) => ReactNode;
    renderArtifact?: (context: ArtifactRenderContext) => ReactNode;
    inlineCodeRenderers?: Array<{
        languages: string[];
        render: (context: InlineCodeRenderContext) => ReactNode | null;
    }>;
}
/** A plugin as one conversation sees it; `enabled` is the effective switch there. */
interface ThreadPluginDto extends PluginDto {
    globalEnabled: boolean;
    /** What following the device means here: the plugin's default for conversations. */
    defaultEnabled?: boolean;
    /** null follows the device: its switch and the plugin's default. */
    enabledOverride: boolean | null;
    settingsOverridden: boolean;
}
interface ThreadPluginSettingsSnapshot {
    revision: number;
    globalRevision: number;
    /** The conversation's own values; null inherits the device-wide ones. */
    enabled: boolean | null;
    values: Record<string, unknown> | null;
    effective: {
        enabled: boolean;
        values: Record<string, unknown>;
    };
}
interface ThreadPluginSettingsInput {
    revision: number;
    enabled: boolean | null;
    /** A complete override snapshot, not a patch; null inherits. */
    values: Record<string, unknown> | null;
}
/** Host access to one conversation's plugin scope. */
interface ThreadPluginAdapter {
    fetchPlugins: (threadId: string) => Promise<ThreadPluginDto[]>;
    loadSettings: (threadId: string, pluginId: string) => Promise<ThreadPluginSettingsSnapshot>;
    saveSettings: (threadId: string, pluginId: string, input: ThreadPluginSettingsInput) => Promise<ThreadPluginSettingsSnapshot>;
}

export type { ArtifactRenderContext as A, ExtensionHostAdapter as E, FrontendPluginModule as F, InlineCodeRenderContext as I, MessagePresentation as M, PluginActionOutputContext as P, ThreadPluginAdapter as T, UpstreamConnectionHost as U, ViewerToolbarContext as V, ExtensionRenderContext as a, MessagePresentationContext as b, PluginSettingsContext as c, PluginSettingsContribution as d, PluginSettingsSnapshot as e, ThreadPanelContribution as f, ThreadPluginDto as g, ThreadPluginSettingsInput as h, ThreadPluginSettingsSnapshot as i, UpstreamConnectionPickerProps as j, UpstreamConnectionPickerValue as k, UpstreamConnectionProtocol as l, ViewerToolbarContribution as m };
