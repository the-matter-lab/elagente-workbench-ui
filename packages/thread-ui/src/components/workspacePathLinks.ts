import type { ThreadWorkspaceAdapter } from '../adapters';
import { localFileHref, relativeWorkspacePath } from './workspacePaths';

export type WorkspacePathResolver = (path: string) => Promise<boolean>;

type WorkspacePathAdapter = Pick<ThreadWorkspaceAdapter, 'listTree' | 'statLinkedFile' | 'hiddenFiles'>;
interface ResolverScope {
  cache: Map<string, { expires: number; result: Promise<Set<string>> }>;
  active: number;
  queue: Array<() => void>;
}
// Listings are shared by every resolver for the same adapter and workspace. A host
// may rebuild its resolver on each streamed update (ELA-311); a cache owned by one
// resolver was then dropped every time, and each render listed every parent again.
const scopes = new WeakMap<object, Map<string, ResolverScope>>();
function scopeFor(adapter: WorkspacePathAdapter, key: string) {
  let byKey = scopes.get(adapter);
  if (!byKey) scopes.set(adapter, (byKey = new Map()));
  let scope = byKey.get(key);
  if (!scope) byKey.set(key, (scope = { cache: new Map(), active: 0, queue: [] }));
  return scope;
}

/** Listings are cached per adapter/device/workspace; never across scopes. */
export function createWorkspacePathResolver(
  adapter: WorkspacePathAdapter,
  identity: { threadId: string; workspaceId?: string | null },
  workspaceRoot: string,
): WorkspacePathResolver {
  const scope = scopeFor(adapter, JSON.stringify([identity.threadId, identity.workspaceId ?? null, workspaceRoot, Boolean(adapter.hiddenFiles)]));
  const run = async (load: () => Promise<Set<string>>) => {
    if (scope.active >= 4) await new Promise<void>(resolve => scope.queue.push(resolve));
    else scope.active++;
    try { return await load(); }
    finally {
      const next = scope.queue.shift();
      if (next) next();
      else scope.active--;
    }
  };
  const entries = (key: string, load: () => Promise<Set<string>>) => {
    let entry = scope.cache.get(key);
    if (!entry || entry.expires < Date.now()) {
      entry = { expires: Date.now() + 15_000, result: run(load).catch(() => new Set<string>()) };
      if (scope.cache.size >= 64) scope.cache.delete(scope.cache.keys().next().value!);
      scope.cache.set(key, entry);
    }
    return entry.result;
  };
  // A reply may name a file under a folder hidden by default (`.workbenchignore`);
  // the Explorer can still open it, so verify against the listing with hidden entries.
  const list = (dir: string) => entries(dir, async () => {
    const tree = await adapter.listTree({ ...identity, path: dir, ...(adapter.hiddenFiles ? { showHidden: true } : {}) });
    return new Set((tree.children ?? []).map(node => relativeWorkspacePath(node.path, workspaceRoot) ?? node.path));
  });
  return async path => {
    const relative = relativeWorkspacePath(path, workspaceRoot);
    if (relative === null) {
      return (await entries(`host:${path}`, async () => {
        if (!adapter.statLinkedFile) return new Set<string>();
        const node = await adapter.statLinkedFile({ threadId: identity.threadId, path });
        return new Set([node.path]);
      })).has(path);
    }
    // Parent listings verify files and directories without reading file content.
    const segments = relative.split('/');
    const parent = segments.slice(0, -1).join('/');
    // Prose such as PBE0-D4/def2-SVP or input/log matches the path syntax. Its first
    // segment is not in the workspace root, so the shared root listing rules it out
    // without listing a parent that does not exist.
    if (parent && !(await list('')).has(segments[0]!)) return false;
    return (await list(parent)).has(relative);
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
