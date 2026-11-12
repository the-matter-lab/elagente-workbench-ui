/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GraphMoleculeViewer,
  type GraphMoleculeViewerHandle,
} from './GraphMoleculeViewer';
import type {
  RenderModel,
  RenderViewer,
} from './GraphMoleculeViewerRenderTypes';
import {
  EXTENSION_FIXTURES,
  type ArtifactMetadata,
  type ScientificTarget,
} from '@remote-codex/shared';

const runtime = vi.hoisted(() => ({
  viewer: null as unknown as RenderViewer,
  click: null as unknown as (
    atom: object,
    viewer: object,
    event?: object,
  ) => void,
}));
let resizeCallbacks: ResizeObserverCallback[] = [];
vi.mock('./load3Dmol', () => ({
  load3Dmol: async () => ({
    createViewer: (host: HTMLElement) => {
      // The real 3Dmol viewer watches its own host and resizes its canvas.
      new ResizeObserver(() => runtime.viewer.resize()).observe(host);
      return runtime.viewer;
    },
  }),
}));
const first = '2\nfirst\nO 0 0 0\nH 1 0 0\n';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const target: ScientificTarget = {
  artifactId: 'a',
  objectId: 'o',
  sourceRevision: 'r',
  checksum: 'a'.repeat(64),
  streamId: 's',
  frameId: 'f0',
  frameIndex: 0,
};
let root: Root;
let node: HTMLDivElement;
let model: RenderModel;
let camera: number[];
let handle: GraphMoleculeViewerHandle;
const onReady = (value: GraphMoleculeViewerHandle) => {
  handle = value;
};
function button(label: string) {
  return node.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  )!;
}
async function click(label: string) {
  await act(async () => button(label).click());
}

beforeEach(() => {
  resizeCallbacks = [];
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as never,
  );
  camera = [0, 0, 0, 1, 0, 0, 0, 1];
  const atoms = [
    { index: 0, serial: 9, elem: 'O', x: 0, y: 0, z: 0 },
    { index: 1, serial: 10, elem: 'H', x: 1, y: 0, z: 0 },
  ];
  model = {
    selectedAtoms: () => atoms.map((atom) => ({ ...atom })),
    getCrystData: () => undefined,
    setStyle: vi.fn(),
    setClickable: (_sel, _bool, callback) => {
      runtime.click = callback as typeof runtime.click;
    },
    setHoverable: vi.fn(),
  };
  runtime.viewer = {
    addModel: vi.fn(() => model),
    removeAllModels: vi.fn(),
    removeAllShapes: vi.fn(),
    removeAllLabels: vi.fn(),
    removeAllSurfaces: vi.fn(),
    removeUnitCell: vi.fn(),
    addUnitCell: vi.fn(),
    addLine: vi.fn(() => ({})),
    removeShape: vi.fn(),
    addLabel: vi.fn(),
    addSurface: vi.fn(),
    render: vi.fn(),
    resize: vi.fn(),
    spin: vi.fn(),
    setBackgroundColor: vi.fn(),
    setCameraParameters: vi.fn(),
    getView: () => camera,
    setView: vi.fn((view) => {
      camera = view;
    }),
    zoom: vi.fn(),
    zoomTo: vi.fn(),
    pngURI: () => png,
  };
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

it('scales a trackpad pinch on the stage instead of passing it to 3Dmol as wheel notches', async () => {
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target, frameTargets: [target] }}
        onReady={onReady}
      />,
    ),
  );
  vi.mocked(runtime.viewer.zoom).mockClear();
  const stage = document.querySelector<HTMLElement>('[data-testid="molecule-viewer"]')!;
  const pinch = new WheelEvent('wheel', { deltaY: -3, ctrlKey: true, bubbles: true, cancelable: true });
  await act(async () => { stage.dispatchEvent(pinch); });
  expect(pinch.defaultPrevented).toBe(true);
  expect(runtime.viewer.zoom).toHaveBeenCalledTimes(1);
  expect(vi.mocked(runtime.viewer.zoom).mock.calls[0]![0]).toBeCloseTo(Math.exp(0.03), 10);
});

it('local selection remains personal; explicit selection and PNG callbacks carry stable atom/frame provenance', async () => {
  const local = vi.fn(),
    submit = vi.fn(),
    screenshot = vi.fn();
  await act(async () => {
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target, frameTargets: [target] }}
        onReady={onReady}
        onSelectionChange={local}
        onSelectionSubmit={submit}
        onScreenshot={screenshot}
      />,
    );
  });
  await act(async () =>
    runtime.click(
      { index: 0, serial: 9, elem: 'O', x: 0, y: 0, z: 0 },
      runtime.viewer,
    ),
  );
  expect(submit).not.toHaveBeenCalled();
  expect(local.mock.lastCall?.[0]).toMatchObject({
    atoms: [0],
    selectedIds: ['0'],
    target,
  });
  await click('Send selection');
  expect(submit).toHaveBeenCalledExactlyOnceWith({
    selections: [
      expect.objectContaining({ atoms: [0], selectedIds: ['0'], target }),
    ],
  });
  await act(async () =>
    Array.from(node.querySelectorAll('button'))
      .find((b) => b.textContent === 'Send screenshot')!
      .click(),
  );
  expect(screenshot).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      target,
      trajectoryIndex: 0,
      image: png,
      camera,
    }),
  );
  expect(button('Measure distance').disabled).toBe(false);
});

it('expands the same inspected canvas and keeps camera, selection and handle available on close', async () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(
    function (this: HTMLDialogElement) {
      this.open = true;
    },
  );
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = false;
  });
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        presentation="timeline"
        title="water.xyz"
        source={{ content: [first], target }}
        onReady={onReady}
      />,
    ),
  );
  const stage = node.querySelector('[data-testid="molecule-viewer"]');
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  const inspected = handle;
  camera = [2, 3, 4, 5, 0, 0, 0, 1];
  await click('Open full view');
  expect(node.querySelector('dialog')?.open).toBe(true);
  expect(node.querySelector('[data-testid="molecule-viewer"]')).toBe(stage);
  expect(handle).toBe(inspected);
  expect(inspected.captureView().camera).toEqual(camera);
  expect(inspected.captureView().selectedIds).toEqual(['0']);
  await click('Close full view');
  expect(node.querySelector('dialog')?.open).toBe(false);
  expect(inspected.isAvailable()).toBe(true);
  expect(inspected.captureView().selectedIds).toEqual(['0']);
  expect(runtime.viewer.addModel).toHaveBeenCalledTimes(1);
  expect(button('Open full view')).toBe(document.activeElement);
});

it('measures canonical atoms locally without changing scientific selection or submitting inputs', async () => {
  const submit = vi.fn();
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{
          content: [first],
          target,
          metadata: {
            version: 1,
            objectId: target.objectId,
            sourceRevision: target.sourceRevision,
            checksum: target.checksum,
            format: 'xyz',
            atoms: [
              { id: 'oxygen', element: 'O' },
              { id: 'hydrogen', element: 'H' },
            ],
          },
        }}
        onReady={onReady}
        onSelectionSubmit={submit}
      />,
    ),
  );
  await click('Measure distance');
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  await act(async () => runtime.click({ index: 1 }, runtime.viewer));
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).toContain('1.000 Å');
  expect(handle.captureView().selectedIds).toEqual([]);
  expect(submit).not.toHaveBeenCalled();
  await click('Clear measurements');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).not.toContain('1.000 Å');
  await click('Undo measurement change');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).toContain('1.000 Å');
});

it.each(['light', 'dark'])('draws measurement values readable on their own label background (%s)', async (theme) => {
  await act(async () => root.render(<div data-theme={theme}><GraphMoleculeViewer source={{content: [first], target}} /></div>));
  await click('Measure distance');
  await act(async () => runtime.click({index: 0}, runtime.viewer));
  await act(async () => runtime.click({index: 1}, runtime.viewer));
  const call = vi.mocked(runtime.viewer.addLabel).mock.calls.find(([text]) => String(text).includes('1.000 Å'));
  expect(call).toBeDefined();
  const style = call![1] as {fontColor: string; backgroundColor: string};
  expect(style.fontColor.toLowerCase()).not.toBe(style.backgroundColor.toLowerCase());
  expect(['white', '#ffffff']).toContain(theme === 'light' ? style.backgroundColor : 'white');
  if (theme === 'light') expect(['white', '#fff', '#ffffff']).not.toContain(style.fontColor.toLowerCase());
});

it('keeps keyboard undo and redo available when measurement controls disappear or disable', async () => {
  await act(async () => root.render(<GraphMoleculeViewer source={{content: [first], target}} />));
  await click('Measure distance');
  await act(async () => runtime.click({index: 0}, runtime.viewer));
  await act(async () => runtime.click({index: 1}, runtime.viewer));
  const count = () => node.querySelectorAll('[aria-label="Measurements"] li').length;
  const shortcut = async (shiftKey = false) => act(async () => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true, shiftKey, bubbles: true}));
  });
  for (const action of ['Remove measurement 1', 'Clear measurements']) {
    button(action).focus();
    await click(action);
    expect(count()).toBe(0);
    expect(document.activeElement).toBe(node.querySelector('.thread-graph-molecule-viewer'));
    await shortcut();
    expect(count()).toBe(1);
    await shortcut(true);
    expect(count()).toBe(0);
    await shortcut();
    expect(count()).toBe(1);
  }
});

it('toggles hydrogens and personal labels without deleting agent annotations', async () => {
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onReady={onReady}
      />,
    ),
  );
  await click('Atom labels');
  expect(runtime.viewer.addLabel).toHaveBeenCalledWith(
    expect.stringContaining('O'),
    expect.anything(),
    undefined,
    true,
  );
  await click('Hydrogens');
  expect(model.setStyle).toHaveBeenCalledWith({ elem: 'H' }, {});
  expect(handle.captureView().target).toEqual(target);
});

it('measures the middle-atom angle, cancels repeat picks, and supports undo/redo without scientific selection', async () => {
  model.selectedAtoms = () => [
    { index: 0, elem: 'H', x: 1, y: 0, z: 0 },
    { index: 1, elem: 'O', x: 0, y: 0, z: 0 },
    { index: 2, elem: 'H', x: 0, y: 1, z: 0 },
  ];
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onReady={onReady}
      />,
    ),
  );
  await click('Measure angle');
  for (const index of [0, 0, 0, 1, 2])
    await act(async () => runtime.click({ index }, runtime.viewer));
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).toContain('90.0°');
  expect(handle.captureView().selectedIds).toEqual([]);
  await click('Remove measurement 1');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).not.toContain('90.0°');
  await click('Undo measurement change');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).toContain('90.0°');
  await click('Redo measurement change');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).not.toContain('90.0°');
});

it('isolates measurements and partial picks by immutable revision and trajectory frame', async () => {
  const render = async (revision: string) =>
    act(async () =>
      root.render(
        <GraphMoleculeViewer
          source={{
            content: [first, first.replace('first', 'second')],
            target: { ...target, sourceRevision: revision },
          }}
        />,
      ),
    );
  await render('r1');
  await click('Measure distance');
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  await act(async () => runtime.click({ index: 1 }, runtime.viewer));
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).toContain('1.000 Å');
  await click('First frame');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).not.toContain('1.000 Å');
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  await click('Last frame');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).toContain('1.000 Å');
  expect(
    node.querySelector('.molecule-measure-hint')?.textContent,
  ).not.toContain('pick 1 more');
  await render('r2');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).not.toContain('1.000 Å');
});

it('scopes shortcuts to inspection, preserves editable input, and unwinds Escape one layer at a time', async () => {
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        presentation="timeline"
        source={{ content: [first], target }}
        rendererSlot={() => (
          <div contentEditable suppressContentEditableWarning>
            Draft
          </div>
        )}
      />,
    ),
  );
  await click('Open full view');
  const surface = node.querySelector('.thread-graph-molecule-viewer')!;
  const key = async (value: string, target: Element = surface) =>
    act(async () =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: value,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
  await key('d', node.querySelector('[contenteditable]')!);
  expect(button('Measure distance').getAttribute('aria-pressed')).toBe('false');
  await key('d');
  expect(button('Measure distance').getAttribute('aria-pressed')).toBe('true');
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  await key('?');
  await key('Escape');
  expect(
    node.querySelector('[aria-label="Viewer help"][role="dialog"]'),
  ).toBeNull();
  await key('Escape');
  expect(button('Measure distance').getAttribute('aria-pressed')).toBe('true');
  await key('Escape');
  expect(button('Measure distance').getAttribute('aria-pressed')).toBe('false');
  expect(node.querySelector('dialog')?.open).toBe(true);
  await key('Escape');
  expect(node.querySelector('dialog')?.open).toBe(false);
});

it("restores a file's local measurements after inspecting another object", async () => {
  const render = async (objectId: string) =>
    act(async () =>
      root.render(
        <GraphMoleculeViewer
          source={{ content: [first], target: { ...target, objectId } }}
        />,
      ),
    );
  await render('water');
  await click('Measure distance');
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  await act(async () => runtime.click({ index: 1 }, runtime.viewer));
  await render('other-water');
  await click('Measure distance');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).not.toContain('1.000 Å');
  await render('water');
  await click('Measure distance');
  expect(
    node.querySelector('[aria-label="Measurements"]')?.textContent,
  ).toContain('1.000 Å');
});

it('repaints the inherited theme without rebuilding or refitting, preserving agent annotations', async () => {
  const { VIEWER_COMMAND_BATCH_ACTION } =
    await import('./GraphMoleculeViewerCommands');
  const discovery = structuredClone(EXTENSION_FIXTURES.grafico.discovery);
  discovery.capabilities[VIEWER_COMMAND_BATCH_ACTION.id] = true;
  discovery.actions.push(VIEWER_COMMAND_BATCH_ACTION);
  await act(async () =>
    root.render(
      <div data-theme="light">
        <GraphMoleculeViewer
          source={{ content: [first], target }}
          onReady={onReady}
          extensionHost={{ discovery }}
        />
      </div>,
    ),
  );
  await act(async () => {
    expect(
      await handle.execute({
        version: 1,
        requestId: 'label',
        operationId: 'label',
        actionId: VIEWER_COMMAND_BATCH_ACTION.id,
        target,
        payload: {
          version: 1,
          commands: [
            {
              type: 'annotations',
              annotations: [{ id: 'a', atomId: '0', text: 'Agent note' }],
            },
          ],
        },
      }),
    ).toMatchObject({ status: 'applied' });
  });
  await click('Atom labels');
  const before = [...camera];
  vi.mocked(runtime.viewer.addModel).mockClear();
  vi.mocked(runtime.viewer.zoomTo).mockClear();
  await act(async () =>
    node.firstElementChild!.setAttribute('data-theme', 'dark'),
  );
  expect(runtime.viewer.addLabel).toHaveBeenCalledWith(
    'Agent note',
    expect.objectContaining({ backgroundColor: '#1a2026' }),
    undefined,
    true,
  );
  expect(runtime.viewer.addModel).not.toHaveBeenCalled();
  expect(runtime.viewer.zoomTo).not.toHaveBeenCalled();
  expect(camera).toEqual(before);
});

it('disables automatic spin for reduced motion', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  await act(async () =>
    root.render(<GraphMoleculeViewer source={{ content: [first], target }} />),
  );
  expect(button('Spin').disabled).toBe(true);
  await act(async () =>
    node
      .querySelector('.thread-graph-molecule-viewer')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true })),
  );
  expect(runtime.viewer.spin).not.toHaveBeenCalledWith('y', expect.anything());
});

it('keeps unit-cell geometry visible in both themes and preserves its personal visibility toggle', async () => {
  await act(async () =>
    root.render(
      <div data-theme="light">
        <GraphMoleculeViewer
          source={{
            content: [first],
            target,
            metadata: {
              version: 1,
              objectId: target.objectId,
              sourceRevision: target.sourceRevision,
              checksum: target.checksum,
              format: 'xyz',
              cell: {
                vectors: [
                  [2, 0, 0],
                  [0, 2, 0],
                  [0, 0, 2],
                ],
                periodic: [true, true, true],
                unit: 'angstrom',
              },
            },
          }}
          onReady={onReady}
        />
      </div>,
    ),
  );
  expect(
    vi.mocked(runtime.viewer.addLine).mock.calls.length -
      vi.mocked(runtime.viewer.removeShape).mock.calls.length,
  ).toBe(12);
  expect(runtime.viewer.addLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ color: '#5b6269' }),
  );
  vi.mocked(runtime.viewer.addLine).mockClear();
  await act(async () =>
    node.firstElementChild!.setAttribute('data-theme', 'dark'),
  );
  expect(runtime.viewer.addLine).toHaveBeenCalledTimes(12);
  expect(runtime.viewer.addLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ color: '#a7b0b7' }),
  );
  await click('Hide unit cell');
  expect(button('Show unit cell')).toBeTruthy();
  expect(handle.captureView().target).toEqual(target);
});

it('keeps agent controls mounted but inert while a new source is verified', async () => {
  const props = {
    source: { content: [first], target, frameTargets: [target] },
    onReady,
    toolbar: () => <input aria-label="Agent annotation" defaultValue="draft" />,
  };
  await act(async () => root.render(<GraphMoleculeViewer {...props} />));
  const input = node.querySelector<HTMLInputElement>(
    'input[aria-label="Agent annotation"]',
  )!;
  input.value = 'personal draft';
  const controls = node.querySelector<HTMLElement>(
    '[aria-label="Viewer contributions"]',
  )!;
  expect(controls.hasAttribute('inert')).toBe(false);
  await act(async () =>
    root.render(<GraphMoleculeViewer {...props} loading />),
  );
  expect(node.querySelector('input[aria-label="Agent annotation"]')).toBe(
    input,
  );
  expect(input.value).toBe('personal draft');
  expect(controls.hasAttribute('inert')).toBe(true);
  expect(controls.style.visibility).toBe('hidden');
  expect(handle.isAvailable()).toBe(false);
  await act(async () =>
    root.render(<GraphMoleculeViewer {...props} loading={false} />),
  );
  expect(node.querySelector('input[aria-label="Agent annotation"]')).toBe(
    input,
  );
  expect(controls.hasAttribute('inert')).toBe(false);
  expect(controls.style.visibility).toBe('');
  expect(handle.isAvailable()).toBe(true);
});

it('preserves a personal camera when reconnect layout shrinks and restores the viewer', async () => {
  let height = 368;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(310);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => height,
  );
  runtime.viewer.zoom = vi.fn((factor) => {
    camera = [...camera];
    camera[3] = 150 - (150 - camera[3]!) / factor;
  });
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target, frameTargets: [target] }}
        onReady={onReady}
      />,
    ),
  );
  camera = [0, 0, -0.50000000145, 116.99823356073185, 0, 0, 0, 1];
  const personalView = [...camera];
  const zooms = vi.mocked(runtime.viewer.zoom).mock.calls.length;
  for (const nextHeight of [332, 368]) {
    height = nextHeight;
    await act(async () => {
      for (const callback of resizeCallbacks)
        callback([], {} as ResizeObserver);
    });
    expect(camera).toEqual(personalView);
  }
  expect(runtime.viewer.resize).toHaveBeenCalledTimes(2);
  expect(vi.mocked(runtime.viewer.zoom).mock.calls).toHaveLength(zooms);
  expect(handle.isAvailable()).toBe(true);
});

it('stages separate molecules and preserves each target rather than relabeling them on submission', async () => {
  const submit = vi.fn();
  const render = async (next: ScientificTarget) => {
    await act(async () =>
      root.render(
        <GraphMoleculeViewer
          moleculeId={next.objectId}
          source={{ content: [first], target: next }}
          onSelectionSubmit={submit}
        />,
      ),
    );
  };
  await render(target);
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  await click('Stage current selection');
  const other = { ...target, objectId: 'other', artifactId: 'b' };
  await render(other);
  await act(async () => runtime.click({ index: 1 }, runtime.viewer));
  await click('Stage current selection');
  await click('Send staged selections');
  expect(submit).toHaveBeenCalledExactlyOnceWith({
    selections: [
      expect.objectContaining({ target, selectedIds: ['0'] }),
      expect.objectContaining({ target: other, selectedIds: ['1'] }),
    ],
  });
});

it('keeps the camera and scrubbed frame while a stream appends, and resumes following through LIVE', async () => {
  const f1 = { ...target, frameId: 'f1', frameIndex: 1 },
    f2 = { ...target, frameId: 'f2', frameIndex: 2 };
  const render = async (frames: string[], targets: ScientificTarget[]) => {
    await act(async () =>
      root.render(
        <GraphMoleculeViewer
          source={{
            content: frames,
            target: targets.at(-1),
            frameTargets: targets,
            uuid: 'o',
          }}
          onReady={onReady}
        />,
      ),
    );
  };
  await render([first, first.replace('first', 'second')], [target, f1]);
  camera = [1, 2, 3, 4, 0, 0, 0, 1];
  await click('First frame');
  const oldHandle = handle;
  await render(
    [first, first.replace('first', 'second'), first.replace('first', 'third')],
    [target, f1, f2],
  );
  expect(handle.target).toEqual(target);
  expect(runtime.viewer.zoomTo).toHaveBeenCalledTimes(1);
  expect(camera).toEqual([1, 2, 3, 4, 0, 0, 0, 1]);
  await act(async () =>
    Array.from(node.querySelectorAll('button'))
      .find((b) => b.textContent === 'LIVE')!
      .click(),
  );
  expect(handle.target).toEqual(f2);
  expect(() => oldHandle.captureScreenshot()).toThrow('target changed');
});

it('shows LIVE beside the frame controls for a growing trajectory', async () => {
  const frames = [first, first.replace('first', 'second'), first.replace('first', 'third')];
  await act(async () =>
    root.render(<GraphMoleculeViewer source={{ content: frames, uuid: 'o' }} followControl />),
  );
  const controls = node.querySelector('[aria-label="Trajectory controls"]')!;
  const live = Array.from(controls.querySelectorAll('button')).find((b) => b.textContent?.startsWith('LIVE'))!;
  expect(live.getAttribute('aria-pressed')).toBe('true');
  expect(node.querySelector('.molecule-scientific-actions')?.textContent).not.toContain('LIVE');
  await click('First frame');
  expect(live.getAttribute('aria-pressed')).toBe('false');
  expect(controls.textContent).toContain('Frame 1 / 3');
  await act(async () => live.click());
  expect(live.getAttribute('aria-pressed')).toBe('true');
  expect(controls.textContent).toContain('Frame 3 / 3');
});

it('applies browser commands, rejects stale targets, and retains immutable coordinates', async () => {
  const source = { content: [first], target };
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={source}
        onReady={onReady}
        extensionHost={{ discovery: EXTENSION_FIXTURES.grafico.discovery }}
      />,
    ),
  );
  const request = {
    version: 1 as const,
    requestId: 'req',
    operationId: 'op',
    actionId: 'elagente.viewer.style',
    target,
    payload: { style: 'stick' },
  };
  let acknowledgement;
  await act(async () => {
    acknowledgement = await handle.execute(request);
  });
  expect(acknowledgement).toMatchObject({ status: 'applied', target });
  expect(source.content).toEqual([first]);
  expect(
    (
      await handle.execute({
        ...request,
        target: { ...target, sourceRevision: 'old' },
      })
    ).status,
  ).toBe('rejected');
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={source}
        loading
        onReady={onReady}
        extensionHost={{ discovery: EXTENSION_FIXTURES.grafico.discovery }}
      />,
    ),
  );
  expect((await handle.execute(request)).error?.code).toBe(
    'VIEWER_UNAVAILABLE',
  );
});

it('hides selection submission without a callback; rejected submissions provide visible feedback', async () => {
  await act(async () =>
    root.render(<GraphMoleculeViewer source={{ content: [first], target }} />),
  );
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  // An Agent without a selection action (Estructural, ELA-387) shows no send or staging buttons.
  for (const label of ['Send selection', 'Stage current selection', 'Clear staged selections', 'Send staged selections'])
    expect(button(label)).toBeNull();
  expect(button('Clear selection').disabled).toBe(false);
  expect(node.textContent).not.toContain('Staged:');
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onSelectionSubmit={async () => {
          throw new Error('Stale native revision');
        }}
      />,
    ),
  );
  await click('Send selection');
  expect(node.querySelector('[role="status"]')?.textContent).toBe(
    'Stale native revision',
  );
});

it.each(['provided', 'none'] as const)(
  'picks, highlights, hovers and submits actual EXTXYZ parser atoms with %s bonds',
  async (bonding) => {
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: () => 'blob:worker',
      configurable: true,
    });
    const library = (await import('3dmol')) as unknown as {
      GLModel: new (id: number) => RenderModel & {
        addMolData(text: string, format: string, options: object): void;
      };
    };
    const content = '2\nProperties=species:S:1:pos:R:3\nO 0 0 0\nH 1 0 0\n';
    const actualModel = new library.GLModel(0);
    actualModel.addMolData(content, 'xyz', { assignBonds: false });
    expect(actualModel.selectedAtoms({}).map((atom) => atom.index)).toEqual([
      undefined,
      undefined,
    ]);
    vi.mocked(runtime.viewer.addModel).mockReturnValue(actualModel);
    const submit = vi.fn(),
      local = vi.fn();
    const editedTarget = {
      ...target,
      sourceRevision: 'edited-r2',
      frameId: 'edited-frame',
    };
    const metadata = {
      version: 1 as const,
      objectId: editedTarget.objectId,
      sourceRevision: editedTarget.sourceRevision,
      checksum: editedTarget.checksum,
      format: 'extxyz',
      atoms: [
        { id: 'canonical-O', element: 'O' },
        { id: 'canonical-H', element: 'H' },
      ],
      bonds: [
        {
          atomIds: ['canonical-O', 'canonical-H'] as [string, string],
          order: 1,
        },
      ],
      render: { coordinateUnit: 'angstrom' as const, bonding },
    };
    const before = JSON.stringify(metadata);
    await act(async () =>
      root.render(
        <GraphMoleculeViewer
          source={{
            content: [content],
            format: 'extxyz',
            target: editedTarget,
            metadata,
          }}
          onSelectionChange={local}
          onSelectionSubmit={submit}
        />,
      ),
    );
    type PickedAtom = ReturnType<RenderModel['selectedAtoms']>[number] & {
      callback: (atom: object, viewer: object, event?: MouseEvent) => void;
      hover_callback: (atom: object, viewer: object, event: MouseEvent) => void;
      style: { sphere?: { color: string } };
    };
    const atoms = actualModel.selectedAtoms({}) as PickedAtom[];
    expect(atoms.map((atom) => atom.index)).toEqual([0, 1]);
    await act(async () => atoms[0]!.callback(atoms[0]!, runtime.viewer));
    expect(local.mock.lastCall?.[0]).toMatchObject({
      atoms: [0],
      selectedIds: ['canonical-O'],
      target: editedTarget,
    });
    expect(atoms[0]!.style.sphere?.color).toBe('yellow');
    await act(async () =>
      atoms[1]!.callback(
        atoms[1]!,
        runtime.viewer,
        new MouseEvent('click', { shiftKey: true }),
      ),
    );
    await act(async () =>
      atoms[1]!.hover_callback(
        atoms[1]!,
        runtime.viewer,
        new MouseEvent('mousemove', { clientX: 20, clientY: 30 }),
      ),
    );
    expect(node.textContent).toContain('H (1)');
    await click('Stage current selection');
    await click('Send staged selections');
    expect(submit).toHaveBeenCalledExactlyOnceWith({
      selections: [
        expect.objectContaining({
          atoms: [0, 1],
          selectedIds: ['canonical-O', 'canonical-H'],
          target: editedTarget,
        }),
      ],
    });
    expect(JSON.stringify(metadata)).toBe(before);
    expect(
      actualModel.selectedAtoms({}).map((atom) => [atom.x, atom.y, atom.z]),
    ).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
  },
);

it('captures live personal camera/selection through a retained ready handle and detaches provenance', async () => {
  const active = vi.fn();
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onReady={onReady}
        onActive={active}
      />,
    ),
  );
  const retained = handle;
  camera = [7, 8, 9, 4, 0, 0, 0, 1];
  await act(async () => runtime.click({ index: 1 }, runtime.viewer));
  expect(retained.isAvailable()).toBe(true);
  const captured = retained.captureView();
  expect(captured).toMatchObject({
    version: 1,
    image: png,
    mediaType: 'image/png',
    width: 1,
    height: 1,
    target,
    trajectoryIndex: 0,
    camera,
    selectedIds: ['1'],
  });
  captured.camera[0] = 999;
  captured.selectedIds[0] = 'foreign';
  captured.target!.objectId = 'foreign';
  expect(retained.captureView()).toMatchObject({
    target,
    camera: [7, 8, 9, 4, 0, 0, 0, 1],
    selectedIds: ['1'],
  });
  await act(async () =>
    node
      .querySelector('.thread-graph-molecule-stage')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true })),
  );
  expect(active).toHaveBeenCalledExactlyOnceWith(retained);
  await act(async () =>
    Array.from(node.querySelectorAll('button'))
      .find((b) => b.textContent?.startsWith('LIVE'))!
      .focus(),
  );
  expect(active).toHaveBeenCalledTimes(2);
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onReady={onReady}
        loading
      />,
    ),
  );
  expect(retained.isAvailable()).toBe(false);
  expect(() => retained.captureView()).toThrow('unavailable');
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onReady={onReady}
      />,
    ),
  );
  const current = handle;
  await act(async () => root.render(null));
  expect(current.isAvailable()).toBe(false);
  expect(() => current.captureView()).toThrow('unavailable');
});

it('reports screenshot upload/native rejection and rejects invalid PNG/camera without emitting input', async () => {
  const submit = vi
    .fn()
    .mockRejectedValue(new Error('PNG native input rejected'));
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onScreenshot={submit}
        onReady={onReady}
      />,
    ),
  );
  const send = () =>
    Array.from(node.querySelectorAll('button'))
      .find((b) => b.textContent === 'Send screenshot')!
      .click();
  await act(async () => send());
  expect(node.querySelector('[role="status"]')?.textContent).toBe(
    'PNG native input rejected',
  );
  expect(submit).toHaveBeenCalledTimes(1);
  submit.mockClear();
  runtime.viewer.pngURI = () => 'data:image/png;base64,AA==';
  await act(async () => send());
  expect(node.querySelector('[role="status"]')?.textContent).toContain(
    'valid PNG',
  );
  expect(submit).not.toHaveBeenCalled();
  runtime.viewer.pngURI = () => png;
  camera = [NaN];
  expect(() => handle.captureView()).toThrow('camera is unavailable');
});

it('captures the applied batch camera and selection before React commits and renders annotations before ACK', async () => {
  const { VIEWER_COMMAND_BATCH_ACTION } =
    await import('./GraphMoleculeViewerCommands');
  const discovery = structuredClone(EXTENSION_FIXTURES.grafico.discovery);
  discovery.capabilities[VIEWER_COMMAND_BATCH_ACTION.id] = true;
  discovery.actions.push(VIEWER_COMMAND_BATCH_ACTION);
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onReady={onReady}
        extensionHost={{ discovery }}
      />,
    ),
  );
  await act(async () => {
    const acknowledgement = await handle.execute({
      version: 1,
      requestId: 'batch',
      operationId: 'batch',
      actionId: VIEWER_COMMAND_BATCH_ACTION.id,
      target,
      payload: {
        version: 1,
        commands: [
          { type: 'selection', selectedIds: ['1'], color: 'red', radius: 0.5 },
          { type: 'camera', view: [4, 5, 6, 7, 0, 0, 0, 1] },
          {
            type: 'annotations',
            annotations: [
              { id: 'label', text: 'hydrogen', atomId: '1', color: 'blue' },
            ],
          },
        ],
      },
    });
    expect(acknowledgement).toMatchObject({
      status: 'applied',
      result: { commandCount: 3 },
    });
    expect(runtime.viewer.addLabel).toHaveBeenCalledWith(
      'hydrogen',
      expect.objectContaining({ fontColor: 'blue' }),
      undefined,
      true,
    );
    expect(model.setStyle).toHaveBeenCalledWith(
      { index: [1] },
      expect.objectContaining({ sphere: { radius: 0.5, color: 'red' } }),
    );
    expect(handle.captureView()).toMatchObject({
      selectedIds: ['1'],
      camera: [4, 5, 6, 7, 0, 0, 0, 1],
    });
  });
});

it('a retained unmounted handle rejects commands before renderer effects', async () => {
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onReady={onReady}
        extensionHost={{ discovery: EXTENSION_FIXTURES.grafico.discovery }}
      />,
    ),
  );
  const retained = handle;
  await act(async () => root.render(null));
  const before = vi.mocked(runtime.viewer.render).mock.calls.length;
  expect(
    await retained.execute({
      version: 1,
      requestId: 'unmounted',
      operationId: 'unmounted',
      actionId: 'elagente.viewer.style',
      target,
      payload: { style: 'stick' },
    }),
  ).toMatchObject({
    status: 'rejected',
    error: { code: 'VIEWER_UNAVAILABLE' },
  });
  expect(runtime.viewer.render).toHaveBeenCalledTimes(before);
});

it('rebinds append identities without drawing/reparsing a pinned unchanged frame; renders real frame and metadata changes', async () => {
  const frames = [
    first,
    first.replace('first', 'second').replace('H 1 0 0', 'H 2 0 0'),
  ];
  const makeSource = (
    count: number,
    revision: string,
    bonds?: { atomIds: [string, string]; order: number }[],
  ) => {
    const nextTarget = {
      ...target,
      artifactId: 'artifact-' + revision,
      sourceRevision: revision,
      checksum: revision.padEnd(64, 'a'),
    };
    return {
      content: [...frames, ...Array(count - 2).fill(first)],
      target: nextTarget,
      frameTargets: Array.from({ length: count }, (_, i) => ({
        ...nextTarget,
        frameId: 'frame-' + i,
        frameIndex: i,
      })),
      metadata: {
        version: 1 as const,
        objectId: 'o',
        sourceRevision: revision,
        checksum: nextTarget.checksum,
        format: 'xyz',
        atoms: [
          { id: 'O', element: 'O' },
          { id: 'H', element: 'H' },
        ],
        ...(bonds ? { bonds } : {}),
        render: {
          coordinateUnit: 'angstrom' as const,
          bonding: 'provided' as const,
        },
      },
      uuid: 'o',
    };
  };
  // Provided metadata always supplies bonds, even an explicitly empty list.
  let source = makeSource(2, 'r1', []);
  const render = async (loading = false) =>
    act(async () =>
      root.render(
        <GraphMoleculeViewer
          source={source}
          onReady={onReady}
          loading={loading}
        />,
      ),
    );
  await render();
  await click('First frame');
  await act(async () => runtime.click({ index: 0 }, runtime.viewer));
  camera = [3, 4, 5, 6, 0, 0, 0, 1];
  const old = handle;
  for (const fn of [
    runtime.viewer.addModel,
    runtime.viewer.removeAllLabels,
    runtime.viewer.removeAllSurfaces,
    runtime.viewer.setBackgroundColor,
    runtime.viewer.render,
    model.setStyle,
  ])
    vi.mocked(fn).mockClear();
  for (let count = 3; count <= 6; count++) {
    source = makeSource(count, 'r' + count, []);
    await render(true);
    expect(handle.isAvailable()).toBe(false);
    await render();
    expect(handle.target).toMatchObject({
      artifactId: 'artifact-r' + count,
      frameIndex: 0,
    });
    expect(runtime.viewer.render).not.toHaveBeenCalled();
    expect(handle.captureView().selectedIds).toEqual(['O']);
    vi.mocked(runtime.viewer.render).mockClear();
  }
  // captureView above intentionally renders; appends themselves do not.
  expect(runtime.viewer.addModel).not.toHaveBeenCalled();
  expect(runtime.viewer.removeAllLabels).not.toHaveBeenCalled();
  expect(runtime.viewer.removeAllSurfaces).not.toHaveBeenCalled();
  expect(runtime.viewer.setBackgroundColor).not.toHaveBeenCalled();
  expect(model.setStyle).not.toHaveBeenCalled();
  expect(camera).toEqual([3, 4, 5, 6, 0, 0, 0, 1]);
  expect(old.isAvailable()).toBe(false);
  await click('Next frame');
  expect(runtime.viewer.addModel).toHaveBeenCalledTimes(1);
  expect(vi.mocked(runtime.viewer.addModel).mock.calls[0]![0]).toContain(
    'H 2 0 0',
  );
  expect(runtime.viewer.render).toHaveBeenCalledTimes(1);
  vi.mocked(runtime.viewer.addModel).mockClear();
  vi.mocked(runtime.viewer.render).mockClear();
  source = makeSource(6, 'r7', [{ atomIds: ['O', 'H'], order: 1 }]);
  await render();
  expect(runtime.viewer.addModel).toHaveBeenCalledTimes(1);
  expect(runtime.viewer.render).toHaveBeenCalledTimes(1);
});

it('clears actual surfaces and labels when changing representations/annotations, while batching label additions', async () => {
  const { VIEWER_COMMAND_BATCH_ACTION } =
    await import('./GraphMoleculeViewerCommands');
  const discovery = structuredClone(EXTENSION_FIXTURES.grafico.discovery);
  discovery.actions.push(VIEWER_COMMAND_BATCH_ACTION);
  discovery.capabilities[VIEWER_COMMAND_BATCH_ACTION.id] = true;
  await act(async () =>
    root.render(
      <GraphMoleculeViewer
        source={{ content: [first], target }}
        onReady={onReady}
        extensionHost={{ discovery }}
      />,
    ),
  );
  const execute = async (operationId: string, commands: unknown[]) =>
    act(async () => {
      const result = await handle.execute({
        version: 1,
        requestId: operationId,
        operationId,
        actionId: VIEWER_COMMAND_BATCH_ACTION.id,
        target,
        payload: { version: 1, commands } as never,
      });
      expect(result.status).toBe('applied');
    });
  expect(runtime.viewer.removeAllSurfaces).not.toHaveBeenCalled();
  expect(runtime.viewer.removeAllLabels).not.toHaveBeenCalled();
  await execute('surface', [{ type: 'style', style: 'surface' }]);
  expect(runtime.viewer.addSurface).toHaveBeenCalledTimes(1);
  await execute('stick', [{ type: 'style', style: 'stick' }]);
  expect(runtime.viewer.removeAllSurfaces).toHaveBeenCalledTimes(1);
  await execute('annotations', [
    {
      type: 'annotations',
      annotations: [
        { id: 'a', atomId: '0', text: 'first' },
        { id: 'b', atomId: '1', text: 'second' },
      ],
    },
  ]);
  expect(runtime.viewer.removeAllLabels).not.toHaveBeenCalled();
  expect(runtime.viewer.addLabel).toHaveBeenCalledWith(
    'first',
    expect.any(Object),
    undefined,
    true,
  );
  expect(runtime.viewer.addLabel).toHaveBeenCalledWith(
    'second',
    expect.any(Object),
    undefined,
    true,
  );
  await execute('clear-annotations', [
    { type: 'annotations', annotations: [] },
  ]);
  expect(runtime.viewer.removeAllLabels).toHaveBeenCalledTimes(1);
});

it('binds a LIVE append directly to its latest verified frame before exposing ready handles', async () => {
  const frames = [
    first,
    first.replace('first', 'second'),
    first.replace('first', 'third'),
  ];
  const sourceFor = (count: number) => {
    const latest = {
      ...target,
      artifactId: 'revision-' + count,
      sourceRevision: 'r' + count,
    };
    return {
      content: frames.slice(0, count),
      target: latest,
      frameTargets: frames.slice(0, count).map((_, frameIndex) => ({
        ...latest,
        frameId: 'f' + frameIndex,
        frameIndex,
      })),
    };
  };
  const ready = vi.fn(onReady);
  await act(async () =>
    root.render(<GraphMoleculeViewer source={sourceFor(2)} onReady={ready} />),
  );
  ready.mockClear();
  vi.mocked(runtime.viewer.addModel).mockClear();
  const before = [...camera];
  await act(async () =>
    root.render(<GraphMoleculeViewer source={sourceFor(3)} onReady={ready} />),
  );
  expect(ready.mock.calls.map(([value]) => value.trajectoryIndex)).toEqual([2]);
  expect(handle.target).toMatchObject({
    artifactId: 'revision-3',
    frameId: 'f2',
    frameIndex: 2,
  });
  expect(runtime.viewer.addModel).toHaveBeenCalledTimes(1);
  expect(vi.mocked(runtime.viewer.addModel).mock.calls[0]![0]).toBe(frames[2]);
  expect(camera).toEqual(before);
});

describe('per-frame unit cells', () => {
  const cubic = (a: number) => ({
    vectors: [
      [a, 0, 0],
      [0, a, 0],
      [0, 0, a],
    ] as [
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ],
    periodic: [true, true, true] as [boolean, boolean, boolean],
    unit: 'angstrom' as const,
  });
  const frameTargets = (count: number) =>
    Array.from({ length: count }, (_, frameIndex) => ({
      ...target,
      frameId: 'f' + frameIndex,
      frameIndex,
    }));
  // Identical coordinates in every frame: only the cell distinguishes them.
  const cellSource = (
    frameCells: (ReturnType<typeof cubic> | null)[],
    count = frameCells.length,
  ) => ({
    content: Array(count).fill(first),
    target: frameTargets(count).at(-1),
    frameTargets: frameTargets(count),
    uuid: 'o',
    metadata: {
      version: 1 as const,
      objectId: target.objectId,
      sourceRevision: target.sourceRevision,
      checksum: target.checksum,
      format: 'xyz',
      stream: { id: 's', frameId: 'f' + (count - 1), frameIndex: count - 1 },
      frameTargets: frameTargets(count),
      frameCells,
    },
  });
  const drawnEdge = () => {
    // The initial render may repaint once for the inherited theme; the
    // current box is always the last 12 edges.
    const all = vi.mocked(runtime.viewer.addLine).mock.calls;
    expect(all.length).toBeGreaterThan(0);
    expect(all.length % 12).toBe(0);
    const calls = all.slice(-12);
    return Math.max(
      ...calls.flatMap(([line]) => {
        const { start, end } = line as {
          start: { x: number; y: number; z: number };
          end: { x: number; y: number; z: number };
        };
        return [start.x, start.y, start.z, end.x, end.y, end.z];
      }),
    );
  };
  const show = async (source: ReturnType<typeof cellSource>) =>
    act(async () =>
      root.render(<GraphMoleculeViewer source={source} onReady={onReady} />),
    );

  it('draws the displayed frame cell and redraws it on frame change', async () => {
    await show(cellSource([cubic(2), null, cubic(4)]));
    expect(drawnEdge()).toBe(4);
    expect(button('Hide unit cell').disabled).toBe(false);
    vi.mocked(runtime.viewer.addLine).mockClear();
    vi.mocked(runtime.viewer.removeShape).mockClear();
    await click('First frame');
    expect(drawnEdge()).toBe(2);
    expect(handle.target).toEqual(frameTargets(3)[0]);
    vi.mocked(runtime.viewer.addLine).mockClear();
    await click('Next frame');
    // null: this frame has no cell, and no extXYZ/crystal fallback is drawn.
    expect(runtime.viewer.addLine).not.toHaveBeenCalled();
    expect(runtime.viewer.addUnitCell).not.toHaveBeenCalled();
    expect(button('Show unit cell').disabled).toBe(true);
    await click('Next frame');
    expect(drawnEdge()).toBe(4);
    expect(button('Hide unit cell').disabled).toBe(false);
  });

  it('keeps selection and frame targets across frames with different cells', async () => {
    const submit = vi.fn();
    await act(async () =>
      root.render(
        <GraphMoleculeViewer
          source={cellSource([cubic(2), cubic(3), cubic(4)])}
          onReady={onReady}
          onSelectionSubmit={submit}
        />,
      ),
    );
    await click('First frame');
    await act(async () => runtime.click({ index: 1 }, runtime.viewer));
    await click('Next frame');
    expect(handle.isAvailable()).toBe(true);
    expect(handle.target).toEqual(frameTargets(3)[1]);
    expect(handle.captureView()).toMatchObject({
      target: frameTargets(3)[1],
      selectedIds: ['1'],
    });
    await click('Send selection');
    expect(submit).toHaveBeenCalledExactlyOnceWith({
      selections: [
        expect.objectContaining({
          atoms: [1],
          selectedIds: ['1'],
          target: frameTargets(3)[1],
        }),
      ],
    });
  });

  it('does not rebuild a pinned frame when later frame cells are appended', async () => {
    await show(cellSource([cubic(2), cubic(3)]));
    await click('First frame');
    vi.mocked(runtime.viewer.addModel).mockClear();
    vi.mocked(runtime.viewer.addLine).mockClear();
    await show(cellSource([cubic(2), cubic(3), cubic(5)]));
    expect(runtime.viewer.addModel).not.toHaveBeenCalled();
    expect(runtime.viewer.addLine).not.toHaveBeenCalled();
    expect(handle.target).toEqual(frameTargets(3)[0]);
  });

  it('fails visibly when frame cells do not cover the displayed frame', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await show(cellSource([cubic(2)], 2));
    expect(node.textContent).toContain(
      'Unable to render this molecular structure.',
    );
    expect(error).toHaveBeenCalled();
  });

  it('keeps a single metadata cell for every frame', async () => {
    const source = cellSource([cubic(3), cubic(3)]);
    const metadata: ArtifactMetadata = { ...source.metadata, cell: cubic(3) };
    delete metadata.frameCells;
    await act(async () =>
      root.render(
        <GraphMoleculeViewer
          source={{ ...source, metadata }}
          onReady={onReady}
        />,
      ),
    );
    expect(drawnEdge()).toBe(3);
    vi.mocked(runtime.viewer.addLine).mockClear();
    await click('First frame');
    // Same coordinates and cell: the drawn box is kept.
    expect(runtime.viewer.addLine).not.toHaveBeenCalled();
    expect(button('Hide unit cell').disabled).toBe(false);
  });
});
