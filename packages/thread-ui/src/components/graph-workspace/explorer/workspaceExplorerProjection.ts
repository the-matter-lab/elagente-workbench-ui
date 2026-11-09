import { compareWorkspaceNodes } from '../workspaceTree';
import { matchWorkspaceExplorerNode } from './workspaceExplorerFilter';
import type {
  WorkspaceExplorerModel,
  WorkspaceExplorerProjection,
} from './workspaceExplorerTypes';

function sortedChildIds(model: WorkspaceExplorerModel, childIds: string[]) {
  return [...childIds].sort((leftId, rightId) => {
    const left = model.nodes.get(leftId);
    const right = model.nodes.get(rightId);
    if (!left || !right) {
      return left ? -1 : right ? 1 : 0;
    }
    return compareWorkspaceNodes(left.source, right.source);
  });
}

export function projectWorkspaceExplorerRows(
  model: WorkspaceExplorerModel,
  expandedPaths: ReadonlySet<string>,
  options: {
    filterQuery?: string;
    filterMode?: 'highlight' | 'filter';
    compactFolders?: boolean;
  } = {},
): WorkspaceExplorerProjection {
  const rows: WorkspaceExplorerProjection['rows'] = [];
  const indexById = new Map<string, number>();
  const matches = new Map<
    string,
    ReturnType<typeof matchWorkspaceExplorerNode>
  >();
  const includedIds = new Set<string>();
  const query = options.filterQuery?.trim() ?? '';
  // A directory match is navigable: explicitly expanding it reveals its
  // children, even when their names do not match the folder-name query.
  const includeExpandedChildren = (nodeId: string) => {
    const node = model.nodes.get(nodeId);
    if (!node || !expandedPaths.has(node.path)) return;
    for (const childId of node.childIds) {
      includedIds.add(childId);
      includeExpandedChildren(childId);
    }
  };

  if (query) {
    for (const node of model.nodes.values()) {
      const match = matchWorkspaceExplorerNode(node, query);
      if (!match) {
        continue;
      }
      matches.set(node.id, match);
      if (node.kind === 'directory') includeExpandedChildren(node.id);
      let current: typeof node | undefined = node;
      while (current) {
        includedIds.add(current.id);
        current = current.parentId
          ? model.nodes.get(current.parentId)
          : undefined;
      }
    }
  }

  const filtering = Boolean(query && options.filterMode === 'filter');
  const hasUnresolvedDirectories = [...model.nodes.values()].some(
    (node) => node.kind === 'directory' && node.childrenState !== 'resolved',
  );

  const visit = (
    nodeId: string,
    depth: number,
    posInSet: number,
    setSize: number,
  ) => {
    const node = model.nodes.get(nodeId);
    if (!node || (filtering && !includedIds.has(node.id))) {
      return;
    }

    let projectedNode = node;
    const compactPathSegments = [node.name];
    if (
      options.compactFolders &&
      !query &&
      depth > 0 &&
      node.kind === 'directory'
    ) {
      while (
        projectedNode.kind === 'directory' &&
        projectedNode.childrenState === 'resolved' &&
        !projectedNode.truncated &&
        projectedNode.childIds.length === 1
      ) {
        const child = model.nodes.get(projectedNode.childIds[0]!);
        if (!child || child.kind !== 'directory') {
          break;
        }
        compactPathSegments.push(child.name);
        projectedNode = child;
      }
    }

    const expanded =
      projectedNode.kind === 'directory'
        ? projectedNode.path === '' ||
          expandedPaths.has(projectedNode.path) ||
          (filtering && projectedNode.childIds.some((id) => includedIds.has(id)))
        : undefined;
    indexById.set(projectedNode.id, rows.length);
    const match = matches.get(projectedNode.id);
    rows.push({
      id: projectedNode.id,
      parentId: node.parentId,
      depth,
      posInSet,
      setSize,
      expanded,
      ...(compactPathSegments.length > 1 ? { compactPathSegments } : {}),
      ...(match?.ranges.length && !query.includes('/')
        ? { matchRanges: match.ranges }
        : {}),
      node: projectedNode,
    });
    if (!expanded) {
      return;
    }
    const childIds = sortedChildIds(model, projectedNode.childIds).filter(
      (childId) => !filtering || includedIds.has(childId),
    );
    childIds.forEach((childId, index) => {
      visit(childId, depth + 1, index + 1, childIds.length);
    });
  };

  visit(model.rootId, 0, 1, 1);
  return {
    rows,
    indexById,
    matchCount: matches.size,
    hasUnresolvedDirectories,
  };
}
