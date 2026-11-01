import { ArtifactMetadata, ScientificTarget } from '@remote-codex/shared';
import { GLViewer } from '3dmol';

type ThreeDmolApi = {
    createViewer(element: HTMLElement, options?: Record<string, unknown>): GLViewer;
    /** Parses volumetric text (here Gaussian cube) once for several isosurfaces. */
    VolumeData?: new (data: string, format: string) => unknown;
};
declare global {
    interface Window {
        '3Dmol'?: ThreeDmolApi;
    }
}

type GraphMoleculeViewerSnapshot = {
    content: string[];
    format?: string | null;
    uuid?: string | null;
    name?: string | null;
    metadata?: ArtifactMetadata;
    target?: ScientificTarget;
    /** Immutable targets supplied by the producer, in trajectory order. */
    frameTargets?: ScientificTarget[];
    /**
     * Each XYZ `content` entry is exactly one frame, already validated: the
     * viewer uses the entries as its frames instead of re-splitting a growing
     * trajectory on every update.
     */
    framesSplit?: boolean;
};
type GraphMoleculeViewerSource = GraphMoleculeViewerSnapshot | string | null | undefined;
type GraphMoleculeViewerData = {
    format: string;
    frames: string[];
    exportContent: string;
};
declare function readGraphMoleculeViewerData(source: GraphMoleculeViewerSource): GraphMoleculeViewerData;

export { type GraphMoleculeViewerSource as G, type GraphMoleculeViewerSnapshot as a, readGraphMoleculeViewerData as r };
