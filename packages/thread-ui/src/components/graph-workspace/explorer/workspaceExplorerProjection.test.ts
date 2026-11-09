import { describe, expect, it } from 'vitest';

import type { WorkspaceTreeNode } from '../workspaceTree';
import { createWorkspaceExplorerModel } from './workspaceExplorerModel';
import { projectWorkspaceExplorerRows } from './workspaceExplorerProjection';

function node(
  path: string,
  kind: 'file' | 'directory',
  children: WorkspaceTreeNode[] = [],
): WorkspaceTreeNode {
  return {
    id: `workspace:${path}`,
    name: path.split('/').at(-1) || 'workspace',
    path,
    kind,
    children,
    ...(kind === 'directory'
      ? { childrenLoaded: true, hasChildren: children.length > 0 }
      : {}),
  };
}

describe('projectWorkspaceExplorerRows', () => {
  it('flattens expanded nodes with directory-first sorting and ARIA positions', () => {
    const model = createWorkspaceExplorerModel(
      node('', 'directory', [
        node('zeta.ts', 'file'),
        node('src', 'directory', [
          node('src/z.ts', 'file'),
          node('src/a.ts', 'file'),
        ]),
        node('alpha.ts', 'file'),
      ]),
    );
    const projection = projectWorkspaceExplorerRows(model, new Set(['src']));

    expect(projection.rows.map((row) => row.node.path)).toEqual([
      '',
      'src',
      'src/a.ts',
      'src/z.ts',
      'alpha.ts',
      'zeta.ts',
    ]);
    expect(projection.rows[1]).toMatchObject({
      depth: 1,
      posInSet: 1,
      setSize: 3,
      expanded: true,
    });
    expect(projection.rows[2]).toMatchObject({
      depth: 2,
      posInSet: 1,
      setSize: 2,
      expanded: undefined,
    });
    expect(projection.indexById.get('workspace:src/z.ts')).toBe(3);
  });

  it('keeps the virtual event directory after every workspace entry, without reparenting files', () => {
    const events: WorkspaceTreeNode = { ...node('thread-events:', 'directory', [
      { ...node('thread-events:/turn-1/event.json', 'file'), kind: 'event' },
    ]), id: 'thread-events', name: 'thread-events' };
    const root = node('', 'directory', [events, node('z.xyz', 'file'),
      node('thread-events', 'directory', [node('thread-events/real.txt', 'file')]),
      node('results', 'directory', [node('results/output.xyz', 'file')]), node('a.txt', 'file')]);
    for (const showEvents of [true, false]) {
      const model = createWorkspaceExplorerModel({ ...root, children: root.children.filter(child => showEvents || child.id !== 'thread-events') });
      const projection = projectWorkspaceExplorerRows(model, new Set(['thread-events:']));
      expect(projection.rows.map(row => row.node.path)).toEqual(['', 'results', 'thread-events', 'a.txt', 'z.xyz',
        ...(showEvents ? ['thread-events:', 'thread-events:/turn-1/event.json'] : [])]);
      const file = projection.rows.find(row => row.node.path === 'z.xyz')!;
      expect(file.depth).toBe(1);
      expect(file.node.parentId).toBe(model.rootId);
    }
  });

  it('omits descendants of collapsed directories', () => {
    const model = createWorkspaceExplorerModel(
      node('', 'directory', [
        node('src', 'directory', [node('src/index.ts', 'file')]),
      ]),
    );
    const projection = projectWorkspaceExplorerRows(model, new Set());

    expect(projection.rows.map((row) => row.node.path)).toEqual(['', 'src']);
    expect(projection.indexById.has('workspace:src/index.ts')).toBe(false);
  });

  it('filters loaded matches with their ancestors without mutating expansion', () => {
    const model = createWorkspaceExplorerModel(
      node('', 'directory', [
        node('src', 'directory', [
          node('src/components', 'directory', [
            node('src/components/Explorer.tsx', 'file'),
          ]),
          node('src/index.ts', 'file'),
        ]),
        node('README.md', 'file'),
      ]),
    );
    const projection = projectWorkspaceExplorerRows(model, new Set(), {
      filterQuery: 'explorer',
      filterMode: 'filter',
    });

    expect(projection.rows.map((row) => row.node.path)).toEqual([
      '',
      'src',
      'src/components',
      'src/components/Explorer.tsx',
    ]);
    expect(projection.matchCount).toBe(1);
  });

  it('compresses resolved single-directory chains', () => {
    const model = createWorkspaceExplorerModel(
      node('', 'directory', [
        node('src', 'directory', [
          node('src/features', 'directory', [
            node('src/features/explorer', 'directory', [
              node('src/features/explorer/index.ts', 'file'),
            ]),
          ]),
        ]),
      ]),
    );
    const projection = projectWorkspaceExplorerRows(
      model,
      new Set(['src/features/explorer']),
      { compactFolders: true },
    );

    expect(projection.rows.map((row) => row.node.path)).toEqual([
      '',
      'src/features/explorer',
      'src/features/explorer/index.ts',
    ]);
    expect(projection.rows[1]?.compactPathSegments).toEqual([
      'src',
      'features',
      'explorer',
    ]);
  });
});
