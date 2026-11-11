import { describe, expect, it, vi } from 'vitest';
import { createWorkspacePathResolver, parseWorkspacePathText } from './workspacePathLinks';

describe('workspace path resolution', () => {
  it('normalizes relative, absolute, trailing directory slash and Windows line references', () => {
    expect(parseWorkspacePathText('docs/proposals/naming/pocketteam/', '/code')).toEqual({ path: 'docs/proposals/naming/pocketteam' });
    expect(parseWorkspacePathText('./.temp/result.md', '/code')).toEqual({ path: '.temp/result.md' });
    expect(parseWorkspacePathText('/code/docs/a.md:44', '/code')).toEqual({ path: 'docs/a.md', line: 44 });
    expect(parseWorkspacePathText('C:\\code\\docs\\a.md#L7', 'c:/code')).toEqual({ path: 'docs/a.md', line: 7 });
    for (const value of ['https://example.com/docs', '../outside/file', 'hello world', 'a\nb/c', 'javascript:alert(1)']) expect(parseWorkspacePathText(value, '/code')).toBeNull();
  });
  it('deduplicates parent checks, finds directories and files, and isolates different workspaces', async () => {
    const listTree = vi.fn(async ({ path }: { path?: string | null }) => path ? { name: 'docs', path: 'docs', kind: 'directory' as const, children: [
      { name: 'a.md', path: 'docs/a.md', kind: 'file' as const },
      { name: 'assets', path: 'docs/assets', kind: 'directory' as const },
    ] } : { name: '', path: '', kind: 'directory' as const, children: [{ name: 'docs', path: 'docs', kind: 'directory' as const }] });
    const resolve = createWorkspacePathResolver({ listTree }, { threadId: 'a', workspaceId: 'one' }, '/code');
    expect(await Promise.all(['docs/a.md', 'docs/assets/', 'docs/missing'].map(resolve))).toEqual([true, true, false]);
    expect(listTree.mock.calls.map(([input]) => input)).toEqual([{ threadId: 'a', workspaceId: 'one', path: '' }, { threadId: 'a', workspaceId: 'one', path: 'docs' }]);
    const other = createWorkspacePathResolver({ listTree: async () => ({ name: 'docs', path: 'docs', kind: 'directory', children: [] }) }, { threadId: 'b', workspaceId: 'two' }, '/other');
    expect(await other('docs/a.md')).toBe(false);
    expect(await resolve('/elsewhere/file.md')).toBe(false);
  });
  it('verifies paths a .workbenchignore hides from listings when the host can list hidden entries (ELA-260)', async () => {
    const listTree = vi.fn(async ({ path, showHidden }: { path?: string | null; showHidden?: boolean }) => path
      ? { name: 'abc', path: 'runs/abc', kind: 'directory' as const, children: showHidden ? [{ name: 'x.out', path: 'runs/abc/x.out', kind: 'file' as const }] : [] }
      : { name: '', path: '', kind: 'directory' as const, children: [{ name: 'runs', path: 'runs', kind: 'directory' as const }] });
    const resolve = createWorkspacePathResolver({ listTree, hiddenFiles: true }, { threadId: 'a', workspaceId: 'one' }, '/code');
    expect(await resolve('runs/abc/x.out')).toBe(true);
    expect(await resolve('runs/abc/missing.out')).toBe(false);
    expect(listTree).toHaveBeenCalledWith({ threadId: 'a', workspaceId: 'one', path: 'runs/abc', showHidden: true });
    // A host that cannot list hidden entries is asked exactly as before.
    const plain = vi.fn(listTree);
    expect(await createWorkspacePathResolver({ listTree: plain }, { threadId: 'a' }, '/code')('runs/abc/x.out')).toBe(false);
    expect(plain).toHaveBeenCalledWith({ threadId: 'a', path: 'runs/abc' });
  });
  it('rules out scientific prose with the root listing instead of listing missing parents (ELA-311)', async () => {
    const listTree = vi.fn(async () => ({ name: '', path: '', kind: 'directory' as const, children: [{ name: 'runs', path: 'runs', kind: 'directory' as const }] }));
    const resolve = createWorkspacePathResolver({ listTree }, { threadId: 'a' }, '/code');
    const prose = ['PBE0-D4/def2-SVP', 'ωB97X-D4/def2-TZVP', 'B3LYP/6-31G', 'input/log', 'initialization/download'];
    expect(await Promise.all(prose.map(resolve))).toEqual(prose.map(() => false));
    expect(listTree).toHaveBeenCalledOnce();
    expect(listTree).toHaveBeenCalledWith({ threadId: 'a', path: '' });
  });
  it('keeps listings when the host rebuilds its resolver on every streamed update (ELA-311)', async () => {
    const listTree = vi.fn(async ({ path }: { path?: string | null }) => ({ name: '', path: path ?? '', kind: 'directory' as const,
      children: path ? [{ name: 'out.xyz', path: 'runs/out.xyz', kind: 'file' as const }] : [{ name: 'runs', path: 'runs', kind: 'directory' as const }] }));
    const workspace = { listTree };
    for (let render = 0; render < 50; render++) {
      const resolve = createWorkspacePathResolver(workspace, { threadId: 'a', workspaceId: 'one' }, '/code');
      expect(await resolve('runs/out.xyz')).toBe(true);
      expect(await resolve('PBE0-D4/def2-SVP')).toBe(false);
    }
    expect(listTree).toHaveBeenCalledTimes(2);
    // Another thread's workspace is a separate scope.
    expect(await createWorkspacePathResolver(workspace, { threadId: 'b', workspaceId: 'two' }, '/code')('runs/out.xyz')).toBe(true);
    expect(listTree).toHaveBeenCalledTimes(4);
  });
});
