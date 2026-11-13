/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import {
  StructureView,
  type StructureAsset,
} from '../../../plugin-xyz/src/index';
import { EXTENSION_FIXTURES, type ViewerInput } from '@remote-codex/shared';
import type { ExtensionHostAdapter } from '../plugins/plugin-types';
import { GraphMoleculeViewer } from '../components/graph-workspace/GraphMoleculeViewer';

const rendered = vi.hoisted(() => ({
  props: null as unknown as React.ComponentProps<typeof GraphMoleculeViewer>,
}));
vi.mock('@remote-codex/thread-ui/scientific-viewer', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    GraphMoleculeViewer: (
      props: React.ComponentProps<typeof GraphMoleculeViewer>,
    ) => {
      rendered.props = props;
      return (
        <div data-testid="viewer">
          {typeof props.source === 'object' && props.source?.content[0]}
        </div>
      );
    },
  };
});
let node: HTMLDivElement, root: Root;
const source = '2\r\nwater\r\nO 0 0 0\r\nH 1 0 0\r\n  ';
const checksum = (text: string) =>
  createHash('sha256').update(text).digest('hex');
function asset(text = source): StructureAsset {
  const hash = checksum(text);
  return {
    url: '/immutable/' + hash,
    checksum: hash,
    format: 'xyz',
    name: 'water.xyz',
    artifactId: 'artifact',
    metadata: {
      version: 1,
      objectId: 'water',
      sourceRevision: 'rev',
      checksum: hash,
      format: 'xyz',
      atoms: [
        { id: 'oxygen', element: 'O' },
        { id: 'hydrogen', element: 'H' },
      ],
    },
  };
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window.crypto, 'subtle', {
    value: webcrypto.subtle,
    configurable: true,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(source).buffer,
    })),
  );
  node = document.createElement('div');
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});
async function mount(next = asset(), host?: ExtensionHostAdapter) {
  await act(async () =>
    root.render(<StructureView asset={next} extensionHost={host} />),
  );
  await vi.waitFor(() => expect(node.textContent).toContain('water'));
}

it('only explicit selection calls the host and validates matching immutable acknowledgements', async () => {
  const submitInput = vi.fn(async (input: ViewerInput) => ({
    ...input,
    status: 'applied' as const,
    result: input.payload,
  }));
  await mount(asset(), {
    discovery: EXTENSION_FIXTURES.grafico.discovery,
    submitInput,
  });
  expect(submitInput).not.toHaveBeenCalled();
  const target =
    typeof rendered.props.source === 'object'
      ? rendered.props.source!.target!
      : null!;
  await act(async () =>
    rendered.props.onSelectionSubmit!({
      selections: [
        { moleculeId: 'water', atoms: [0], selectedIds: ['oxygen'], target },
      ],
    }),
  );
  expect(submitInput).toHaveBeenCalledTimes(1);
  expect(submitInput.mock.calls[0]![0]).toMatchObject({
    kind: 'selection',
    submission: 'explicit',
    target: {
      artifactId: 'artifact',
      objectId: 'water',
      sourceRevision: 'rev',
      checksum: checksum(source),
    },
    payload: { selectedIds: ['oxygen'] },
  });
});

it('reuses operation identity after an ambiguous network failure and does not claim stale acknowledgement success', async () => {
  const submitInput = vi
    .fn()
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockImplementation(async (input: ViewerInput) => ({
      ...input,
      target: { ...input.target, sourceRevision: 'stale' },
      status: 'applied',
      result: input.payload,
    }));
  await mount(asset(), {
    discovery: EXTENSION_FIXTURES.grafico.discovery,
    submitInput,
  });
  const target =
    typeof rendered.props.source === 'object'
      ? rendered.props.source!.target!
      : null!;
  const selection = {
    selections: [
      { moleculeId: 'water', atoms: [0], selectedIds: ['oxygen'], target },
    ],
  };
  await expect(rendered.props.onSelectionSubmit!(selection)).rejects.toThrow(
    'Connection lost',
  );
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(rendered.props.onSelectionSubmit!(selection)).rejects.toThrow(
    'The Agent’s reply doesn’t match this structure. Reopen it, then try again.',
  );
  expect(String(warn.mock.calls[0]?.[1])).toContain('target mismatch');
  warn.mockRestore();
  expect(submitInput.mock.calls[1]![0].operationId).toBe(
    submitInput.mock.calls[0]![0].operationId,
  );
});

it('partial staged submission retries skip acknowledged objects and reuse the failed operation', async () => {
  const submitInput = vi
    .fn()
    .mockImplementationOnce(async (input: ViewerInput) => ({
      ...input,
      status: 'applied',
      result: input.payload,
    }))
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockImplementation(async (input: ViewerInput) => ({
      ...input,
      status: 'applied',
      result: input.payload,
    }));
  await mount(asset(), {
    discovery: EXTENSION_FIXTURES.grafico.discovery,
    submitInput,
  });
  const target =
    typeof rendered.props.source === 'object'
      ? rendered.props.source!.target!
      : null!;
  const selection = {
    selections: [
      { moleculeId: 'water', atoms: [0], selectedIds: ['oxygen'], target },
      {
        moleculeId: 'other',
        atoms: [1],
        selectedIds: ['hydrogen'],
        target: { ...target, objectId: 'other' },
      },
    ],
  };
  await expect(rendered.props.onSelectionSubmit!(selection)).rejects.toThrow(
    'Connection lost',
  );
  await rendered.props.onSelectionSubmit!(selection);
  expect(submitInput).toHaveBeenCalledTimes(3);
  expect(submitInput.mock.calls[2]![0].target.objectId).toBe('other');
  expect(submitInput.mock.calls[2]![0].operationId).toBe(
    submitInput.mock.calls[1]![0].operationId,
  );
});

it('preserves canonical bytes when rendering a separate immutable representation and prevents redundant refetch', async () => {
  const renderText = source.replace('1 0 0', '0.529 0 0');
  const next = {
    ...asset(renderText),
    source: {
      url: '/canonical',
      checksum: checksum(source),
      format: 'xyz' as const,
      name: 'original.xyz',
    },
    metadata: asset().metadata,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) => ({
      ok: true,
      arrayBuffer: async () =>
        new TextEncoder().encode(
          url.pathname === '/canonical' ? source : renderText,
        ).buffer,
    })),
  );
  await mount(next);
  expect(node.textContent).toContain('0.529');
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  let blob: Blob | undefined;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (value: Blob) => {
      blob = value;
      return 'blob:source';
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  const download = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  rendered.props.onDownloadSource!();
  const bytes = await new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob!);
  });
  expect(Array.from(new Uint8Array(bytes))).toEqual(
    Array.from(new TextEncoder().encode(source)),
  );
  expect(
    (download.mock.instances[0] as unknown as HTMLAnchorElement)?.download,
  ).toBe('original.xyz');
  await mount({ ...next });
  expect(fetch).toHaveBeenCalledTimes(2);
  download.mockRestore();
});

it('forwards real PNG callbacks and keeps frozen capture artifact schema separate', async () => {
  const screenshot = vi.fn();
  await act(async () =>
    root.render(<StructureView asset={asset()} onScreenshot={screenshot} />),
  );
  await vi.waitFor(() => expect(node.textContent).toContain('water'));
  expect(rendered.props.onScreenshot).toBe(screenshot);
  await mount(asset(), {
    discovery: EXTENSION_FIXTURES.grafico.discovery,
    submitInput: vi.fn(),
  });
  expect(rendered.props.onScreenshot).toBeUndefined();
  // Grafico advertises no PNG action: nothing to tell the user.
  expect(node.querySelector('[role="note"]')).toBeNull();
  expect(node.textContent).not.toContain('unavailable');
});

it('hides absent actions and gives a short hint only when an offered action lacks a published target', async () => {
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
  // Estructural advertises no viewer actions.
  await mount(asset(), {
    discovery: { ...EXTENSION_FIXTURES.grafico.discovery, actions: [] },
    submitInput: vi.fn(),
  });
  expect(rendered.props.onSelectionSubmit).toBeUndefined();
  expect(node.querySelector('[role="note"]')).toBeNull();
  expect(node.textContent).not.toMatch(/host|immutable|unavailable/);
  expect(debug.mock.calls.flat().join(' ')).toContain(
    'Selection submission is unavailable',
  );
  // Grafico offers selection, but this file has no published artifact.
  const plain = { ...asset(), artifactId: undefined, metadata: undefined };
  await mount(plain, {
    discovery: EXTENSION_FIXTURES.grafico.discovery,
    submitInput: vi.fn(),
  });
  await vi.waitFor(() =>
    expect(node.querySelector('[role="note"]')?.textContent).toBe(
      'Open a structure the Agent has produced to send a selection.',
    ),
  );
  expect(rendered.props.onSelectionSubmit).toBeUndefined();
  debug.mockRestore();
});

it('checksum failure and cross-origin assets fail visibly without rendering unverified bytes', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const logged = () => error.mock.calls.map((call) => String(call[1])).join(' ');
  await act(async () =>
    root.render(
      <StructureView
        asset={{ ...asset(), checksum: 'a'.repeat(64), metadata: undefined }}
      />,
    ),
  );
  await vi.waitFor(() =>
    expect(node.querySelector('[role="alert"]')?.textContent).toBe(
      'Unable to load this structure. Reopen it to try again.',
    ),
  );
  expect(logged()).toContain('checksum differs');
  expect(node.querySelector('[data-testid="viewer"]')).toBeNull();
  await act(async () =>
    root.render(
      <StructureView
        asset={{ ...asset(), url: 'https://untrusted.invalid/structure' }}
      />,
    ),
  );
  await vi.waitFor(() => expect(logged()).toContain('must come from this app-server'));
  expect(node.querySelector('[role="alert"]')?.textContent).toBe(
    'Unable to load this structure. Reopen it to try again.',
  );
  error.mockRestore();
});

it('an update pending verification disables identity-bearing actions while retaining the viewer', async () => {
  await mount();
  const viewer = node.querySelector('[data-testid="viewer"]');
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  await act(async () =>
    root.render(
      <StructureView asset={asset(source + '\n')} onScreenshot={vi.fn()} />,
    ),
  );
  expect(rendered.props.loading).toBe(true);
  expect(node.querySelector('[data-testid="viewer"]')).toBe(viewer);
});

it('retains operation identity after accepted-only input and only completes on applied', async () => {
  const submitInput = vi
    .fn()
    .mockImplementationOnce(async (input: ViewerInput) => ({
      ...input,
      status: 'accepted',
    }))
    .mockImplementation(async (input: ViewerInput) => ({
      ...input,
      status: 'applied',
      result: input.payload,
    }));
  await mount(asset(), {
    discovery: EXTENSION_FIXTURES.grafico.discovery,
    submitInput,
  });
  const target =
    typeof rendered.props.source === 'object'
      ? rendered.props.source!.target!
      : null!;
  const selection = {
    selections: [
      { moleculeId: 'water', atoms: [0], selectedIds: ['oxygen'], target },
    ],
  };
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(rendered.props.onSelectionSubmit!(selection)).rejects.toThrow(
    'The Agent hasn’t confirmed this yet. Send it again to check.',
  );
  expect(String(warn.mock.calls[0]?.[1])).toContain('awaiting native completion');
  warn.mockRestore();
  await rendered.props.onSelectionSubmit!(selection);
  expect(submitInput.mock.calls[1]![0].operationId).toBe(
    submitInput.mock.calls[0]![0].operationId,
  );
});

it('requires host PNG upload for artifact-backed screenshots and forwards personal active-view callback', async () => {
  const discovery = structuredClone(EXTENSION_FIXTURES.grafico.discovery);
  const action = {
    id: 'elagente.viewer.screenshot',
    label: 'Submit screenshot',
    execution: 'native' as const,
    completion: 'applied' as const,
    inputSchema: {
      type: 'object' as const,
      additionalProperties: false as const,
      required: ['imageArtifactId', 'mediaType', 'width', 'height'],
      properties: {
        imageArtifactId: { type: 'string' as const },
        mediaType: { type: 'string' as const, enum: ['image/png'] },
        width: { type: 'integer' as const, minimum: 1 },
        height: { type: 'integer' as const, minimum: 1 },
      },
    },
    resultSchema: {
      type: 'object' as const,
      additionalProperties: false as const,
      properties: {},
    },
  };
  discovery.capabilities[action.id] = true;
  discovery.actions.push(action);
  await mount(asset(), { discovery, submitInput: vi.fn() });
  expect(rendered.props.onScreenshot).toBeUndefined();
  const onActive = vi.fn(),
    onScreenshot = vi.fn();
  await act(async () =>
    root.render(
      <StructureView
        asset={asset()}
        onActive={onActive}
        onScreenshot={onScreenshot}
      />,
    ),
  );
  expect(rendered.props.onActive).toBe(onActive);
  expect(rendered.props.onScreenshot).toBe(onScreenshot);
});
