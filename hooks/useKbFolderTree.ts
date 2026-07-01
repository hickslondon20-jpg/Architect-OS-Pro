import { useCallback, useEffect, useState } from 'react';
import {
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
  type FolderTreeNode,
  type KbFolder,
} from '../lib/osEngineApi';
import { buildFolderTree } from '../lib/kbFolderUtils';

export interface KbFolderTreeState {
  folders: KbFolder[];
  tree: FolderTreeNode[];
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  loading: boolean;
  error: string | null;
  loadFolders: () => Promise<void>;
  selectFolder: (id: string | null) => void;
  toggleExpand: (id: string) => void;
  expandFolder: (id: string) => void;
  createFolderAction: (name: string, parentId?: string | null) => Promise<void>;
  renameFolderAction: (id: string, name: string) => Promise<void>;
  deleteFolderAction: (id: string) => Promise<void>;
}

export function useKbFolderTree(): KbFolderTreeState {
  const [folders, setFolders] = useState<KbFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = buildFolderTree(folders);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFolders();
      setFolders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const selectFolder = useCallback((id: string | null) => {
    setSelectedFolderId(id);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandFolder = useCallback((id: string) => {
    setExpandedIds((prev) => new Set([...prev, id]));
  }, []);

  const createFolderAction = useCallback(
    async (name: string, parentId?: string | null) => {
      const folder = await createFolder(name, parentId ?? null);
      setFolders((prev) => [...prev, folder]);
      if (parentId) expandFolder(parentId);
    },
    [expandFolder],
  );

  const renameFolderAction = useCallback(async (id: string, name: string) => {
    const updated = await renameFolder(id, name);
    setFolders((prev) => prev.map((folder) => (folder.id === id ? updated : folder)));
  }, []);

  const deleteFolderAction = useCallback(
    async (id: string) => {
      await deleteFolder(id);

      const toRemove = new Set<string>();
      const collectDescendants = (folderId: string) => {
        toRemove.add(folderId);
        folders.filter((folder) => folder.parentId === folderId).forEach((folder) => collectDescendants(folder.id));
      };

      collectDescendants(id);
      setFolders((prev) => prev.filter((folder) => !toRemove.has(folder.id)));
      setExpandedIds((prev) => {
        const next = new Set(prev);
        toRemove.forEach((folderId) => next.delete(folderId));
        return next;
      });
      if (selectedFolderId && toRemove.has(selectedFolderId)) {
        setSelectedFolderId(null);
      }
    },
    [folders, selectedFolderId],
  );

  return {
    folders,
    tree,
    selectedFolderId,
    expandedIds,
    loading,
    error,
    loadFolders,
    selectFolder,
    toggleExpand,
    expandFolder,
    createFolderAction,
    renameFolderAction,
    deleteFolderAction,
  };
}
