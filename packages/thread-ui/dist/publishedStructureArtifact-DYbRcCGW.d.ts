import { ArtifactMetadata, ScientificTarget, ThreadArtifactDto } from '@remote-codex/shared';
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

interface StructureDisplayName {
    /** What to show: the origin name, with "(edit N)" for a revision in another file. */
    label: string;
    /** Basename of the path of the object's earliest published artifact. */
    originName: string;
    /** N in "(edit N)", or null when no hint is shown. */
    edit: number | null;
    /** The shown artifact's own workspace path, for a tooltip or details. */
    path: string | null;
}
/**
 * How a structure revision is named to the user (structure edits, UX a): by
 * its object's origin file, e.g. "ethanol.xyz (edit 2)", never by a revision's
 * hash-named file. N counts the object's artifacts after the first, in
 * publication order; a revision written back to the origin path needs no hint.
 */
declare function structureDisplayName(artifacts: readonly ThreadArtifactDto[], artifact: ThreadArtifactDto): StructureDisplayName;

export { type GraphMoleculeViewerSource as G, type StructureDisplayName as S, type GraphMoleculeViewerSnapshot as a, readGraphMoleculeViewerData as r, structureDisplayName as s };
