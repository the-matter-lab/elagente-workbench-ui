import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  Ruler,
  Waypoints,
  RotateCcw,
  HelpCircle,
  Download,
  Pin,
  X,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ArtifactMetadata,
  ScientificTarget,
  ViewerRequest,
  ViewerAcknowledgement,
} from '@remote-codex/shared';
import type { ExtensionHostAdapter } from '../../plugins/plugin-types';
import {
  createViewerCommandExecutor,
  sameScientificTarget,
  type ViewerCommand,
  type ViewerStyle,
  type ViewerAnnotation,
} from './GraphMoleculeViewerCommands';
import GraphMoleculeViewerLowerButtonGroup from './GraphMoleculeViewerLowerButtonGroup';
import GraphMoleculeViewerUpperButtonGroup from './GraphMoleculeViewerUpperButtonGroup';
import { GraphMoleculeRepresentationMenu } from './GraphMoleculeRepresentationMenu';
import type { GraphMoleculeCameraInfo } from './GraphMoleculeViewerControls';
import { GraphMoleculeFigureFrame } from './GraphMoleculeFigureFrame';
import { createMoleculeRenderViewer } from './GraphMoleculeViewerLifetime';
import { bindPinchZoom } from './moleculePinchZoom';
import { downloadTextFile } from './GraphMoleculeViewerControls';
import {
  measureAtoms,
  moleculeFormula,
  type MoleculeMeasurement,
} from './GraphMoleculeMeasurements';
import type {
  RenderModel,
  RenderViewer,
} from './GraphMoleculeViewerRenderTypes';
import { load3Dmol, type GLViewer, type ThreeDmolApi } from './load3Dmol';
import { translate, useI18n } from '../../i18n';
import {
  CUBE_NEGATIVE_COLOR,
  CUBE_POSITIVE_COLOR,
  CubeFormatError,
  DEFAULT_CUBE_ISOVALUE,
  DEFAULT_CUBE_OPACITY,
  assertCubeDrawable,
  assertCubeValues,
  cubeAtomSection,
  parseCubeHeader,
  type CubeHeader,
} from './GraphMoleculeCube';
import { Button } from '../graph-ui/Button';
import {
  readGraphMoleculeViewerData,
  applyStructureMetadata,
  frameCell,
  readExtXyzCell,
  frameTarget,
  structureRenderFrame,
  type GraphMoleculeViewerSource,
} from './GraphMoleculeViewerData';

type HoveredAtom = {
  x: number;
  y: number;
  label: string;
  coords: {
    x: string;
    y: string;
    z: string;
  };
};

type ThreeDmolAtom = {
  atom?: string;
  elem?: string;
  index?: number;
  serial?: number;
  x: number;
  y: number;
  z: number;
};

export type GraphMoleculeScreenshot = {
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
export type GraphMoleculeAtomSelection = {
  moleculeId: string | null;
  atoms: number[];
  selectedIds: string[];
  target?: ScientificTarget;
};
export type GraphMoleculeSelectionSubmission = {
  selections: GraphMoleculeAtomSelection[];
};
export type GraphMoleculeViewerHandle = {
  captureScreenshot: () => string;
  /** A detached snapshot of this mounted viewer's live personal state. */
  captureView: () => GraphMoleculeScreenshot;
  isAvailable: () => boolean;
  trajectoryIndex: number;
  target?: ScientificTarget;
  execute: (request: ViewerRequest) => Promise<ViewerAcknowledgement>;
};
export type GraphMoleculeViewerProps = {
  className?: string;
  presentation?: 'timeline' | 'workspace';
  onOpenFile?: () => void;
  moleculeId?: string | null;
  onScreenshot?: (screenshot: GraphMoleculeScreenshot) => void | Promise<void>;
  onSelectionChange?: (selection: GraphMoleculeAtomSelection) => void;
  onSelectionSubmit?: (
    selection: GraphMoleculeSelectionSubmission,
  ) => void | Promise<void>;
  onReady?: (view: GraphMoleculeViewerHandle) => void;
  /** Personal inspection signal; never a durable input or shared camera event. */
  onActive?: (view: GraphMoleculeViewerHandle) => void;
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

export function GraphMoleculeViewer({
  className = '',
  moleculeId = null,
  onScreenshot,
  onSelectionChange,
  onSelectionSubmit,
  onReady,
  onActive,
  source,
  title = 'Molecular structure',
  presentation = 'workspace',
  onOpenFile,
  extensionHost,
  toolbar,
  rendererSlot,
  onDownloadSource,
  loading = false,
  followControl = false,
}: GraphMoleculeViewerProps) {
  // Re-render translated cube labels when the language changes.
  useI18n();
  const viewerHostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<RenderViewer | null>(null);
  const apiRef = useRef<ThreeDmolApi | null>(null);
  const modelRef = useRef<RenderModel | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const readyHandleRef = useRef<GraphMoleculeViewerHandle | null>(null);
  const captureRef = useRef<() => GraphMoleculeScreenshot>(() => {
    throw new Error('Screenshot is unavailable');
  });
  const zoomedRef = useRef(false);
  const unitCellPreferenceRef = useRef(true);

  const [cameraInfo, setCameraInfo] = useState<GraphMoleculeCameraInfo | null>(
    null,
  );
  const [requestedIndex, setCurrentIndex] = useState(0);
  const [hoveredAtom, setHoveredAtom] = useState<HoveredAtom | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedAtomLabels, setSelectedAtomLabels] = useState<
    Record<number, string>
  >({});
  const [selectedSerials, setSelectedSerials] = useState<number[]>([]);
  const selectedSerialsRef = useRef(selectedSerials);
  selectedSerialsRef.current = selectedSerials;
  const selectionStyleRef = useRef<{ color: string; radius?: number }>({
    color: 'yellow',
  });
  const [stagedSelections, setStagedSelections] = useState<
    Record<string, GraphMoleculeAtomSelection>
  >({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [live, setLive] = useState(true);
  const [style, setStyle] = useState<ViewerStyle>(
    (typeof source === 'object' && source?.metadata?.render?.style) ||
      'ball-stick',
  );
  const [cartoonAvailable, setCartoonAvailable] = useState(false);
  const applyingCommandRef = useRef(false);
  const [annotations, setAnnotations] = useState<ViewerAnnotation[]>([]);
  const atomIdsRef = useRef<string[]>([]);
  const cellRef = useRef<ArtifactMetadata['cell']>(undefined);
  const renderedTargetRef = useRef<ScientificTarget | undefined>(undefined);
  const [unitCellAvailable, setUnitCellAvailable] = useState(false);
  const [unitCellVisible, setUnitCellVisible] = useState(false);
  const [viewerInitError, setViewerInitError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hydrogens, setHydrogens] = useState(true);
  const [atomLabels, setAtomLabels] = useState(false);
  const [help, setHelp] = useState(false);
  const [measureTool, setMeasureTool] = useState<'distance' | 'angle' | null>(
    null,
  );
  const measureToolRef = useRef(measureTool);
  measureToolRef.current = measureTool;
  const [measurePicks, setMeasurePicks] = useState<string[]>([]);
  const picksRef = useRef(measurePicks);
  picksRef.current = measurePicks;
  const measurePickKeyRef = useRef('');
  const [measurements, setMeasurements] = useState<
    Record<string, MoleculeMeasurement[]>
  >({});
  const [measurementHistory, setMeasurementHistory] = useState<
    {
      key: string;
      before: MoleculeMeasurement[];
      after: MoleculeMeasurement[];
    }[]
  >([]);
  const [measurementFuture, setMeasurementFuture] = useState<
    typeof measurementHistory
  >([]);
  const [measurementNotice, setMeasurementNotice] = useState(false);
  const [measurementsPinned, setMeasurementsPinned] = useState(false);
  const [focusedMeasurement, setFocusedMeasurement] = useState<number | null>(
    null,
  );
  const [spin, setSpin] = useState(0);
  const [dark, setDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pickMeasurementRef = useRef<(id: string) => void>(() => {});
  const nextMeasurementId = useRef(0);
  const measurementShapes = useRef<object[]>([]);
  const [formula, setFormula] = useState<ReturnType<typeof moleculeFormula>>(
    [],
  );
  const [atomCount, setAtomCount] = useState(0);
  const [isovalue, setIsovalue] = useState(DEFAULT_CUBE_ISOVALUE);
  const [isoOpacity, setIsoOpacity] = useState(DEFAULT_CUBE_OPACITY);
  // Isosurface shapes of the rendered cube, and the parsed grid they share.
  const isoShapesRef = useRef<object[]>([]);
  const isoDrawRef = useRef('');
  const modelGenerationRef = useRef(0);
  const volumeRef = useRef<{ content: string; volume: unknown } | null>(null);

  const viewerData = useMemo(
    () => readGraphMoleculeViewerData(source),
    [source],
  );
  const xyzArray = viewerData.frames;
  const xyzFormat = viewerData.format;
  // LIVE's displayed frame belongs to this verified revision immediately.
  // Synchronizing the personal index in an effect must not first draw the
  // preceding frame with the new revision's controls/identity.
  const currentIndex = live
    ? Math.max(0, xyzArray.length - 1)
    : Math.min(requestedIndex, Math.max(0, xyzArray.length - 1));
  const xyzContent = xyzArray[currentIndex] ?? null;
  const isCube = xyzFormat === 'cube';
  const cube = useMemo((): { header?: CubeHeader; error?: unknown } => {
    if (!isCube || !xyzContent) return {};
    try {
      return { header: parseCubeHeader(xyzContent) };
    } catch (error) {
      return { error };
    }
  }, [isCube, xyzContent]);
  const snapshot = typeof source === 'object' && source ? source : undefined;
  const target = frameTarget(snapshot, currentIndex, xyzArray.length);
  const currentFrameRef = useRef('');
  currentFrameRef.current = `${currentIndex}:${xyzFormat}:${xyzContent}`;
  const renderedFrameRef = useRef('');
  const renderedModelKeyRef = useRef<string | null>(null);
  const surfaceActiveRef = useRef(false);
  const labelsActiveRef = useRef(false);
  const decoratedRef = useRef('');
  const backgroundRef = useRef<string | null>(null);
  const styledRef = useRef('');
  const cellDrawRef = useRef('');
  const renderedReadyRef = useRef(false);
  const targetKey = JSON.stringify(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const activeObject =
    snapshot?.target?.objectId ?? snapshot?.uuid ?? moleculeId;
  // Only the displayed frame's cell belongs to the model identity: appending
  // frame cells must not rebuild a pinned frame.
  const frameCells = snapshot?.metadata?.frameCells;
  const cellKey = JSON.stringify(
    frameCells ? (frameCells[currentIndex] ?? null) : snapshot?.metadata?.cell,
  );
  const modelDataKey = useMemo(
    () =>
      JSON.stringify([
        activeObject,
        xyzFormat,
        xyzContent,
        snapshot?.metadata?.atoms,
        snapshot?.metadata?.bonds,
        cellKey,
        snapshot?.metadata?.render,
      ]),
    [
      activeObject,
      xyzFormat,
      xyzContent,
      snapshot?.metadata?.atoms,
      snapshot?.metadata?.bonds,
      cellKey,
      snapshot?.metadata?.render,
    ],
  );
  const objectRef = useRef(activeObject);
  const measurementKey = JSON.stringify([
    activeObject,
    target?.sourceRevision ?? snapshot?.target?.sourceRevision,
    currentIndex,
    modelDataKey,
  ]);
  const currentMeasurements = measurements[measurementKey] ?? [];
  const selectedIds = selectedSerials
    .map((index) => atomIdsRef.current[index]!)
    .filter(Boolean);
  const supportedStyles: ViewerStyle[] = [
    'ball-stick',
    'stick',
    'spacefill',
    'surface',
    ...(cartoonAvailable ? ['cartoon' as const] : []),
  ];
  const selection = (): GraphMoleculeAtomSelection => ({
    moleculeId,
    atoms: [...selectedSerials],
    selectedIds: selectedSerials
      .map((index) => atomIdsRef.current[index]!)
      .filter(Boolean),
    ...(target ? { target } : {}),
  });
  const cellShapesRef = useRef<ReturnType<RenderViewer['addLine']>[]>([]);
  function drawCell(visible: boolean) {
    const viewer = viewerRef.current,
      model = modelRef.current;
    if (!viewer || !model) return;
    const key = JSON.stringify([visible, cellRef.current, dark]);
    if (cellDrawRef.current === key) return;
    cellDrawRef.current = key;
    cellShapesRef.current.forEach((shape) => viewer.removeShape(shape));
    cellShapesRef.current = [];
    try {
      viewer.removeUnitCell(model);
    } catch {
      /* No cell yet. */
    }
    const cell = cellRef.current;
    if (visible && cell) {
      const factor = cell.unit === 'bohr' ? 0.529177210903 : 1;
      const point = (bits: number) => ({
        x: cell.vectors.reduce(
          (v, row, i) => v + ((bits >> i) & 1) * row[0] * factor,
          0,
        ),
        y: cell.vectors.reduce(
          (v, row, i) => v + ((bits >> i) & 1) * row[1] * factor,
          0,
        ),
        z: cell.vectors.reduce(
          (v, row, i) => v + ((bits >> i) & 1) * row[2] * factor,
          0,
        ),
      });
      for (let bits = 0; bits < 8; bits++)
        for (let axis = 0; axis < 3; axis++)
          if (!(bits & (1 << axis)))
            cellShapesRef.current.push(
              viewer.addLine({
                start: point(bits),
                end: point(bits | (1 << axis)),
                color: dark ? '#a7b0b7' : '#5b6269',
              }),
            );
    } else if (visible)
      viewer.addUnitCell(model, {
        box: { color: dark ? '#a7b0b7' : '#5b6269' },
      });
  }
  /** Draws the +/- isosurfaces of the rendered cube; false when unchanged. */
  function drawIsosurfaces() {
    const viewer = viewerRef.current;
    if (!viewer || !isCube || !xyzContent || !modelRef.current) return false;
    const key = JSON.stringify([
      modelGenerationRef.current,
      isovalue,
      isoOpacity,
    ]);
    if (isoDrawRef.current === key) return false;
    isoShapesRef.current.forEach((shape) => viewer.removeShape(shape));
    isoShapesRef.current = [];
    isoDrawRef.current = '';
    const VolumeData = apiRef.current?.VolumeData;
    if (!VolumeData || !viewer.addIsosurface)
      throw new Error(translate('files.cubeRuntimeUnavailable'));
    if (volumeRef.current?.content !== xyzContent)
      volumeRef.current = {
        content: xyzContent,
        volume: new VolumeData(xyzContent, 'cube'),
      };
    const volume = volumeRef.current.volume;
    isoShapesRef.current = [
      viewer.addIsosurface(volume, {
        isoval: isovalue,
        color: CUBE_POSITIVE_COLOR,
        opacity: isoOpacity,
      }),
      viewer.addIsosurface(volume, {
        isoval: -isovalue,
        color: CUBE_NEGATIVE_COLOR,
        opacity: isoOpacity,
      }),
    ];
    isoDrawRef.current = key;
    return true;
  }
  function applyStyle(next: ViewerStyle, indices = selectedSerials) {
    const viewer = viewerRef.current,
      model = modelRef.current;
    if (!viewer || !model) return;
    const key = JSON.stringify([
      next,
      indices,
      selectionStyleRef.current,
      hydrogens,
      dark,
    ]);
    if (styledRef.current === key) return;
    styledRef.current = key;
    // 3Dmol clears draw immediately, even for empty collections.
    if (surfaceActiveRef.current) {
      viewer.removeAllSurfaces();
      surfaceActiveRef.current = false;
    }
    const palette = dark
      ? {
          C: '#8796a4',
          H: '#c5ced5',
          O: '#e89590',
          N: '#8faee0',
          P: '#d4af79',
          S: '#d8c77d',
          F: '#8ec9af',
          Cl: '#8ec9af',
          Br: '#bb9487',
          Pd: '#98b5ca',
        }
      : {
          C: '#667682',
          H: '#cbd3d9',
          O: '#c96f68',
          N: '#678ec4',
          P: '#b59055',
          S: '#c4ae57',
          F: '#63a688',
          Cl: '#63a688',
          Br: '#9c7669',
          Pd: '#7297b1',
        };
    const colorscheme = { prop: 'elem', map: palette };
    model.setStyle(
      {},
      next === 'spacefill'
        ? { sphere: { scale: 1, colorscheme } }
        : next === 'stick'
          ? { stick: { radius: 0.16, colorscheme } }
          : next === 'cartoon'
            ? { cartoon: { color: 'spectrum' } }
            : next === 'surface'
              ? {}
              : {
                  stick: { radius: 0.14, colorscheme },
                  sphere: { scale: 0.22, colorscheme },
                },
    );
    const surface =
      next === 'surface'
        ? viewer.addSurface(
            'VDW',
            { opacity: 0.8, colorscheme },
            hydrogens ? {} : { not: { elem: 'H' } },
          )
        : undefined;
    surfaceActiveRef.current = next === 'surface';
    if (indices.length)
      model.setStyle(
        { index: indices },
        {
          stick: { radius: 0.3, color: selectionStyleRef.current.color },
          sphere: {
            ...(selectionStyleRef.current.radius
              ? { radius: selectionStyleRef.current.radius }
              : { scale: 0.4 }),
            color: selectionStyleRef.current.color,
          },
        },
      );
    if (!hydrogens) model.setStyle({ elem: 'H' }, {});
    return surface;
  }
  function drawAnnotations(next: ViewerAnnotation[]) {
    const viewer = viewerRef.current,
      model = modelRef.current;
    if (!viewer || !model) return;
    const picks =
      measurePickKeyRef.current === measurementKey ? measurePicks : [];
    const key = JSON.stringify([
      next,
      atomLabels,
      hydrogens,
      dark,
      currentMeasurements,
      picks,
      focusedMeasurement,
    ]);
    if (decoratedRef.current === key) return false;
    decoratedRef.current = key;
    if (labelsActiveRef.current) viewer.removeAllLabels();
    labelsActiveRef.current =
      next.length > 0 ||
      atomLabels ||
      currentMeasurements.length > 0 ||
      picks.length > 0;
    const atoms = model.selectedAtoms({});
    next.forEach((annotation) => {
      const atom = atoms[atomIdsRef.current.indexOf(annotation.atomId)];
      if (atom)
        viewer.addLabel(
          annotation.text,
          {
            position: atom,
            backgroundColor: dark ? '#1a2026' : 'white',
            fontColor: annotation.color ?? (dark ? '#f4f7f6' : '#121416'),
            fontSize: 12,
          },
          undefined,
          // Batch label additions into the caller's final render.
          true,
        );
    });
    if (atomLabels)
      atoms.forEach((atom, index) => {
        if (!hydrogens && atom.elem === 'H') return;
        viewer.addLabel(
          `${atom.elem ?? 'Atom'} (${atomIdsRef.current[index]})`,
          {
            position: atom,
            fontSize: 11,
            backgroundColor: dark ? '#1a2026' : 'white',
            fontColor: dark ? '#f4f7f6' : '#121416',
            backgroundOpacity: 0.85,
          },
          undefined,
          true,
        );
      });
    measurementShapes.current.forEach((shape) => viewer.removeShape(shape));
    measurementShapes.current = [];
    currentMeasurements.forEach((measurement) => {
      const points = measurement.atomIds.map(
        (id) => atoms[atomIdsRef.current.indexOf(id)],
      );
      if (points.some((point) => !point)) return;
      const value = measureAtoms(points as typeof atoms);
      if (!value) return;
      for (let i = 1; i < points.length; i++)
        measurementShapes.current.push(
          viewer.addLine({
            start: points[i - 1],
            end: points[i],
            color:
              focusedMeasurement === measurement.id
                ? dark
                  ? '#e64c7f'
                  : '#28377a'
                : dark
                  ? '#a7b0b7'
                  : '#5b6269',
            linewidth: focusedMeasurement === measurement.id ? 3 : 1,
            dashed: true,
          }),
        );
      const position =
        points.length === 3
          ? points[1]
          : {
              x: (points[0]!.x + points[1]!.x) / 2,
              y: (points[0]!.y + points[1]!.y) / 2,
              z: (points[0]!.z + points[1]!.z) / 2,
            };
      viewer.addLabel(
        value,
        {
          position,
          fontSize: 12,
          backgroundColor: dark ? '#1a2026' : 'white',
          // Readable on its own background in both themes (light was white on white).
          fontColor: dark ? '#f0f1f5' : '#121416',
          inFront: true,
        },
        undefined,
        true,
      );
    });
    picks.forEach((id, index) => {
      const atom = atoms[atomIdsRef.current.indexOf(id)];
      if (atom)
        viewer.addLabel(
          `${index + 1}: ${id}`,
          {
            position: atom,
            fontSize: 12,
            backgroundColor: dark ? '#e64c7f' : '#28377a',
            fontColor: 'white',
            inFront: true,
          },
          undefined,
          true,
        );
    });
    return true;
  }
  const commandState = useRef({
    target,
    discovery: extensionHost?.discovery,
    atomIds: atomIdsRef.current,
    styles: supportedStyles,
    cellAvailable: unitCellAvailable,
    ready: false,
  });
  commandState.current = {
    target,
    discovery: extensionHost?.discovery,
    atomIds: atomIdsRef.current,
    styles: supportedStyles,
    cellAvailable: unitCellAvailable,
    ready:
      !loading &&
      !viewerInitError &&
      Boolean(
        viewerRef.current &&
        modelRef.current &&
        renderedReadyRef.current &&
        currentFrameRef.current === renderedFrameRef.current &&
        sameScientificTarget(renderedTargetRef.current, target),
      ),
  };
  const applyCommandsRef = useRef<
    (commands: ViewerCommand[]) => void | Promise<void>
  >(() => {});
  applyCommandsRef.current = async (commands) => {
    applyingCommandRef.current = true;
    try {
      let nextStyle = style,
        nextSelection = selectedSerialsRef.current;
      commands.forEach((command) => {
        switch (command.type) {
          case 'selection':
            selectionStyleRef.current = {
              color: command.color ?? 'yellow',
              ...(command.radius === undefined
                ? {}
                : { radius: command.radius }),
            };
            nextSelection = command.selectedIds.map((id) =>
              atomIdsRef.current.indexOf(id),
            );
            selectedSerialsRef.current = nextSelection;
            setSelectedSerials(nextSelection);
            break;
          case 'style':
            nextStyle = command.style;
            setStyle(nextStyle);
            break;
          case 'camera':
            viewerRef.current!.setView(command.view);
            break;
          case 'annotations':
            setAnnotations(command.annotations);
            drawAnnotations(command.annotations);
            break;
          case 'unit-cell':
            unitCellPreferenceRef.current = command.visible;
            setUnitCellVisible(command.visible);
            drawCell(command.visible);
            break;
        }
      });
      const viewer = viewerRef.current!;
      await applyStyle(nextStyle, nextSelection);
      viewer.render();
    } finally {
      applyingCommandRef.current = false;
    }
  };
  const executorRef = useRef<ReturnType<
    typeof createViewerCommandExecutor
  > | null>(null);
  executorRef.current ??= createViewerCommandExecutor(
    () => commandState.current,
    (commands) => applyCommandsRef.current(commands),
  );
  const runOperation = async (
    operation: () => void | Promise<void>,
    message: string,
  ) => {
    if (busyRef.current || loadingRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      await operation();
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (objectRef.current !== activeObject) {
      objectRef.current = activeObject;
      zoomedRef.current = false;
      setCurrentIndex(0);
      setLive(true);
      setAnnotations([]);
      setMeasurePicks([]);
      setMeasureTool(null);
      setSelectedSerials([]);
      setStyle(snapshot?.metadata?.render?.style ?? 'ball-stick');
      setIsovalue(DEFAULT_CUBE_ISOVALUE);
      setIsoOpacity(DEFAULT_CUBE_OPACITY);
    }
  }, [activeObject]);
  const stagedAtoms = Object.values(stagedSelections).reduce(
    (sum, entry) => sum + entry.atoms.length,
    0,
  );
  const stagedMolecules = Object.keys(stagedSelections).length;

  useEffect(() => {
    if (xyzArray.length === 0) {
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex((previous) =>
      live ? xyzArray.length - 1 : Math.min(previous, xyzArray.length - 1),
    );
  }, [xyzArray.length, live]);

  useEffect(() => {
    if (!isPlaying || xyzArray.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentIndex((previous) => {
        if (previous >= xyzArray.length - 1) {
          window.clearInterval(interval);
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, 200);

    return () => window.clearInterval(interval);
  }, [isPlaying, xyzArray.length]);

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host || viewerRef.current) {
      return;
    }

    let cancelled = false;
    let release: (() => void) | undefined;

    try {
      const canvas = document.createElement('canvas');
      const webGl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      if (!webGl) {
        setViewerInitError(
          'WebGL is unavailable in this browser environment. Unable to render 3D viewer.',
        );
        return;
      }
      (webGl as WebGLRenderingContext)
        .getExtension?.('WEBGL_lose_context')
        ?.loseContext();
    } catch {
      setViewerInitError(
        'WebGL is unavailable in this browser environment. Unable to render 3D viewer.',
      );
      return;
    }

    load3Dmol()
      .then(($3Dmol) => {
        if (cancelled || viewerRef.current) {
          return;
        }

        try {
          const managed = createMoleculeRenderViewer($3Dmol, host);
          const viewer = managed.viewer;
          apiRef.current = $3Dmol;
          // Trackpad pinch is scaled here, not by 3Dmol's wheel-notch handler.
          const unbindPinch = bindPinchZoom(host, (factor) => viewer.zoom(factor));
          release = () => {
            unbindPinch();
            managed.release();
          };
          // 3Dmol observes its host and resizes the canvas. Keep the personal
          // camera unchanged when surrounding controls or reconnect banners
          // resize that host; horizontal fitting belongs to the initial fit.
          viewerRef.current = viewer;
          setViewerReady(true);
        } catch (error) {
          console.error('Failed to initialize 3Dmol viewer:', error);
          setViewerInitError(
            'Failed to initialize 3D viewer. Please refresh or try another browser.',
          );
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load 3Dmol viewer runtime:', error);
        setViewerInitError(
          'Failed to load 3D viewer runtime. Please refresh or try another browser.',
        );
      });

    return () => {
      cancelled = true;
      release?.();
      viewerRef.current = null;
      modelRef.current = null;
      volumeRef.current = null;
      isoShapesRef.current = [];
      isoDrawRef.current = '';
      renderedReadyRef.current = false;
      commandState.current.ready = false;
      readyHandleRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !xyzContent) {
      return;
    }

    try {
      renderedReadyRef.current = false;
      commandState.current.ready = false;
      // Publication identity and verification state may change while a pinned
      // historical frame/render metadata stays identical. Rebind its exact
      // handle below without rebuilding or drawing the unchanged model.
      if (renderedModelKeyRef.current !== modelDataKey) {
        viewer.removeAllModels();
        // Also removes the previous cube's isosurfaces.
        viewer.removeAllShapes();
        modelGenerationRef.current++;
        isoShapesRef.current = [];
        isoDrawRef.current = '';
        if (volumeRef.current?.content !== xyzContent) volumeRef.current = null;
        styledRef.current = '';
        decoratedRef.current = '';
        measurementShapes.current = [];
        cellDrawRef.current = '';
        if (labelsActiveRef.current) {
          viewer.removeAllLabels();
          labelsActiveRef.current = false;
        }

        setViewerInitError(null);
        if (isCube) {
          if (cube.error) throw cube.error;
          assertCubeDrawable(cube.header!);
          assertCubeValues(xyzContent, cube.header!);
        }
        const renderFrame = isCube
          ? { content: cubeAtomSection(xyzContent, cube.header!), format: 'cube' }
          : structureRenderFrame(xyzContent, xyzFormat);
        const model = viewer.addModel(renderFrame.content, renderFrame.format, {
          keepH: true,
          doAssembly: false,
          assignBonds:
            snapshot?.metadata?.render?.bonding !== 'none' &&
            snapshot?.metadata?.render?.bonding !== 'provided',
        });
        setCartoonAvailable(
          model
            .selectedAtoms({})
            .some((atom) => atom.atom === 'CA' || atom.atom === 'P'),
        );
        const oldIds = atomIdsRef.current;
        atomIdsRef.current = applyStructureMetadata(model, snapshot?.metadata);
        const atoms = model.selectedAtoms({});
        setFormula(moleculeFormula(atoms));
        setAtomCount(atoms.length);
        const previous = selectedSerialsRef.current;
        const remapped = previous
          .map((index) => atomIdsRef.current.indexOf(oldIds[index]!))
          .filter((index) => index >= 0);
        selectedSerialsRef.current = remapped;
        setSelectedSerials(
          previous.length === remapped.length &&
            previous.every((value, index) => value === remapped[index])
            ? previous
            : remapped,
        );
        const background =
          snapshot?.metadata?.render?.background ??
          (dark ? '#0e1215' : '#ffffff');
        if (backgroundRef.current !== background) {
          viewer.setBackgroundColor(
            background,
            snapshot?.metadata?.render?.background ? 1 : 0,
          );
          backgroundRef.current = background;
        }
        const metadataCell = frameCell(snapshot?.metadata, currentIndex);
        cellRef.current =
          metadataCell === null
            ? undefined
            : (metadataCell ??
              (xyzFormat === 'extxyz' || xyzFormat === 'xyz'
                ? readExtXyzCell(xyzContent)
                : undefined));
        renderedTargetRef.current = target;
        commandState.current.atomIds = atomIdsRef.current;

        cellShapesRef.current = [];
        modelRef.current = model;
        applyStyle(style, remapped);

        // 3Dmol reports a cube's grid as crystal data; it is not a unit cell.
        const crystalData = isCube ? null : model.getCrystData();
        const hasUnitCell = Boolean(
          cellRef.current ||
          (crystalData &&
            typeof crystalData === 'object' &&
            Object.keys(crystalData).length),
        );
        // Before the initial fit, so the camera frames the lobes too.
        drawIsosurfaces();
        commandState.current.cellAvailable = hasUnitCell;
        setUnitCellAvailable(hasUnitCell);
        setUnitCellVisible(hasUnitCell ? unitCellPreferenceRef.current : false);
        setSelectedAtomLabels(
          Object.fromEntries(
            model
              .selectedAtoms({})
              .map((atom, index) => [index, atom.elem ?? 'Atom']),
          ),
        );

        const frameAtomLabels = xyzContent
          .split('\n')
          .slice(2)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.split(/\s+/)[0] ?? 'Atom');

        if (!zoomedRef.current) {
          viewer.zoomTo();
          const host = viewerHostRef.current;
          const scale = host?.clientHeight
            ? Math.min(1, host.clientWidth / host.clientHeight)
            : 1;
          // 3Dmol fits vertically; a tall, narrow Explorer also needs a
          // horizontal fit. Keep this framing across trajectory frames.
          viewer.zoom((hasUnitCell ? 0.5 : 0.85) * scale);
          zoomedRef.current = true;
        }

        model.setClickable(
          {},
          true,
          (atom: ThreeDmolAtom, _viewer: GLViewer, event?: MouseEvent) => {
            const serial = atom.index;
            if (serial === undefined) {
              return;
            }
            if (loadingRef.current || !renderedReadyRef.current) return;
            if (measureToolRef.current) {
              const id = atomIdsRef.current[serial];
              if (id) pickMeasurementRef.current(id);
              return;
            }
            selectionStyleRef.current = { color: 'yellow' };
            const label =
              atom.atom || atom.elem || frameAtomLabels[serial] || 'Atom';

            setSelectedSerials((previous) => {
              const isMulti = Boolean(
                event?.shiftKey || event?.metaKey || event?.ctrlKey,
              );
              const next = !isMulti
                ? previous.length === 1 && previous[0] === serial
                  ? []
                  : [serial]
                : previous.includes(serial)
                  ? previous.filter((entry) => entry !== serial)
                  : [...previous, serial];

              setSelectedAtomLabels((current) => {
                if (next.length === 0) {
                  return {};
                }
                const labelsBySerial: Record<number, string> = {};
                next.forEach((entry) => {
                  labelsBySerial[entry] =
                    current[entry] || frameAtomLabels[entry] || label;
                });
                return labelsBySerial;
              });
              return next;
            });
          },
        );

        model.setHoverable(
          {},
          true,
          (atom: ThreeDmolAtom, _viewer: GLViewer, event?: MouseEvent) => {
            if (!event || !atom) {
              return;
            }
            setHoveredAtom({
              x: event.clientX,
              y: event.clientY,
              label: `${atom.atom || atom.elem || 'Atom'} (${
                atom.index ?? atom.serial ?? '?'
              })`,
              coords: {
                x: atom.x.toFixed(2),
                y: atom.y.toFixed(2),
                z: atom.z.toFixed(2),
              },
            });
          },
          () => setHoveredAtom(null),
        );

        drawCell(hasUnitCell && unitCellPreferenceRef.current);
        drawAnnotations(annotations);
        viewer.render();
        renderedModelKeyRef.current = modelDataKey;
      }
      renderedTargetRef.current = target;
      renderedReadyRef.current = true;
      commandState.current.ready = !loading;
      const readyFrame = currentFrameRef.current;
      renderedFrameRef.current = readyFrame;
      const readyTarget = target ? structuredClone(target) : undefined;
      const isAvailable = () =>
        Boolean(
          viewerHostRef.current?.isConnected &&
          viewerRef.current === viewer &&
          renderedReadyRef.current &&
          readyFrame === currentFrameRef.current &&
          !loadingRef.current &&
          (sameScientificTarget(readyTarget, targetRef.current) ||
            (!readyTarget && !targetRef.current)),
        );
      const captureView = () => {
        if (!isAvailable())
          throw new Error('The inspected target changed or is unavailable.');
        return captureRef.current();
      };
      const handle: GraphMoleculeViewerHandle = {
        captureScreenshot: () => captureView().image,
        captureView,
        isAvailable,
        trajectoryIndex: target?.frameIndex ?? currentIndex,
        target: readyTarget ? structuredClone(readyTarget) : undefined,
        execute: async (request) => {
          if (!isAvailable())
            return {
              version: 1,
              requestId: request.requestId,
              operationId: request.operationId,
              actionId: request.actionId,
              target: structuredClone(request.target),
              status: 'rejected',
              error: {
                code: sameScientificTarget(request.target, targetRef.current)
                  ? 'VIEWER_UNAVAILABLE'
                  : 'STALE_TARGET',
                message: 'The inspected viewer changed or is unavailable.',
              },
            };
          return executorRef.current!(request);
        },
      };
      readyHandleRef.current = handle;
      onReadyRef.current?.(handle);
    } catch (error) {
      renderedReadyRef.current = false;
      commandState.current.ready = false;
      console.error('Failed to render molecule:', error);
      setViewerInitError(
        error instanceof CubeFormatError
          ? translate('files.cubeUnreadable', { reason: error.message })
          : isCube && error instanceof Error
            ? error.message
            : 'Unable to render this molecular structure.',
      );
    }
  }, [
    xyzContent,
    xyzFormat,
    viewerReady,
    currentIndex,
    snapshot?.metadata,
    targetKey,
    activeObject,
    loading,
  ]);

  useEffect(() => {
    if (!viewerReady || !isCube) return;
    // Coalesce slider input: meshing a large grid takes a while.
    const frame = window.requestAnimationFrame(() => {
      if (!renderedReadyRef.current) return;
      try {
        if (drawIsosurfaces()) viewerRef.current?.render();
      } catch (error) {
        setViewerInitError(
          error instanceof Error ? error.message : String(error),
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isovalue, isoOpacity, viewerReady, isCube]);

  useEffect(() => {
    if (!viewerReady) return;
    const visible = unitCellVisible && unitCellAvailable;
    if (
      cellDrawRef.current !== JSON.stringify([visible, cellRef.current, dark])
    ) {
      drawCell(visible);
      viewerRef.current?.render();
    }
  }, [unitCellAvailable, unitCellVisible, viewerReady, dark]);

  useEffect(() => {
    if (!viewerReady || applyingCommandRef.current) return;
    const next = JSON.stringify([
      style,
      selectedSerials,
      selectionStyleRef.current,
      hydrogens,
      dark,
    ]);
    if (styledRef.current !== next) {
      applyStyle(style);
      viewerRef.current?.render();
    }
    onSelectionChange?.(selection());
  }, [
    moleculeId,
    selectedSerials,
    style,
    viewerReady,
    xyzContent,
    hydrogens,
    dark,
  ]);

  useEffect(() => {
    if (!viewerReady || loading || applyingCommandRef.current) return;
    const changed = drawAnnotations(annotations);
    const background =
      snapshot?.metadata?.render?.background ?? (dark ? '#0e1215' : '#ffffff');
    const backgroundChanged = backgroundRef.current !== background;
    if (backgroundChanged)
      viewerRef.current?.setBackgroundColor(
        background,
        snapshot?.metadata?.render?.background ? 1 : 0,
      );
    backgroundRef.current = background;
    if (changed || backgroundChanged) viewerRef.current?.render();
  }, [
    annotations,
    atomLabels,
    hydrogens,
    dark,
    measurements,
    measurementKey,
    measurePicks,
    focusedMeasurement,
    viewerReady,
    loading,
  ]);

  useLayoutEffect(() => {
    picksRef.current = [];
    setMeasurePicks((current) => (current.length ? [] : current));
    setFocusedMeasurement(null);
  }, [measurementKey]);

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) return;
    const sync = () => {
      setDark(Boolean(host.closest('[data-theme="dark"], .dark')));
    };
    sync();
    const observer = new MutationObserver(sync);
    for (
      let element: HTMLElement | null = host;
      element;
      element = element.parentElement
    )
      observer.observe(element, {
        attributes: true,
        attributeFilter: ['data-theme', 'class'],
      });
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(Boolean(motion?.matches));
    syncMotion();
    motion?.addEventListener?.('change', syncMotion);
    return () => {
      observer.disconnect();
      motion?.removeEventListener?.('change', syncMotion);
    };
  }, []);

  useEffect(() => {
    if (
      reducedMotion ||
      loading ||
      (presentation === 'timeline' && !expanded)
    ) {
      setSpin(0);
      viewerRef.current?.spin?.(false);
      return;
    }
    viewerRef.current?.spin?.(spin ? 'y' : false, spin === 1 ? 0.35 : 0.9);
    return () => {
      viewerRef.current?.spin?.(false);
    };
  }, [spin, reducedMotion, loading, expanded, presentation, viewerReady]);

  useLayoutEffect(() => {
    // Top-layer promotion resizes the same canvas; it must never re-fit camera.
    viewerRef.current?.resize();
  }, [expanded]);

  useEffect(() => {
    if (!measurementNotice) return;
    const timer = window.setTimeout(() => setMeasurementNotice(false), 8000);
    return () => window.clearTimeout(timer);
  }, [measurementNotice, measurementHistory]);

  useEffect(() => {
    if (!xyzContent) {
      return;
    }

    let animationFrame = 0;
    const tick = () => {
      const view = viewerRef.current?.getView?.();
      if (Array.isArray(view) && view.length >= 8) {
        const [x, y, z, zoom, qx, qy, qz, qw] = view;
        if (
          typeof x === 'number' &&
          typeof y === 'number' &&
          typeof z === 'number' &&
          typeof zoom === 'number' &&
          typeof qx === 'number' &&
          typeof qy === 'number' &&
          typeof qz === 'number' &&
          typeof qw === 'number'
        ) {
          const magnitude = Math.sqrt(qx * qx + qy * qy + qz * qz);
          const lookAt =
            magnitude > 0
              ? { x: qx / magnitude, y: qy / magnitude, z: qz / magnitude }
              : { x: 0, y: 0, z: 0 };
          setCameraInfo({
            position: { x, y, z, qx, qy, qz, qw },
            lookAt,
            zoom,
          });
        }
      }
      animationFrame = window.setTimeout(tick, 200);
    };

    animationFrame = window.setTimeout(tick, 200);
    return () => window.clearTimeout(animationFrame);
  }, [xyzContent]);

  const capture = (): GraphMoleculeScreenshot => {
    const viewer = viewerRef.current;
    if (
      !readyHandleRef.current?.isAvailable() ||
      !viewer?.pngURI ||
      applyingCommandRef.current
    )
      throw new Error('Screenshot is unavailable');
    viewer.render();
    const image = viewer.pngURI();
    if (!image.startsWith('data:image/png;base64,'))
      throw new Error('Viewer did not produce a PNG');
    const header = Uint8Array.from(atob(image.slice(22, 66)), (c) =>
      c.charCodeAt(0),
    );
    if (
      header.length < 24 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every(
        (byte, index) => header[index] === byte,
      ) ||
      String.fromCharCode(...header.slice(12, 16)) !== 'IHDR'
    )
      throw new Error('Viewer did not produce a valid PNG');
    const dimensions = new DataView(header.buffer);
    const width = dimensions.getUint32(16),
      height = dimensions.getUint32(20);
    if (!width || !height) throw new Error('Viewer produced an empty PNG');
    const camera = [...viewer.getView()];
    if (camera.length !== 8 || camera.some((value) => !Number.isFinite(value)))
      throw new Error('Viewer camera is unavailable');
    return {
      version: 1,
      moleculeId,
      image,
      mediaType: 'image/png',
      width,
      height,
      target: target ? structuredClone(target) : undefined,
      trajectoryIndex: target?.frameIndex ?? currentIndex,
      camera,
      selectedIds: selectedSerialsRef.current
        .map((index) => atomIdsRef.current[index]!)
        .filter(Boolean),
    };
  };
  captureRef.current = capture;
  const handleScreenshot = async () => {
    const screenshot = capture();
    const blob = await (await fetch(screenshot.image)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  };
  function assertSubmissionTargets(entries: GraphMoleculeAtomSelection[]) {
    if (loading) throw new Error('Wait for the verified structure to load.');
    entries.forEach((entry) => {
      if (
        entry.target?.objectId === target?.objectId &&
        !snapshot?.frameTargets?.some((frame) =>
          sameScientificTarget(frame, entry.target),
        ) &&
        (entry.target?.sourceRevision !== target?.sourceRevision ||
          entry.target?.checksum !== target?.checksum)
      )
        throw new Error(
          'A staged selection refers to an older source revision. Select its atoms again.',
        );
    });
  }
  function handleToggleUnitCell() {
    if (!unitCellAvailable) {
      return;
    }
    setUnitCellVisible((previous) => {
      const next = !previous;
      unitCellPreferenceRef.current = next;
      return next;
    });
  }

  function handleStageSelection() {
    if (selectedSerials.length === 0) {
      return;
    }
    const entry = selection();
    const key = JSON.stringify(
      entry.target ?? { moleculeId, frameIndex: currentIndex },
    );
    setStagedSelections((current) => ({ ...current, [key]: entry }));
  }

  function focusMeasurementKeyboard() {
    viewerHostRef.current
      ?.closest<HTMLElement>('.thread-graph-molecule-viewer')
      ?.focus({ preventScroll: true });
  }

  function changeMeasurements(items: MoleculeMeasurement[]) {
    // Removing the focused row or disabling Clear otherwise sends focus to
    // body, outside this viewer's undo/redo keyboard handler.
    focusMeasurementKeyboard();
    setMeasurementHistory((history) => [
      ...history.slice(-49),
      { key: measurementKey, before: currentMeasurements, after: items },
    ]);
    setMeasurementFuture([]);
    setMeasurements((current) => ({ ...current, [measurementKey]: items }));
    setMeasurementNotice(true);
  }
  function undoMeasurement(redo = false) {
    const stack = redo ? measurementFuture : measurementHistory;
    const entry = stack.at(-1);
    if (!entry) return;
    focusMeasurementKeyboard();
    setMeasurements((current) => ({
      ...current,
      [entry.key]: redo ? entry.after : entry.before,
    }));
    if (redo) {
      setMeasurementFuture(stack.slice(0, -1));
      setMeasurementHistory((history) => [...history, entry]);
    } else {
      setMeasurementHistory(stack.slice(0, -1));
      setMeasurementFuture((future) => [...future, entry]);
    }
    setMeasurementNotice(false);
  }
  function toggleMeasureTool(tool: 'distance' | 'angle' | null) {
    setMeasureTool(tool === measureTool ? null : tool);
    picksRef.current = [];
    setMeasurePicks([]);
  }
  pickMeasurementRef.current = (id) => {
    measurePickKeyRef.current = measurementKey;
    const picks = picksRef.current;
    const next = picks.includes(id)
      ? picks.filter((value) => value !== id)
      : [...picks, id];
    if (next.length === (measureToolRef.current === 'angle' ? 3 : 2)) {
      const atoms = next.map(
        (value) =>
          modelRef.current!.selectedAtoms({})[
            atomIdsRef.current.indexOf(value)
          ]!,
      );
      if (measureAtoms(atoms) && currentMeasurements.length < 128)
        changeMeasurements([
          ...currentMeasurements,
          { id: ++nextMeasurementId.current, atomIds: next },
        ]);
      else
        setStatus(
          'Unable to measure these points, or the 128-measurement limit was reached.',
        );
      picksRef.current = [];
      setMeasurePicks([]);
    } else {
      picksRef.current = next;
      setMeasurePicks(next);
    }
  };
  function resetView() {
    const viewer = viewerRef.current,
      host = viewerHostRef.current;
    if (!viewer || loading) return;
    viewer.zoomTo();
    viewer.zoom(
      (unitCellAvailable ? 0.5 : 0.85) *
        (host?.clientHeight
          ? Math.min(1, host.clientWidth / host.clientHeight)
          : 1),
    );
    viewer.setCameraParameters({});
    viewer.render();
  }
  function downloadSource() {
    if (onDownloadSource) onDownloadSource();
    else
      downloadTextFile(
        viewerData.exportContent,
        `${title || 'structure'}.${xyzFormat}`,
      );
  }
  function closeLayer() {
    const menu = viewerHostRef.current
      ?.closest('.thread-graph-molecule-viewer')
      ?.querySelector<HTMLDetailsElement>('.molecule-view-menu[open]');
    if (menu) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    } else if (help) setHelp(false);
    else if (measurePicks.length) {
      picksRef.current = [];
      setMeasurePicks([]);
    } else if (measureTool) setMeasureTool(null);
    else setExpanded(false);
  }
  function changeExpanded(open: boolean) {
    setExpanded(open);
    const handle = readyHandleRef.current;
    if (handle?.isAvailable()) onActive?.(handle);
    if (!open) {
      setSpin(0);
      setHelp(false);
      setMeasureTool(null);
      picksRef.current = [];
      setMeasurePicks([]);
      setHoveredAtom(null);
    }
  }

  const liveButton = (
    <Button
      type="button"
      onClick={() => {
        setLive(true);
        setIsPlaying(false);
      }}
      aria-pressed={live}
    >
      LIVE{live ? ' following' : ''}
    </Button>
  );
  return (
    <GraphMoleculeFigureFrame
      expanded={expanded}
      onExpandedChange={changeExpanded}
      onEscape={closeLayer}
      title={title || 'Molecular structure'}
      presentation={presentation}
    >
      <div
        className={`thread-graph-molecule-viewer is-${presentation} ${expanded ? 'is-fullview' : ''} flex h-full min-h-0 flex-col ${className}`}
        tabIndex={0}
        onKeyDown={(event) => {
          const element = event.target as HTMLElement;
          if (
            element.closest(
              'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
            )
          )
            return;
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeLayer();
            return;
          }
          if (
            loading ||
            viewerInitError ||
            (presentation === 'timeline' && !expanded)
          )
            return;
          const key = event.key.toLowerCase();
          if ((event.metaKey || event.ctrlKey) && key === 'z') {
            event.preventDefault();
            undoMeasurement(event.shiftKey);
            return;
          }
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          const actions: Record<string, () => void> = {
            '1': () => setStyle('ball-stick'),
            '2': () => setStyle('stick'),
            '3': () => setStyle('spacefill'),
            l: () => setAtomLabels(!atomLabels),
            h: () => setHydrogens(!hydrogens),
            d: () => toggleMeasureTool('distance'),
            a: () => toggleMeasureTool('angle'),
            m: () => toggleMeasureTool(measureTool ? null : 'distance'),
            s: () => setSpin(reducedMotion ? 0 : (spin + 1) % 3),
            r: resetView,
            '?': () => setHelp(!help),
          };
          if (actions[key]) {
            event.preventDefault();
            actions[key]!();
          }
        }}
        onPointerDownCapture={() => {
          const handle = readyHandleRef.current;
          if (handle?.isAvailable()) onActive?.(handle);
        }}
        onFocusCapture={() => {
          const handle = readyHandleRef.current;
          if (handle?.isAvailable()) onActive?.(handle);
        }}
      >
        <div className="thread-graph-molecule-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">
              {onOpenFile ? (
                <button
                  type="button"
                  onClick={onOpenFile}
                  className="thread-graph-molecule-file-link"
                  title="Open in workspace"
                >
                  <span className="truncate">{title}</span>
                  <PanelRightOpen className="size-4 shrink-0" />
                </button>
              ) : (
                title
              )}
            </h2>
            <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">
              Structure and trajectory
            </p>
          </div>
          <div
            className="molecule-toolbar"
            aria-label="View controls"
            inert={loading || Boolean(viewerInitError)}
          >
            <div className="molecule-styles" role="group" aria-label="Style">
              {(
                [
                  ['ball-stick', 'Ball & stick'],
                  ['stick', 'Sticks'],
                  ['spacefill', 'Space-fill'],
                ] as const
              ).map(([value, label], index) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={style === value}
                  title={`${label} (${index + 1})`}
                  onClick={() => setStyle(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <details className="molecule-view-menu">
              <summary>View</summary>
              <div>
                <button
                  type="button"
                  aria-label="Atom labels"
                  aria-pressed={atomLabels}
                  onClick={() => setAtomLabels(!atomLabels)}
                >
                  Atom labels <kbd>L</kbd>
                </button>
                <button
                  type="button"
                  aria-label="Hydrogens"
                  aria-pressed={hydrogens}
                  onClick={() => setHydrogens(!hydrogens)}
                >
                  Hydrogens <kbd>H</kbd>
                </button>
                <button
                  type="button"
                  aria-label="Spin"
                  aria-pressed={spin > 0}
                  disabled={reducedMotion}
                  onClick={() => setSpin((spin + 1) % 3)}
                >
                  Spin: {spin === 1 ? 'slow' : spin === 2 ? 'fast' : 'off'}{' '}
                  <kbd>S</kbd>
                </button>
              </div>
            </details>
            <button
              type="button"
              aria-label="Measure distance"
              title="Distance (D)"
              aria-pressed={measureTool === 'distance'}
              disabled={!viewerReady || !xyzContent || loading}
              onClick={() => toggleMeasureTool('distance')}
            >
              <Ruler size={16} />
            </button>
            <button
              type="button"
              aria-label="Measure angle"
              title="Angle (A)"
              aria-pressed={measureTool === 'angle'}
              disabled={!viewerReady || !xyzContent || loading}
              onClick={() => toggleMeasureTool('angle')}
            >
              <Waypoints size={16} />
            </button>
            <button
              type="button"
              aria-label="Reset view"
              title="Reset view (R)"
              onClick={resetView}
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              aria-label="Download source"
              title="Download immutable source"
              disabled={!viewerData.exportContent || loading}
              onClick={downloadSource}
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        <div className="thread-graph-molecule-body min-h-0 flex-1">
          <div
            ref={viewerHostRef}
            data-testid="molecule-viewer"
            className="thread-graph-molecule-stage relative min-h-0 flex-1 overflow-hidden"
            aria-label="Molecular structure; drag to rotate, pinch to zoom"
            data-measuring={Boolean(measureTool)}
            onDoubleClick={() =>
              presentation === 'timeline' && !expanded
                ? setExpanded(true)
                : resetView()
            }
            onPointerDown={() => {
              viewerRef.current?.spin?.(false);
            }}
            onPointerUp={() => {
              if (spin && !reducedMotion)
                viewerRef.current?.spin?.('y', spin === 1 ? 0.35 : 0.9);
            }}
            onPointerCancel={() => setSpin(0)}
          >
            {viewerInitError ? (
              <div
                data-testid="molecule-viewer-error"
                className="thread-graph-molecule-error absolute inset-0 flex items-center justify-center bg-red-50 p-4 text-sm text-red-700"
              >
                {viewerInitError}
              </div>
            ) : null}
            {!viewerInitError && !xyzContent ? (
              <div className="thread-graph-molecule-empty absolute inset-0 flex items-center justify-center p-4 text-sm text-slate-400">
                No molecule data available.
              </div>
            ) : null}
            {hoveredAtom ? (
              <div
                className="thread-graph-molecule-tooltip pointer-events-none fixed z-[1000] rounded-md border border-gray-300 bg-white/95 px-2 py-1.5 text-[10px] text-gray-800 shadow-md"
                style={{ left: hoveredAtom.x - 20, top: hoveredAtom.y - 50 }}
              >
                <div className="mb-0.5 font-semibold text-gray-900">
                  {hoveredAtom.label}
                </div>
                <div className="space-x-2 text-gray-600">
                  <span>x: {hoveredAtom.coords.x}</span>
                  <span>y: {hoveredAtom.coords.y}</span>
                  <span>z: {hoveredAtom.coords.z}</span>
                </div>
              </div>
            ) : null}
            {(measureTool ||
              (measurementsPinned && currentMeasurements.length > 0)) && (
              <section
                className="molecule-measurements"
                aria-label="Measurements"
                onDoubleClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <header>
                  <button
                    type="button"
                    aria-label="Pin measurements"
                    aria-pressed={measurementsPinned}
                    onClick={() => setMeasurementsPinned(!measurementsPinned)}
                  >
                    <Pin size={14} />
                  </button>
                  <strong>Measurements</strong>
                  <span>{currentMeasurements.length}</span>
                  <button
                    type="button"
                    aria-label="Clear measurements"
                    disabled={!currentMeasurements.length}
                    onClick={() => changeMeasurements([])}
                  >
                    Clear
                  </button>
                </header>
                <ol>
                  {currentMeasurements.map((measurement, index) => {
                    const atoms = measurement.atomIds
                      .map(
                        (id) =>
                          modelRef.current?.selectedAtoms({})[
                            atomIdsRef.current.indexOf(id)
                          ],
                      )
                      .filter((atom): atom is NonNullable<typeof atom> =>
                        Boolean(atom),
                      );
                    return (
                      <li
                        key={measurement.id}
                        onMouseEnter={() =>
                          setFocusedMeasurement(measurement.id)
                        }
                        onMouseLeave={() => setFocusedMeasurement(null)}
                        onFocus={() => setFocusedMeasurement(measurement.id)}
                        onBlur={() => setFocusedMeasurement(null)}
                      >
                        <span>{index + 1}</span>
                        <span title={measurement.atomIds.join(' → ')}>
                          {measurement.atomIds.join('–')}
                        </span>
                        <output>{measureAtoms(atoms)}</output>
                        <button
                          type="button"
                          aria-label={`Remove measurement ${index + 1}`}
                          onClick={() =>
                            changeMeasurements(
                              currentMeasurements.filter(
                                (entry) => entry.id !== measurement.id,
                              ),
                            )
                          }
                        >
                          <X size={12} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {!currentMeasurements.length && <p>Click atoms to measure</p>}
              </section>
            )}
            {help && (
              <div
                className="molecule-help"
                role="dialog"
                aria-label="Viewer help"
              >
                <button
                  type="button"
                  aria-label="Close help"
                  onClick={() => setHelp(false)}
                >
                  <X size={14} />
                </button>
                <p>
                  Drag to rotate · scroll or pinch to zoom · double-click to
                  reset.
                </p>
                <p>
                  Click an atom to select; Shift/Ctrl/⌘ adds atoms. Measurements
                  use separate picks.
                </p>
                <p>
                  1/2/3 style · L labels · H hydrogens · D distance · A angle ·
                  M measure · S spin · R reset · ? help
                </p>
                <p>
                  Ctrl/⌘ Z undo · Shift Ctrl/⌘ Z redo. Escape closes popovers,
                  clears picks, exits the tool, then closes full view.
                </p>
              </div>
            )}
          </div>

          <div className="molecule-caption">
            <div>
              <strong>{title}</strong>
              <span>
                {formula.map(({ element, count }) => (
                  <span key={element}>
                    {element}
                    {count > 1 && <sub>{count}</sub>}
                  </span>
                ))}
                {atomCount ? ` · ${atomCount} atoms` : ''}
                {cube.header
                  ? ` · ${translate('files.cubeGrid', {
                      grid: cube.header.axes
                        .map((axis) => axis.points)
                        .join('×'),
                    })}${
                      cube.header.orbitalIndices[0] !== undefined
                        ? ` · ${translate('files.cubeOrbital', {
                            index: String(cube.header.orbitalIndices[0]),
                          })}`
                        : ''
                    }`
                  : ''}
                {xyzArray.length > 1
                  ? ` · Frame ${currentIndex + 1} / ${xyzArray.length}`
                  : ''}
              </span>
            </div>
            <button
              type="button"
              className="molecule-card-download"
              aria-label="Download figure source"
              disabled={loading || !viewerData.exportContent}
              onClick={downloadSource}
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              className="molecule-help-button"
              aria-label="Viewer help"
              aria-expanded={help}
              onClick={() => setHelp(!help)}
            >
              <HelpCircle size={16} />
            </button>
          </div>
          {measureTool && (
            <p className="molecule-measure-hint" role="status">
              {measureTool === 'angle'
                ? 'Angle: pick three atoms; the middle atom is the vertex.'
                : 'Distance: pick two atoms.'}{' '}
              {measurePicks.length
                ? `${measurePicks.join(' → ')} → pick ${(measureTool === 'angle' ? 3 : 2) - measurePicks.length} more. Click a picked atom to cancel it.`
                : ''}
            </p>
          )}
          {(measurementNotice || measurementFuture.length > 0) && (
            <div className="molecule-undo" role="status">
              <span>Measurement change</span>
              <button
                type="button"
                aria-label="Undo measurement change"
                disabled={!measurementHistory.length}
                onClick={() => undoMeasurement()}
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                aria-label="Redo measurement change"
                disabled={!measurementFuture.length}
                onClick={() => undoMeasurement(true)}
              >
                <Redo2 size={15} />
              </button>
            </div>
          )}

          <div className="thread-graph-molecule-controls shrink-0">
            <details className="molecule-scientific-tools">
              <summary>
                Structure tools & selection
                {selectedSerials.length
                  ? ` · ${selectedSerials.length} selected`
                  : ''}
              </summary>
              <div>
                <div className="thread-graph-molecule-control-row">
                  <div className="min-w-0">
                    <div className="molecule-representation-control">
                      <span>Representation</span>
                      <GraphMoleculeRepresentationMenu value={style} options={supportedStyles} onChange={setStyle} />
                    </div>
                    <p className="thread-graph-molecule-control-subtitle">
                      XYZ / PDB / CIF preview
                    </p>
                  </div>
                  <GraphMoleculeViewerUpperButtonGroup
                    currentIndex={currentIndex}
                    exportContent={viewerData.exportContent}
                    moleculeId={moleculeId}
                    onScreenshot={() =>
                      void runOperation(
                        handleScreenshot,
                        'PNG copied to clipboard.',
                      )
                    }
                    onDownloadSource={onDownloadSource}
                    onFeedback={setStatus}
                    viewerRef={viewerRef}
                    viewerHostRef={viewerHostRef}
                    hasUnitCell={unitCellAvailable}
                    xyzContent={xyzContent}
                    xyzFormat={xyzFormat}
                  />
                </div>
              </div>
            </details>
            {xyzArray.length > 1 ? (
              <div
                className="thread-graph-molecule-trajectory"
                role="group"
                aria-label="Trajectory controls"
              >
                <div className="thread-graph-molecule-playback-row">
                  <Button
                    type="button"
                    variant="ghost"
                    className="thread-graph-molecule-play-button"
                    aria-label={
                      isPlaying ? 'Pause trajectory' : 'Play trajectory'
                    }
                    onClick={() => {
                      setLive(false);
                      if (!isPlaying && currentIndex === xyzArray.length - 1)
                        setCurrentIndex(0);
                      setIsPlaying((current) => !current);
                    }}
                  >
                    {isPlaying ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <span className="thread-graph-molecule-frame-count">
                    Frame <strong>{currentIndex + 1}</strong> /{' '}
                    {xyzArray.length}
                  </span>
                  {followControl ? liveButton : null}
                  <div className="thread-graph-molecule-frame-buttons">
                    {[
                      {
                        label: 'First frame',
                        index: 0,
                        Icon: SkipBack,
                        disabled: currentIndex === 0,
                      },
                      {
                        label: 'Previous frame',
                        index: currentIndex - 1,
                        Icon: ChevronLeft,
                        disabled: currentIndex === 0,
                      },
                      {
                        label: 'Next frame',
                        index: currentIndex + 1,
                        Icon: ChevronRight,
                        disabled: currentIndex === xyzArray.length - 1,
                      },
                      {
                        label: 'Last frame',
                        index: xyzArray.length - 1,
                        Icon: SkipForward,
                        disabled: currentIndex === xyzArray.length - 1,
                      },
                    ].map(({ label, index, Icon, disabled }) => (
                      <Button
                        key={label}
                        type="button"
                        variant="ghost"
                        className="thread-graph-molecule-button"
                        aria-label={label}
                        title={label}
                        disabled={disabled}
                        onClick={() => {
                          setLive(false);
                          setIsPlaying(false);
                          setCurrentIndex(index);
                        }}
                      >
                        <Icon className="size-4" />
                      </Button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  className="thread-graph-molecule-scrubber"
                  min={1}
                  max={xyzArray.length}
                  step={1}
                  value={currentIndex + 1}
                  aria-label="Trajectory frame"
                  aria-valuetext={`Frame ${currentIndex + 1} of ${xyzArray.length}`}
                  style={{
                    backgroundSize: `${(currentIndex / (xyzArray.length - 1)) * 100}% 6px`,
                  }}
                  onChange={(event) => {
                    setLive(false);
                    setIsPlaying(false);
                    setCurrentIndex(Number(event.target.value) - 1);
                  }}
                />
                <div
                  className="thread-graph-molecule-frame-scale"
                  aria-hidden="true"
                >
                  <span>1</span>
                  <span>{xyzArray.length} frames</span>
                </div>
              </div>
            ) : null}

            {/* Open for cubes: the isosurface controls are the main ones. */}
            <details
              className="molecule-scientific-actions"
              open={isCube || undefined}
            >
              <summary>
                Scientific actions
                {selectedSerials.length
                  ? ` · ${selectedSerials.length} selected`
                  : ''}
              </summary>
              <div>
                <div
                  role="group"
                  aria-label="Viewer contributions"
                  inert={loading}
                  style={{ visibility: loading ? 'hidden' : undefined }}
                >
                  {/* Keep the contribution's layout while verifying new bytes. A
                collapsing toolbar resizes and redraws the previous model
                before the verified frame can render. Its controls stay inert. */}
                  {!viewerInitError && toolbar?.({ target, selectedIds })}
                </div>
                {rendererSlot?.({ target, selectedIds })}
                {followControl ? null : liveButton}
                {onScreenshot && (
                  <Button
                    type="button"
                    disabled={
                      loading ||
                      busy ||
                      !viewerReady ||
                      !target ||
                      !renderedReadyRef.current ||
                      Boolean(viewerInitError)
                    }
                    onClick={() =>
                      void runOperation(
                        () => onScreenshot(capture()),
                        'PNG submitted.',
                      )
                    }
                  >
                    Send screenshot
                  </Button>
                )}
                {status && <p role="status">{status}</p>}
                <GraphMoleculeViewerLowerButtonGroup
                  cameraInfo={cameraInfo}
                  onClearSelection={() => setSelectedSerials([])}
                  onClearStaged={() => setStagedSelections({})}
                  selectionSubmission={Boolean(onSelectionSubmit)}
                  canSubmit={
                    Boolean(onSelectionSubmit && target) &&
                    !loading &&
                    !busy &&
                    !viewerInitError &&
                    renderedReadyRef.current
                  }
                  onSendSelection={() =>
                    void runOperation(async () => {
                      const entries = [selection()];
                      assertSubmissionTargets(entries);
                      await onSelectionSubmit?.({ selections: entries });
                    }, 'Selection submitted.')
                  }
                  onSendStaged={() =>
                    void runOperation(async () => {
                      const entries = Object.values(stagedSelections);
                      assertSubmissionTargets(entries);
                      await onSelectionSubmit?.({ selections: entries });
                      setStagedSelections({});
                    }, 'Staged selections submitted.')
                  }
                  onStageSelection={handleStageSelection}
                  onToggleUnitCell={handleToggleUnitCell}
                  selectedAtomLabels={selectedAtomLabels}
                  selectedSerials={selectedSerials}
                  stagedAtoms={stagedAtoms}
                  stagedMolecules={stagedMolecules}
                  unitCellAvailable={unitCellAvailable}
                  unitCellVisible={unitCellVisible}
                  isosurface={
                    isCube && !viewerInitError
                      ? {
                          isovalue,
                          opacity: isoOpacity,
                          disabled: loading || !viewerReady,
                          onIsovalueChange: setIsovalue,
                          onOpacityChange: setIsoOpacity,
                        }
                      : undefined
                  }
                />
              </div>
            </details>
          </div>
        </div>
      </div>
    </GraphMoleculeFigureFrame>
  );
}
