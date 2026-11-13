import * as react from 'react';
import { ReactNode } from 'react';
import { ScientificTarget, ViewerRequest, ViewerAcknowledgement, ExtensionDiscovery } from '@remote-codex/shared';
import { E as ExtensionHostAdapter } from './plugin-types-C1Ip6feU.js';
import { G as GraphMoleculeViewerSource } from './GraphMoleculeViewerData-DHnrXMbl.js';
export { r as readGraphMoleculeViewerData } from './GraphMoleculeViewerData-DHnrXMbl.js';
import '3dmol';

type GraphMoleculeScreenshot = {
    version: 1;
    moleculeId: string | null;
    image: string;
    mediaType: 'image/png';
    width: number;
    height: number;
    target?: ScientificTarget;
    trajectoryIndex: number;
    camera: number[];
    selectedIds: string[];
};
type GraphMoleculeAtomSelection = {
    moleculeId: string | null;
    atoms: number[];
    selectedIds: string[];
    target?: ScientificTarget;
};
type GraphMoleculeSelectionSubmission = {
    selections: GraphMoleculeAtomSelection[];
};
type GraphMoleculeViewerHandle = {
    captureScreenshot: () => string;
    /** A detached snapshot of this mounted viewer's live personal state. */
    captureView: () => GraphMoleculeScreenshot;
    isAvailable: () => boolean;
    trajectoryIndex: number;
    target?: ScientificTarget;
    execute: (request: ViewerRequest) => Promise<ViewerAcknowledgement>;
};
/**
 * The viewer moved to a newer revision of the same object. `selection` says
 * what the §4.3 rule did with the user's selection and staged selections.
 */
type GraphMoleculeRevisionChange = {
    objectId: string;
    from: string;
    to: string;
    selection: 'kept' | 'cleared' | 'none';
};
declare const SELECTION_CLEARED_MESSAGE = "The structure changed. Select the atoms again.";
type GraphMoleculeViewerProps = {
    className?: string;
    presentation?: 'timeline' | 'workspace';
    onOpenFile?: () => void;
    moleculeId?: string | null;
    onScreenshot?: (screenshot: GraphMoleculeScreenshot) => void | Promise<void>;
    onSelectionChange?: (selection: GraphMoleculeAtomSelection) => void;
    onSelectionSubmit?: (selection: GraphMoleculeSelectionSubmission) => void | Promise<void>;
    onReady?: (view: GraphMoleculeViewerHandle) => void;
    /** Personal inspection signal; never a durable input or shared camera event. */
    onActive?: (view: GraphMoleculeViewerHandle) => void;
    /**
     * The host explains the change itself. Without it the viewer's status line
     * asks the user to reselect when the selection was cleared.
     */
    onRevisionChange?: (change: GraphMoleculeRevisionChange) => void;
    source: GraphMoleculeViewerSource;
    title?: string | null;
    extensionHost?: ExtensionHostAdapter;
    /** Build-time reviewed UI slots. Runtime data never selects executable code. */
    toolbar?: (context: {
        target?: ScientificTarget;
        selectedIds: string[];
    }) => ReactNode;
    rendererSlot?: (context: {
        target?: ScientificTarget;
        selectedIds: string[];
    }) => ReactNode;
    onDownloadSource?: () => void;
    loading?: boolean;
    /**
     * Shows LIVE beside the frame controls rather than under Scientific
     * actions, for a trajectory that is still growing.
     */
    followControl?: boolean;
};
declare function GraphMoleculeViewer({ className, moleculeId, onScreenshot, onSelectionChange, onSelectionSubmit, onReady, onActive, onRevisionChange, source, title, presentation, onOpenFile, extensionHost, toolbar, rendererSlot, onDownloadSource, loading, followControl, }: GraphMoleculeViewerProps): react.JSX.Element;

type ViewerStyle = 'ball-stick' | 'stick' | 'spacefill' | 'cartoon' | 'surface';
type ViewerAnnotation = {
    id: string;
    text: string;
    atomId: string;
    color?: string;
};
type ViewerCommand = {
    type: 'selection';
    selectedIds: string[];
    color?: string;
    radius?: number;
} | {
    type: 'style';
    style: ViewerStyle;
} | {
    type: 'camera';
    view: number[];
} | {
    type: 'annotations';
    annotations: ViewerAnnotation[];
} | {
    type: 'unit-cell';
    visible: boolean;
};
declare function sameScientificTarget(a: ScientificTarget | undefined, b: ScientificTarget | undefined): boolean;
declare function validateViewerCommands(value: unknown, atomIds: string[], styles: ViewerStyle[]): ViewerCommand[];
/** The executor receives reviewed data commands, never source or a viewer object. */
declare function createViewerCommandExecutor(getState: () => {
    target?: ScientificTarget;
    discovery?: ExtensionDiscovery;
    atomIds: string[];
    styles: ViewerStyle[];
    ready: boolean;
    cellAvailable?: boolean;
}, apply: (commands: ViewerCommand[]) => void | Promise<void>): (request: ViewerRequest) => Promise<ViewerAcknowledgement>;

export { type GraphMoleculeAtomSelection, type GraphMoleculeRevisionChange, type GraphMoleculeScreenshot, type GraphMoleculeSelectionSubmission, GraphMoleculeViewer, type GraphMoleculeViewerHandle, type GraphMoleculeViewerProps, SELECTION_CLEARED_MESSAGE, type ViewerAnnotation, type ViewerCommand, type ViewerStyle, createViewerCommandExecutor, sameScientificTarget, validateViewerCommands };
