import type { ThreadWorkspaceAdapter } from '../adapters';
import { localFileHref, relativeWorkspacePath } from './workspacePaths';

export type WorkspacePathResolver = (path: string) => Promise<boolean>;

// Hosts own rate-limit backoff and access recovery. Only retry interrupted reads;
// a missing directory or an authorization refusal must not create more traffic.
function isInterruptedRead(error: unknown) {
  if (error instanceof TypeError) return true; // fetch/network failure
  if (!error || typeof error !== 'object') return false;
  const { status, code } = error as { status?: number; code?: string };
  if (status !== undefined) return status >= 500 && status <= 599;
  return typeof code === 'string' && ['request_timeout', 'agent_unavailable'].includes(code.toLowerCase());
}

/** A resolver belongs to one adapter/device/workspace; never cache across scopes. */
export function createWorkspacePathResolver(
  adapter: Pick<ThreadWorkspaceAdapter, 'listTree' | 'statLinkedFile' | 'hiddenFiles'>,
  identity: { threadId: string; workspaceId?: string | null },
  workspaceRoot: string,
): WorkspacePathResolver {
  const cache = new Map<string, { expires: number; result: Promise<Set<string>> }>();
  let active = 0;
  const queue: Array<() => void> = [];
  const run = async (load: () => Promise<Set<string>>) => {
    if (active >= 4) await new Promise<void>(resolve => queue.push(resolve));
    else active++;
    try { return await load(); }
    finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  };
  return async path => {
    const relative = relativeWorkspacePath(path, workspaceRoot);
    // Parent listings verify files and directories without reading file content.
    const parent = relative === null ? `host:${path}` : relative.split('/').slice(0, -1).join('/');
    let entry = cache.get(parent);
    if (!entry || entry.expires < Date.now()) {
      const load = async () => {
        if (relative === null) {
          if (!adapter.statLinkedFile) return new Set<string>();
          const node = await adapter.statLinkedFile({ threadId: identity.threadId, path });
          return new Set([node.path]);
        }
        // A reply may name a file under a folder hidden by default (`.workbenchignore`);
        // the Explorer can still open it, so verify against the listing with hidden entries.
        const tree = await adapter.listTree({ ...identity, path: parent, ...(adapter.hiddenFiles ? { showHidden: true } : {}) });
        return new Set((tree.children ?? []).map(node => relativeWorkspacePath(node.path, workspaceRoot) ?? node.path));
      };
      const result = run(async () => {
        try { return await load(); }
        catch (error) {
          if (!isInterruptedRead(error)) throw error;
          // One retry per parent listing, shared by every path waiting on it.
          // Keep the concurrency slot during backoff to bound queued probes.
          await new Promise<void>(resolve => setTimeout(resolve, 15_000));
          return load();
        }
      }).catch(() => new Set<string>());
      // Pending checks (including backoff) must not expire and duplicate work.
      const pending = { expires: Infinity, result };
      void result.then(() => { pending.expires = Date.now() + 15_000; });
      entry = pending;
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(parent, entry);
    }
    return (await entry.result).has(relative ?? path);
  };
}

export function parseWorkspacePathText(value: string, root?: string) {
  if (value.length > 4096 || /[\n\r\0]/.test(value) || !/[\\/]|\.[a-z\d]{1,12}(?:(?:#L|:)\d+)?$/i.test(value)) return null;
  const candidate = localFileHref(value);
  if (!candidate) return null;
  const match = candidate.match(/(?:#L|:)(\d+)(?::\d+)?$/);
  const raw = match ? candidate.slice(0, -match[0].length) : candidate;
  const relative = root ? relativeWorkspacePath(raw, root) : null;
  if (relative === null && !raw.startsWith('/') && !/^[a-z]:\//i.test(raw)) return null;
  const path = relative ?? raw;
  return path ? { path, ...(match ? { line: Number(match[1]) } : {}) } : null;
}

const pathPattern = /(?<![\p{L}\p{N}_:/.-])(?:[a-zA-Z]:[\\/]|\.{1,2}\/|\/)?[\p{L}\p{N}_.-]+(?:[\\/][\p{L}\p{N}_.-]+)+(?:[\\/])?(?:(?:#L|:)\d+(?::\d+)?)?/gu;
export const hasWorkspacePathSyntax = (text: string) => new RegExp(pathPattern).test(text);

interface MarkdownNode { type: string; value?: string; children?: MarkdownNode[]; url?: string; }
/** Leave code fences, existing links, images, HTML and math untouched. */
export function remarkWorkspacePaths() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node.children || ['link', 'linkReference', 'code', 'inlineCode', 'html', 'math', 'inlineMath'].includes(node.type)) return;
      node.children = node.children.flatMap(child => {
        if (child.type !== 'text' || !child.value) { visit(child); return [child]; }
        const parts: MarkdownNode[] = [];
        let end = 0;
        for (const match of child.value.matchAll(new RegExp(pathPattern))) {
          if (match.index > end) parts.push({ type: 'text', value: child.value.slice(end, match.index) });
          const path = match[0].replace(/[.,;!?]+$/, '');
          parts.push({ type: 'link', url: `workspace-auto:${encodeURIComponent(path)}`, children: [{ type: 'text', value: path }] });
          end = match.index + path.length;
        }
        if (end < child.value.length) parts.push({ type: 'text', value: child.value.slice(end) });
        return parts.length ? parts : [child];
      });
    };
    visit(tree);
  };
}
