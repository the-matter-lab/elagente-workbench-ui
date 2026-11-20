import type { ThreadWorkspaceTreeNode } from '../../../adapters';

/**
 * ELA-412: with Show hidden files off, the Explorer lists neither entries the
 * host's visibility rules hide (`.workbenchignore`) nor any entry whose name
 * starts with `.`. A link into a hidden path turns Show hidden files on first,
 * so every revealed or selected node is a row of the listed tree.
 *
 * A listing without its dot entries, as Show hidden files off shows it.
 */
export function withoutDotEntries(node: ThreadWorkspaceTreeNode): ThreadWorkspaceTreeNode {
  if (!node.children) return node;
  const children = node.children
    .filter((child) => !child.name.startsWith('.'))
    .map(withoutDotEntries);
  return children.length === node.children.length && children.every((child, index) => child === node.children![index])
    ? node
    : { ...node, children };
}

/** Internal state the server never lists or serves; a link to it is missing. */
export function isInternalWorkspacePath(path: string) {
  return path.split('/').some((segment) => segment.startsWith('.elagente'));
}

export function parentWorkspacePath(path: string) {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}
