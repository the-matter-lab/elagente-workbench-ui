/** @vitest-environment jsdom */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import {
  INLINE_STRUCTURE_CAPABILITY,
  INLINE_STRUCTURE_MAX_BYTES,
  StructureView,
  type StructureAsset,
} from '../../../plugin-xyz/src/index';
import { EXTENSION_FIXTURES } from '@remote-codex/shared';

const observed = vi.hoisted(() => ({ props: null as any, mounts: 0 }));
vi.mock('@remote-codex/thread-ui/scientific-viewer', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  // Exercise the byte-preserving source parser even before rebuilding dist.
  ...(await import('../components/graph-workspace/GraphMoleculeViewerData')),
  GraphMoleculeViewer: (props: any) => {
    observed.props = props;
    useEffect(() => {
      observed.mounts++;
    }, []);
    return <div data-testid="viewer">{props.source.content[0]}</div>;
  },
}));
const first = '1\r\nhelium\r\nHe 0 0 0\r\n';
const second = first + '1\nnext\nHe 1 0 0\n';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function asset(content = first): StructureAsset {
  const checksum = hash(content);
  return {
    url: '/immutable/' + checksum,
    checksum,
    format: 'xyz',
    name: 'helium.xyz',
    artifactId: 'artifact-' + checksum,
    metadata: {
      version: 1,
      objectId: 'helium',
      sourceRevision: checksum,
      checksum,
      format: 'xyz',
      atoms: [{ id: 'canonical-helium', element: 'He' }],
      inlineSource: { version: 1, encoding: 'utf8', content },
    },
  };
}
function host(enabled = true) {
  return {
    discovery: {
      ...EXTENSION_FIXTURES.grafico.discovery,
      capabilities: {
        ...EXTENSION_FIXTURES.grafico.discovery.capabilities,
        [INLINE_STRUCTURE_CAPABILITY]: enabled,
      },
    },
  };
}
let root: Root, node: HTMLDivElement;
let errorLog: ReturnType<typeof vi.spyOn>;
// Users see a short load failure; the verification reason stays in the console.
function expectLoadFailure(detail: string) {
  expect(node.querySelector('[role=alert]')?.textContent).toBe(
    'Unable to load this structure. Reopen it to try again.',
  );
  expect(errorLog.mock.calls.map((call) => String(call[1])).join(' ')).toContain(
    detail,
  );
}
beforeEach(() => {
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window.crypto, 'subtle', {
    value: webcrypto.subtle,
    configurable: true,
  });
  observed.props = null;
  observed.mounts = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(first).buffer,
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
  errorLog.mockRestore();
});
async function render(next: StructureAsset, enabled = true) {
  await act(async () =>
    root.render(<StructureView asset={next} extensionHost={host(enabled)} />),
  );
}

it('verifies inline immutable bytes without HTTP and updates the same viewer and exact target on append', async () => {
  await render(asset());
  await vi.waitFor(() => expect(node.textContent).toContain('helium'));
  const viewer = node.querySelector('[data-testid=viewer]');
  await render(asset(second));
  await vi.waitFor(() => expect(node.textContent).toContain('next'));
  expect(fetch).not.toHaveBeenCalled();
  expect(node.querySelector('[data-testid=viewer]')).toBe(viewer);
  expect(observed.mounts).toBe(1);
  expect(observed.props.source.content[0]).toBe(second);
  expect(observed.props.source.target).toMatchObject({
    artifactId: asset(second).artifactId,
    sourceRevision: hash(second),
    checksum: hash(second),
  });
});

it.each([false, undefined])(
  'downloads canonical bytes when inline delivery is disabled or omitted (%s)',
  async (enabled) => {
    const next = asset();
    next.metadata!.inlineSource!.content = 'untrusted';
    await act(async () =>
      root.render(
        <StructureView
          asset={next}
          extensionHost={enabled === undefined ? undefined : host(false)}
        />,
      ),
    );
    await vi.waitFor(() => expect(node.textContent).toContain('helium'));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(observed.props.source.content[0]).toBe(first);
  },
);

it('keeps the verified view unavailable on a corrupt inline append, without falling back or submitting', async () => {
  await render(asset());
  await vi.waitFor(() => expect(node.textContent).toContain('helium'));
  const next = asset(second);
  next.metadata!.inlineSource!.content += 'changed';
  await render(next);
  await vi.waitFor(() =>
    expectLoadFailure('checksum differs'),
  );
  expect(observed.props.loading).toBe(true);
  expect(observed.props.source.content[0]).toBe(first);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  { version: 2, encoding: 'utf8', content: first },
  { version: 1, encoding: 'base64', content: first },
  { version: 1, encoding: 'utf8', content: '' },
  {
    version: 1,
    encoding: 'utf8',
    content: 'x'.repeat(INLINE_STRUCTURE_MAX_BYTES + 1),
  },
  {
    version: 1,
    encoding: 'utf8',
    content: 'é'.repeat(INLINE_STRUCTURE_MAX_BYTES / 2 + 1),
  },
  { version: 1, encoding: 'utf8', content: '\ud800' },
])(
  'rejects invalid version, encoding or UTF-8 bounds before HTTP (case %#)',
  async (inline) => {
    const next = asset();
    next.metadata!.inlineSource = inline as any;
    await render(next);
    await vi.waitFor(() =>
      expect(node.querySelector('[role=alert]')).not.toBeNull(),
    );
    expect(observed.props).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  },
);

it('retains exact per-frame checksum/count validation on the inline path', async () => {
  const next = asset(second),
    target = {
      artifactId: next.artifactId!,
      objectId: 'helium',
      sourceRevision: hash(second),
      checksum: hash(second),
      streamId: 'helium-stream',
      frameId: 'f1',
      frameIndex: 1,
    };
  next.target = target;
  next.frameTargets = [
    { ...target, frameId: 'f0', frameIndex: 0, checksum: hash(first) },
    { ...target, frameId: 'f1', frameIndex: 1, checksum: hash(first) },
  ];
  await render(next);
  await vi.waitFor(() =>
    expectLoadFailure('Frame checksum differs'),
  );
  expect(observed.props).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('accepts the exact UTF-8 byte cap without changing whitespace or checksum', async () => {
  const content =
    first +
    ' '.repeat(
      INLINE_STRUCTURE_MAX_BYTES - new TextEncoder().encode(first).length,
    );
  await render(asset(content));
  await vi.waitFor(() =>
    expect(observed.props?.source.content[0]).toBe(content),
  );
  expect(fetch).not.toHaveBeenCalled();
});

it('requires the inline checksum to match the published artifact as well as canonical metadata', async () => {
  const next = asset();
  next.source = {
    url: '/canonical',
    checksum: next.checksum,
    format: 'xyz',
    name: 'original.xyz',
  };
  next.checksum = hash('distinct render representation');
  await render(next);
  await vi.waitFor(() =>
    expectLoadFailure('published artifact and canonical metadata'),
  );
  expect(observed.props).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('verifies valid UTF-8 BOM bytes against both exact published checksums', async () => {
  const content = '\ufeff' + first;
  const next = asset(content);
  expect(Array.from(new TextEncoder().encode(content).slice(0, 3))).toEqual([
    0xef, 0xbb, 0xbf,
  ]);
  expect(next.checksum).not.toBe(hash(first));
  await render(next);
  await vi.waitFor(() =>
    expect(node.querySelector('[role=alert]')?.textContent).toBeUndefined(),
  );
  await vi.waitFor(() =>
    expect(observed.props?.source.target.checksum).toBe(hash(content)),
  );
  expect(observed.props.source.metadata.checksum).toBe(hash(content));
  expect(node.querySelector('[role=alert]')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('preserves the BOM in canonical per-frame checksum validation', async () => {
  const nextFrame = '1\nnext\nHe 1 0 0\n';
  const content = '\ufeff' + first + nextFrame;
  const next = asset(content),
    target = {
      artifactId: next.artifactId!,
      objectId: 'helium',
      sourceRevision: hash(content),
      checksum: hash(content),
      streamId: 'helium-stream',
      frameId: 'f1',
      frameIndex: 1,
    };
  next.target = target;
  next.frameTargets = [
    {
      ...target,
      frameId: 'f0',
      frameIndex: 0,
      checksum: hash('\ufeff' + first),
    },
    { ...target, frameId: 'f1', frameIndex: 1, checksum: hash(nextFrame) },
  ];
  await render(next);
  await vi.waitFor(() =>
    expect(node.querySelector('[role=alert]')?.textContent).toBeUndefined(),
  );
  await vi.waitFor(() =>
    expect(observed.props?.source.target.checksum).toBe(hash(content)),
  );
  expect(observed.props.source.frameTargets).toEqual(next.frameTargets);
  expect(node.querySelector('[role=alert]')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
