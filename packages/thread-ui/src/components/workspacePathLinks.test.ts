import { describe, expect, it, vi } from 'vitest';
import { createWorkspacePathResolver, parseWorkspacePathText } from './workspacePathLinks';

describe('workspace path resolution', () => {
  it('shares one delayed retry after an interrupted XYZ directory check', async () => {
    vi.useFakeTimers();
    try {
      const parent = 'water_comparison_repeat_01/optimization';
      const listTree = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('connection unavailable'), { code: 'agent_unavailable' }))
        .mockResolvedValue({ path: parent, name: 'optimization', kind: 'directory', children: [
          { path: `${parent}/h2o_gfn2_opt.xyz`, name: 'h2o_gfn2_opt.xyz', kind: 'file' },
        ] });
      const resolve = createWorkspacePathResolver({ listTree }, { threadId: 't' }, '/workspace');
      const xyz = resolve(`${parent}/h2o_gfn2_opt.xyz`);
      const missing = resolve(`${parent}/missing.xyz`);
      await vi.advanceTimersByTimeAsync(14_999);
      expect(listTree).toHaveBeenCalledTimes(1);
      // A new subscriber while the backoff is pending shares the same request.
      const absolute = resolve(`/workspace/${parent}/h2o_gfn2_opt.xyz`);
      await vi.advanceTimersByTimeAsync(1);
      expect(await Promise.all([xyz, missing, absolute])).toEqual([true, false, true]);
      expect(listTree).toHaveBeenCalledTimes(2);
      expect(await resolve(`${parent}/h2o_gfn2_opt.xyz`)).toBe(true);
      expect(listTree).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it.each([
    { status: 403 }, { status: 404 }, { status: 429 }, { code: 'rate_limited' }, { code: 'grant_expired' },
  ])('does not retry a permanent refusal or host-owned rate limit: %o', async error => {
    const listTree = vi.fn().mockRejectedValue(error);
    const resolve = createWorkspacePathResolver({ listTree }, { threadId: 't' }, '/workspace');
    expect(await resolve('missing/file.xyz')).toBe(false);
    expect(await resolve('missing/another.xyz')).toBe(false);
    expect(listTree).toHaveBeenCalledOnce();
  });
  it('stops retrying a persistently unavailable host', async () => {
    vi.useFakeTimers();
    try {
      const listTree = vi.fn().mockRejectedValue({ status: 503 });
      const resolve = createWorkspacePathResolver({ listTree }, { threadId: 't' }, '/workspace');
      const result = resolve('results/water.xyz');
      await vi.advanceTimersByTimeAsync(120_000);
      expect(await result).toBe(false);
      expect(listTree).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it('normalizes relative, absolute, trailing directory slash and Windows line references', () => {
    expect(parseWorkspacePathText('docs/proposals/naming/pocketteam/', '/code')).toEqual({ path: 'docs/proposals/naming/pocketteam' });
    expect(parseWorkspacePathText('./.temp/result.md', '/code')).toEqual({ path: '.temp/result.md' });
    expect(parseWorkspacePathText('/code/docs/a.md:44', '/code')).toEqual({ path: 'docs/a.md', line: 44 });
    expect(parseWorkspacePathText('C:\\code\\docs\\a.md#L7', 'c:/code')).toEqual({ path: 'docs/a.md', line: 7 });
    for (const value of ['https://example.com/docs', '../outside/file', 'hello world', 'a\nb/c', 'javascript:alert(1)']) expect(parseWorkspacePathText(value, '/code')).toBeNull();
  });
  it('deduplicates parent checks, finds directories and files, and isolates different workspaces', async () => {
    const listTree = vi.fn(async () => ({ name: 'docs', path: 'docs', kind: 'directory' as const, children: [
      { name: 'a.md', path: 'docs/a.md', kind: 'file' as const },
      { name: 'assets', path: 'docs/assets', kind: 'directory' as const },
    ] }));
    const resolve = createWorkspacePathResolver({ listTree }, { threadId: 'a', workspaceId: 'one' }, '/code');
    expect(await Promise.all(['docs/a.md', 'docs/assets/', 'docs/missing'].map(resolve))).toEqual([true, true, false]);
    expect(listTree).toHaveBeenCalledOnce();
    expect(listTree).toHaveBeenCalledWith({ threadId: 'a', workspaceId: 'one', path: 'docs' });
    const other = createWorkspacePathResolver({ listTree: async () => ({ name: 'docs', path: 'docs', kind: 'directory', children: [] }) }, { threadId: 'b', workspaceId: 'two' }, '/other');
    expect(await other('docs/a.md')).toBe(false);
    expect(await resolve('/elsewhere/file.md')).toBe(false);
  });
  it('verifies paths a .workbenchignore hides from listings when the host can list hidden entries (ELA-260)', async () => {
    const listTree = vi.fn(async ({ showHidden }: { path?: string | null; showHidden?: boolean }) => ({ name: 'abc', path: 'runs/abc', kind: 'directory' as const,
      children: showHidden ? [{ name: 'x.out', path: 'runs/abc/x.out', kind: 'file' as const }] : [] }));
    const resolve = createWorkspacePathResolver({ listTree, hiddenFiles: true }, { threadId: 'a', workspaceId: 'one' }, '/code');
    expect(await resolve('runs/abc/x.out')).toBe(true);
    expect(await resolve('runs/abc/missing.out')).toBe(false);
    expect(listTree).toHaveBeenCalledWith({ threadId: 'a', workspaceId: 'one', path: 'runs/abc', showHidden: true });
    // A host that cannot list hidden entries is asked exactly as before.
    const plain = vi.fn(listTree);
    expect(await createWorkspacePathResolver({ listTree: plain }, { threadId: 'a' }, '/code')('runs/abc/x.out')).toBe(false);
    expect(plain).toHaveBeenCalledWith({ threadId: 'a', path: 'runs/abc' });
  });
});
