// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThreadArtifactDto } from '@remote-codex/shared';

import { createDefaultPluginContextValue, type PluginContextValue } from '../../plugins/plugin-context';
import type { ExtensionHostAdapter } from '../../plugins/plugin-types';
import { GraphWorkspacePreviewPane } from './GraphWorkspacePreviewPane';
import type { WorkspaceTreeNode } from './workspaceTree';
import type { WorkspaceDocuments } from './explorer/useWorkspaceDocuments';
import { editDraft, newDraft } from './explorer/workspaceDocuments';

vi.mock('../graph-chat/graphChatShiki', () => ({
  getGraphChatHighlighter: () => new Promise(() => undefined),
  syntaxThemeFor: () => 'github-light-default',
}));
vi.mock('./GraphMoleculeViewer', () => ({
  GraphMoleculeViewer: ({ title }: { title?: string }) => <div data-testid="plain-viewer">{title}</div>,
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

const content = '3\nwater\nO 0 0 0\nH 0 0.76 0.59\nH 0 -0.76 0.59\n';
const node: WorkspaceTreeNode = { id: 'workspace:out/water.xyz', path: 'out/water.xyz', name: 'water.xyz', kind: 'file', children: [] };
const preview = { path: node.path, name: node.name, content, language: 'xyz', size: content.length, truncated: false, nextOffset: content.length };
const current = 'b'.repeat(64);
const artifact = (id: string, checksum: string): ThreadArtifactDto => ({
  id, pluginId: 'elagente.xyz', type: 'chem.structure', title: node.name, workspacePath: node.path, payload: {}, createdAt: '2026-11-12T00:00:00Z',
  metadata: { version: 1, objectId: `urn:${id}`, sourceRevision: checksum, checksum, format: 'xyz' } as ThreadArtifactDto['metadata'],
});
function documentsFor(contentHash: string, edited = false, revision = 0): WorkspaceDocuments {
  const draft = { ...newDraft('structure', { ...preview, workspaceRevision: contentHash, fileIdentity: 'file-1', contentHash, encoding: 'utf-8', bom: false, eol: 'lf', readOnlyReason: null }), revision };
  return { documents: new Map([[node.path, edited ? editDraft(draft, `${content}\n`) : draft]]), source: 'structure-test', load: vi.fn(), change: vi.fn(), setEditing: vi.fn(), discard: vi.fn(), save: vi.fn(), reconcile: vi.fn(), adoptDisk: vi.fn(), checkDisk: vi.fn(), acceptVerifiedDisk: vi.fn() };
}
const renderArtifact = ({ artifact, displayName }: { artifact: ThreadArtifactDto; displayName?: string }) =>
  <div data-testid="bound-artifact" data-name={displayName}>{artifact.id}</div>;
const plugins = { ...createDefaultPluginContextValue(), renderArtifact };
const withHost = (adoptStructure: ExtensionHostAdapter['adoptStructure']): PluginContextValue => ({ ...plugins,
  extensions: { ...plugins.extensions!, extensionHost: { discovery: { contributions: [] } as unknown as ExtensionHostAdapter['discovery'], adoptStructure } } });
const element = (documents: WorkspaceDocuments, artifacts: ThreadArtifactDto[], context: PluginContextValue = plugins) =>
  <GraphWorkspacePreviewPane plugins={context} selectedTarget={{ kind: 'workspace-file', node }} previewFile={preview} documents={documents} artifacts={artifacts} />;
const pane = (documents: WorkspaceDocuments, artifacts: ThreadArtifactDto[], context?: PluginContextValue) => render(element(documents, artifacts, context));
const rerender = (documents: WorkspaceDocuments, artifacts: ThreadArtifactDto[], context?: PluginContextValue) =>
  act(() => root?.render(element(documents, artifacts, context)));
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const refusal = (code: string) => Object.assign(new Error(code), { code });

describe('structure file preview binds published artifacts (ELA-385)', () => {
  it('renders the artifact published for the current revision through its plugin', () => {
    const element = pane(documentsFor(current), [artifact('art_old', 'a'.repeat(64)), artifact('art_current', current)]);
    expect(element.querySelector('[data-testid="bound-artifact"]')?.textContent).toBe('art_current');
    expect(element.querySelector('[data-testid="plain-viewer"]')).toBeNull();
  });

  it('keeps the plain preview for an older checksum or an unverified document', () => {
    let element = pane(documentsFor(current), [artifact('art_old', 'a'.repeat(64))]);
    expect(element.querySelector('[data-testid="bound-artifact"]')).toBeNull();
    expect(element.querySelector('[data-testid="plain-viewer"]')?.textContent).toBe('water.xyz');
    act(() => root?.unmount()); root = null; container?.remove();
    element = pane(documentsFor(current, true), [artifact('art_current', current)]);
    expect(element.querySelector('[data-testid="bound-artifact"]')).toBeNull();
    expect(element.querySelector('[data-testid="plain-viewer"]')).not.toBeNull();
  });

  it('follows a superseded revision to its object’s latest revision, and says so', () => {
    const scanned = artifact('art_scan', current);
    const edited: ThreadArtifactDto = { ...artifact('art_edit', 'e'.repeat(64)), workspacePath: 'scientific-edits/e1.extxyz',
      metadata: { ...scanned.metadata!, sourceRevision: 'edit-1', checksum: 'e'.repeat(64) } };
    const element = pane(documentsFor(current), [scanned, edited]);
    expect(element.querySelector('[data-testid="bound-artifact"]')?.textContent).toBe('art_edit');
    // UX a/c: the object's origin name with a revision hint, wrapping; the path is the tooltip.
    const note = element.querySelector('[role="note"]')!;
    expect(note.textContent).toBe('Showing the latest revision: water.xyz (edit 1)');
    expect(note.getAttribute('title')).toBe('scientific-edits/e1.extxyz');
    expect(note.className).not.toContain('truncate');
    expect(element.querySelector('[data-testid="bound-artifact"]')?.getAttribute('data-name')).toBe('water.xyz (edit 1)');
  });
});

describe('structure file adoption (structure edits step 4)', () => {
  it('adopts a never-published clean revision once and binds the returned artifact', async () => {
    let resolve!: (value: ThreadArtifactDto) => void;
    const adopt = vi.fn(() => new Promise<ThreadArtifactDto>(done => { resolve = done; }));
    const context = withHost(adopt);
    const element = pane(documentsFor(current), [], context);
    // The plain preview shows while the host adopts.
    expect(element.querySelector('[data-testid="plain-viewer"]')).not.toBeNull();
    rerender(documentsFor(current), [], context);
    expect(adopt).toHaveBeenCalledTimes(1);
    expect(adopt).toHaveBeenCalledWith(node.path, current);
    await act(async () => resolve(artifact('art_adopted', current)));
    expect(element.querySelector('[data-testid="bound-artifact"]')?.textContent).toBe('art_adopted');
    expect(element.querySelector('[data-testid="bound-artifact"]')?.getAttribute('data-name')).toBe('water.xyz');
    expect(element.querySelector('[role="note"]')).toBeNull();
    // The thread's list catching up changes nothing and never adopts again.
    rerender(documentsFor(current, false, 1), [artifact('art_adopted', current)], context);
    expect(element.querySelector('[data-testid="bound-artifact"]')?.textContent).toBe('art_adopted');
    expect(adopt).toHaveBeenCalledTimes(1);
  });

  it('does not adopt a bound, edited or host-less structure', () => {
    const adopt = vi.fn(async () => undefined);
    pane(documentsFor(current), [artifact('art_current', current)], withHost(adopt));
    act(() => root?.unmount()); root = null; container?.remove();
    pane(documentsFor(current, true), [], withHost(adopt));
    expect(adopt).not.toHaveBeenCalled();
    act(() => root?.unmount()); root = null; container?.remove();
    const element = pane(documentsFor(current), []);
    expect(element.querySelector('[data-testid="plain-viewer"]')).not.toBeNull();
  });

  it.each([
    ['FILE_TOO_LARGE', 'This file is too large to edit.'],
    ['INPUT_UNSUPPORTED', 'This Agent can’t edit this format.'],
    ['INVALID_XYZ', 'This Agent can’t edit this format.'],
    ['TURN_BUSY', 'Editing becomes available after the current turn.'],
    ['UNSUPPORTED_CAPABILITY', null],
    ['FILE_NOT_FOUND', null],
  ])('explains a %s refusal in user wording, without retrying', async (code, message) => {
    const adopt = vi.fn(async () => { throw refusal(code); });
    const context = withHost(adopt);
    const element = pane(documentsFor(current), [], context);
    await settle();
    expect(element.querySelector('[data-testid="plain-viewer"]')).not.toBeNull();
    expect(element.querySelector('[role="note"]')?.textContent ?? null).toBe(message);
    rerender(documentsFor(current), [], context);
    await settle();
    expect(adopt).toHaveBeenCalledTimes(1);
  });

  it('retries TURN_BUSY after the next disk re-check', async () => {
    const adopt = vi.fn().mockRejectedValueOnce(refusal('TURN_BUSY')).mockResolvedValue(artifact('art_adopted', current));
    const context = withHost(adopt);
    const element = pane(documentsFor(current), [], context);
    await settle();
    expect(adopt).toHaveBeenCalledTimes(1);
    rerender(documentsFor(current, false, 1), [], context);
    await settle();
    expect(adopt).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[data-testid="bound-artifact"]')?.textContent).toBe('art_adopted');
    expect(element.querySelector('[role="note"]')).toBeNull();
  });

  it('re-checks the disk on FILE_CONFLICT and retries once when the revision is unchanged', async () => {
    const adopt = vi.fn(async () => { throw refusal('FILE_CONFLICT'); });
    const documents = documentsFor(current);
    pane(documents, [], withHost(adopt));
    await settle();
    expect(documents.checkDisk).toHaveBeenCalledWith(node.path);
    expect(adopt).toHaveBeenCalledTimes(2);
  });

  it('adopts a new disk revision after FILE_CONFLICT instead of retrying the old one', async () => {
    const next = 'c'.repeat(64);
    const adopt = vi.fn(async (_path: string, revision: string) => {
      if (revision === current) throw refusal('FILE_CONFLICT');
      return artifact('art_next', next);
    });
    const documents = documentsFor(current);
    const context = withHost(adopt);
    vi.mocked(documents.checkDisk).mockImplementation(async () => {
      documents.documents.set(node.path, documentsFor(next, false, 1).documents.get(node.path)!);
    });
    const element = pane(documents, [], context);
    await settle();
    rerender(documentsFor(next, false, 1), [], context);
    await settle();
    expect(adopt.mock.calls.map(call => call[1])).toEqual([current, next]);
    expect(element.querySelector('[data-testid="bound-artifact"]')?.textContent).toBe('art_next');
  });
});
