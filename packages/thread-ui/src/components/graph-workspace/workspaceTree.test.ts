import { describe, expect, it } from 'vitest';

import type { ThreadArtifactDto, ThreadDetailDto } from '@remote-codex/shared';
import { collectArtifacts, compareWorkspaceNodes, workspaceRelativeFocusPath, workspaceTreeNodeToGraphNode } from './workspaceTree';

describe('workspaceTreeNodeToGraphNode', () => {
  it('aligns dot-prefixed API paths with link focus and subtree keys', () => {
    const tree = workspaceTreeNodeToGraphNode({path:'.', name:'project', kind:'directory', children:[
      {path:'./AGENTS.md', name:'AGENTS.md', kind:'file'},
      {path:'./docs', name:'docs', kind:'directory', children:[{path:'./docs/policy.md',name:'policy.md',kind:'file'}]},
    ]});
    expect(tree.path).toBe('');
    expect(tree.children[0]?.id).toBe('workspace:AGENTS.md');
    expect(tree.children[1]?.path).toBe('docs');
    expect(tree.children[1]?.children[0]?.workspaceNode?.path).toBe('docs/policy.md');
    expect(workspaceRelativeFocusPath('./AGENTS.md ', '/project')).toBe(tree.children[0]?.path);
  });

  it.each(['/outside/file.md', 'C:/Work/file.md', '//server/share/file.md'])(
    'preserves the absolute linked-file path %s', path => {
      expect(workspaceTreeNodeToGraphNode({path,name:'file.md',kind:'file'}).path).toBe(path);
    },
  );
});

describe('workspaceRelativeFocusPath', () => {
  it('converts absolute Unix and Windows paths to workspace-relative paths', () => {
    expect(
      workspaceRelativeFocusPath(
        '/home/u/treer/docs/architecture.md',
        '/home/u/treer',
      ),
    ).toBe('docs/architecture.md');
    expect(
      workspaceRelativeFocusPath(
        'C:\\Users\\treer\\docs\\architecture.md',
        'C:\\Users\\treer',
      ),
    ).toBe('docs/architecture.md');
  });

  it('preserves paths that are already relative to the workspace', () => {
    expect(
      workspaceRelativeFocusPath('docs/architecture.md', '/home/u/treer'),
    ).toBe('docs/architecture.md');
  });
});

describe('workspace ordering', () => {
  it('places only the virtual thread-events directory after real files and directories', () => {
    const entries = [
      { id: 'thread-events', path: 'thread-events:', name: 'thread-events', kind: 'directory' as const },
      { id: 'workspace:z.xyz', path: 'z.xyz', name: 'z.xyz', kind: 'file' as const },
      { id: 'workspace:thread-events', path: 'thread-events', name: 'thread-events', kind: 'directory' as const },
      { id: 'workspace:a.txt', path: 'a.txt', name: 'a.txt', kind: 'file' as const },
    ];
    expect(entries.sort(compareWorkspaceNodes).map(node => node.id)).toEqual([
      'workspace:thread-events', 'workspace:a.txt', 'workspace:z.xyz', 'thread-events',
    ]);
  });
});

describe('collectArtifacts', () => {
  const artifact = (id: string) => ({ id, name: `${id}.xyz` }) as unknown as ThreadArtifactDto;
  const detail = (turnArtifacts: string[], artifacts?: string[]) =>
    ({
      turns: [{ items: turnArtifacts.map((id) => ({ kind: 'artifact', artifact: artifact(id) })) }],
      liveItems: { items: [{ kind: 'artifact', artifact: artifact('live') }] },
      ...(artifacts ? { artifacts: artifacts.map(artifact) } : {}),
    }) as unknown as ThreadDetailDto;

  it('reads turn items and live items without a thread-level list', () => {
    expect(collectArtifacts(detail(['a', 'b'])).map((a) => a.id)).toEqual(['a', 'b', 'live']);
  });

  it('keeps the host publication order and adds artifacts published outside a turn', () => {
    // `adopted` was published between turns (structure/adopt); it has no turn item.
    expect(collectArtifacts(detail(['a', 'b'], ['a', 'adopted', 'b'])).map((a) => a.id)).toEqual(['a', 'adopted', 'b', 'live']);
  });
});
