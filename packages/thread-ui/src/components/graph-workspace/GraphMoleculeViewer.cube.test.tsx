/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphMoleculeViewer } from './GraphMoleculeViewer';
import type {
  RenderModel,
  RenderViewer,
} from './GraphMoleculeViewerRenderTypes';
import { syntheticCube } from './GraphMoleculeCubeFixtures';
import {
  CUBE_NEGATIVE_COLOR,
  CUBE_POSITIVE_COLOR,
  parseCubeHeader,
} from './GraphMoleculeCube';

const runtime = vi.hoisted(() => ({
  viewer: null as unknown as RenderViewer,
  volumes: [] as { data: string; format: string }[],
}));
vi.mock('./load3Dmol', () => ({
  load3Dmol: async () => ({
    createViewer: () => runtime.viewer,
    VolumeData: class {
      constructor(
        readonly data: string,
        readonly format: string,
      ) {
        runtime.volumes.push({ data, format });
      }
    },
  }),
}));

const cube = syntheticCube({ points: 20, orbitals: [5] });
const otherCube = syntheticCube({ points: 12, orbitals: [6] });
const xyz = '2\nwater\nO 0 0 0\nH 1 0 0\n';
let root: Root;
let node: HTMLDivElement;
let shapes: { spec: Record<string, unknown> }[];
let removed: object[];

function isoCalls() {
  return vi
    .mocked(runtime.viewer.addIsosurface!)
    .mock.calls.map(([, spec]) => spec);
}
async function show(content: string, format: string, uuid = format) {
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [content], format, uuid, name: `orb.${format}` }}
        title={`orb.${format}`}
      />,
    ),
  );
  // Isosurface redraws are coalesced to an animation frame.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
}
function slider(label: string) {
  return node.querySelector<HTMLInputElement>(
    `input[type="range"][aria-label="${label}"]`,
  )!;
}
async function slide(label: string, value: number) {
  const input = slider(label);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as never,
  );
  runtime.volumes = [];
  shapes = [];
  removed = [];
  const atoms = [
    { index: 0, elem: 'O', x: 0, y: 0, z: 0 },
    { index: 1, elem: 'H', x: 0.76, y: 0.59, z: 0 },
    { index: 2, elem: 'H', x: -0.76, y: 0.59, z: 0 },
  ];
  const model: RenderModel = {
    selectedAtoms: () => atoms.map((atom) => ({ ...atom })),
    // 3Dmol reports the cube grid as crystal data.
    getCrystData: () => ({ origin: {}, size: {}, unit: {} }),
    setStyle: vi.fn(),
    setClickable: vi.fn(),
    setHoverable: vi.fn(),
  };
  runtime.viewer = {
    addModel: vi.fn(() => model),
    removeAllModels: vi.fn(),
    removeAllShapes: vi.fn(() => {
      shapes = [];
    }),
    removeAllLabels: vi.fn(),
    removeAllSurfaces: vi.fn(),
    removeUnitCell: vi.fn(),
    addUnitCell: vi.fn(),
    addLine: vi.fn(() => ({})),
    removeShape: vi.fn((shape: object) => {
      removed.push(shape);
      shapes = shapes.filter((entry) => entry !== shape);
    }),
    addIsosurface: vi.fn((_volume: unknown, spec: Record<string, unknown>) => {
      const shape = { spec };
      shapes.push(shape);
      return shape;
    }),
    addLabel: vi.fn(),
    addSurface: vi.fn(),
    render: vi.fn(),
    resize: vi.fn(),
    spin: vi.fn(),
    setBackgroundColor: vi.fn(),
    setCameraParameters: vi.fn(),
    getView: () => [0, 0, 0, 1, 0, 0, 0, 1],
    setView: vi.fn(),
    zoom: vi.fn(),
    zoomTo: vi.fn(),
    pngURI: () => '',
  } as unknown as RenderViewer;
  node = document.createElement('div');
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('cube volumetric viewer', () => {
  it('adds the atoms from the header and draws +/- isosurfaces at 0.02', async () => {
    await show(cube, 'cube');
    const header = parseCubeHeader(cube);
    expect(runtime.viewer.addModel).toHaveBeenCalledExactlyOnceWith(
      cube.slice(0, header.headerLength),
      'cube',
      expect.any(Object),
    );
    expect(runtime.volumes).toEqual([{ data: cube, format: 'cube' }]);
    expect(isoCalls()).toEqual([
      { isoval: 0.02, color: CUBE_POSITIVE_COLOR, opacity: 0.85 },
      { isoval: -0.02, color: CUBE_NEGATIVE_COLOR, opacity: 0.85 },
    ]);
    expect(shapes).toHaveLength(2);
    // The surfaces exist before the initial fit, so the camera frames them.
    expect(
      vi.mocked(runtime.viewer.addIsosurface!).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(runtime.viewer.zoomTo).mock.invocationCallOrder[0]!);
    expect(node.textContent).toContain('Grid 20×20×20');
    expect(node.textContent).toContain('Orbital 5');
    expect(node.querySelector('[data-testid="molecule-viewer-error"]')).toBeNull();
    // The grid is not a unit cell.
    expect(
      node.querySelector<HTMLButtonElement>('button[aria-label="Show unit cell"]')!
        .disabled,
    ).toBe(true);
    expect(
      node.querySelector<HTMLDetailsElement>('.molecule-scientific-actions')!.open,
    ).toBe(true);
    expect(slider('Isovalue').getAttribute('aria-valuetext')).toBe('±0.02');
  });

  it('redraws both surfaces from the same parsed grid when isovalue or opacity changes', async () => {
    await show(cube, 'cube');
    const first = [...shapes];
    await slide('Isovalue', 750);
    expect(removed).toEqual(first);
    expect(shapes.map((shape) => shape.spec.isoval)).toEqual([0.1, -0.1]);
    expect(slider('Isovalue').getAttribute('aria-valuetext')).toBe('±0.1');
    await slide('Opacity', 40);
    expect(shapes.map((shape) => shape.spec)).toEqual([
      { isoval: 0.1, color: CUBE_POSITIVE_COLOR, opacity: 0.4 },
      { isoval: -0.1, color: CUBE_NEGATIVE_COLOR, opacity: 0.4 },
    ]);
    expect(runtime.volumes).toHaveLength(1);
    expect(runtime.viewer.render).toHaveBeenCalled();
  });

  it('clears the surfaces when the file changes and does not draw them for other formats', async () => {
    await show(cube, 'cube', 'a.cube');
    await slide('Isovalue', 750);
    await show(otherCube, 'cub', 'b.cub');
    expect(runtime.viewer.removeAllShapes).toHaveBeenCalledTimes(2);
    // A new file starts at the default isovalue, parsed from its own grid.
    expect(shapes.map((shape) => shape.spec.isoval)).toEqual([0.02, -0.02]);
    expect(runtime.volumes.map((volume) => volume.data)).toEqual([
      cube,
      otherCube,
    ]);
    expect(node.textContent).toContain('Grid 12×12×12');
    const drawn = isoCalls().length;
    await show(xyz, 'xyz', 'water.xyz');
    expect(runtime.viewer.removeAllShapes).toHaveBeenCalledTimes(3);
    expect(shapes).toEqual([]);
    expect(isoCalls()).toHaveLength(drawn);
    expect(slider('Isovalue')).toBeNull();
  });

  it('rejects a grid above 200³ points before drawing it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const huge = syntheticCube({ points: 2 }).replace(/^( {4})2/gm, '  201');
    await show(huge, 'cube');
    expect(runtime.viewer.addModel).not.toHaveBeenCalled();
    expect(runtime.viewer.addIsosurface).not.toHaveBeenCalled();
    expect(
      node.querySelector('[data-testid="molecule-viewer-error"]')?.textContent,
    ).toContain('201 × 201 × 201 points, more than the 200³ preview limit');
    expect(slider('Isovalue')).toBeNull();
  });

  it('reports a truncated grid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await show(cube.slice(0, -200), 'cube');
    expect(runtime.viewer.addIsosurface).not.toHaveBeenCalled();
    expect(
      node.querySelector('[data-testid="molecule-viewer-error"]')?.textContent,
    ).toMatch(/Unable to read this cube file: Cube has \d+ grid values; its header declares 8000/);
  });
});
