import type { FolderTreeNode, KbFolder } from './osEngineApi';

export function buildFolderTree(folders: KbFolder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const folder of folders) {
    map.set(folder.id, { ...folder, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = map.get(node.parentId);
    if (parent) parent.children.push(node);
  }

  const sortAlpha = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((node) => sortAlpha(node.children));
  };

  sortAlpha(roots);
  return roots;
}
