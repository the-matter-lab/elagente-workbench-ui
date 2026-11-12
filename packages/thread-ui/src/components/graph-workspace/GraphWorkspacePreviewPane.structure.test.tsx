// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThreadArtifactDto } from '@remote-codex/shared';

import { createDefaultPluginContextValue } from '../../plugins/plugin-context';
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
function documentsFor(contentHash: string, edited = false): WorkspaceDocuments {
  const draft = newDraft('structure', { ...preview, workspaceRevision: contentHash, fileIdentity: 'file-1', contentHash, encoding: 'utf-8', bom: false, eol: 'lf', readOnlyReason: null });
  return { documents: new Map([[node.path, edited ? editDraft(draft, `${content}\n`) : draft]]), source: 'structure-test', load: vi.fn(), change: vi.fn(), setEditing: vi.fn(), discard: vi.fn(), save: vi.fn(), reconcile: vi.fn(), adoptDisk: vi.fn(), checkDisk: vi.fn(), acceptVerifiedDisk: vi.fn() };
}
const plugins = { ...createDefaultPluginContextValue(), renderArtifact: ({ artifact }: { artifact: ThreadArtifactDto }) => <div data-testid="bound-artifact">{artifact.id}</div> };
const pane = (documents: WorkspaceDocuments, artifacts: ThreadArtifactDto[]) => render(
  <GraphWorkspacePreviewPane plugins={plugins} selectedTarget={{ kind: 'workspace-file', node }} previewFile={preview} documents={documents} artifacts={artifacts} />);

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
});
