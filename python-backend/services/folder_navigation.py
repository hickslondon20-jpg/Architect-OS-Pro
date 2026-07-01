"""Knowledge Base folder navigation tools for agent exploration."""

from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass, field
from typing import Any, Literal

from services.vector_store import VectorStore


@dataclass(frozen=True)
class KbFolderItem:
    type: Literal["folder"]
    id: str
    name: str


@dataclass(frozen=True)
class KbFileItem:
    type: Literal["file"]
    id: str
    name: str
    file_type: str
    status: str


KbItem = KbFolderItem | KbFileItem


@dataclass(frozen=True)
class KbLsResult:
    folder_id: str | None
    folder_name: str
    item_count: int
    items: list[KbItem]


@dataclass
class KbTreeNode:
    type: Literal["folder", "file"]
    id: str
    name: str
    file_type: str | None = None
    status: str | None = None
    children: list["KbTreeNode"] = field(default_factory=list)


@dataclass(frozen=True)
class KbTreeResult:
    folder_id: str | None
    folder_name: str
    depth_requested: int
    total_items: int
    truncated: bool
    tree: list[KbTreeNode]


@dataclass(frozen=True)
class KbSearchMatch:
    id: str
    name: str
    file_type: str
    status: str
    folder_id: str | None


@dataclass(frozen=True)
class KbGrepResult:
    pattern: str
    scope_folder_id: str | None
    match_count: int
    matches: list[KbSearchMatch]


@dataclass(frozen=True)
class KbGlobResult:
    pattern: str
    scope_folder_id: str | None
    match_count: int
    matches: list[KbSearchMatch]


@dataclass(frozen=True)
class KbReadResult:
    document_id: str
    name: str
    total_lines: int
    start_line: int
    end_line: int
    truncated: bool
    content: str


class KbNavigationService:
    _FULL_READ_MAX_LINES: int = 2000
    _RANGE_READ_MAX_LINES: int = 500

    def __init__(self, store: VectorStore) -> None:
        self.client = store.client

    @classmethod
    def from_env(cls) -> "KbNavigationService":
        return cls(VectorStore.from_env())

    def execute_ls(self, user_id: str, folder_id: str | None) -> KbLsResult:
        """List immediate children of a folder. folder_id=None = root."""
        folder_query = (
            self.client.table("kb_folders")
            .select("id,name")
            .eq("user_id", user_id)
            .order("name")
        )
        if folder_id is None:
            folder_query = folder_query.is_("parent_id", "null")
        else:
            folder_query = folder_query.eq("parent_id", folder_id)
        folders_resp = folder_query.execute()

        file_query = (
            self.client.table("ose_raw_document_registry")
            .select("id,file_name,file_type,status")
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .order("file_name")
        )
        if folder_id is None:
            file_query = file_query.is_("folder_id", "null")
        else:
            file_query = file_query.eq("folder_id", folder_id)
        files_resp = file_query.execute()

        items: list[KbItem] = []
        for row in folders_resp.data or []:
            items.append(KbFolderItem(type="folder", id=row["id"], name=row["name"]))
        for row in files_resp.data or []:
            items.append(
                KbFileItem(
                    type="file",
                    id=row["id"],
                    name=row["file_name"],
                    file_type=row.get("file_type") or "",
                    status=row.get("status") or "",
                )
            )

        return KbLsResult(
            folder_id=folder_id,
            folder_name=self._resolve_folder_name_for_ls(user_id, folder_id),
            item_count=len(items),
            items=items,
        )

    def execute_tree(
        self,
        user_id: str,
        folder_id: str | None,
        depth: int = 3,
        limit: int = 200,
    ) -> KbTreeResult:
        """Return nested tree from folder_id down to depth levels."""
        depth = max(1, min(depth, 10))
        limit = max(1, min(limit, 500))

        folder_name = self._resolve_folder_name(user_id, folder_id)

        all_folders_resp = (
            self.client.table("kb_folders")
            .select("id,name,parent_id")
            .eq("user_id", user_id)
            .execute()
        )
        all_files_resp = (
            self.client.table("ose_raw_document_registry")
            .select("id,file_name,file_type,status,folder_id")
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .execute()
        )

        folders_by_parent: dict[str | None, list[dict[str, Any]]] = {}
        for row in all_folders_resp.data or []:
            key = row.get("parent_id")
            folders_by_parent.setdefault(key, []).append(row)

        files_by_folder: dict[str | None, list[dict[str, Any]]] = {}
        for row in all_files_resp.data or []:
            key = row.get("folder_id")
            files_by_folder.setdefault(key, []).append(row)

        item_counter = [0]
        truncated = [False]

        def _build(current_folder_id: str | None, current_depth: int) -> list[KbTreeNode]:
            if current_depth > depth or truncated[0]:
                return []
            nodes: list[KbTreeNode] = []

            child_folders = sorted(
                folders_by_parent.get(current_folder_id, []),
                key=lambda row: row["name"].lower(),
            )
            for row in child_folders:
                if truncated[0]:
                    break
                item_counter[0] += 1
                if item_counter[0] > limit:
                    item_counter[0] = limit
                    truncated[0] = True
                    break
                node = KbTreeNode(type="folder", id=row["id"], name=row["name"])
                node.children = _build(row["id"], current_depth + 1)
                nodes.append(node)

            child_files = sorted(
                files_by_folder.get(current_folder_id, []),
                key=lambda row: row["file_name"].lower(),
            )
            for row in child_files:
                if truncated[0]:
                    break
                item_counter[0] += 1
                if item_counter[0] > limit:
                    item_counter[0] = limit
                    truncated[0] = True
                    break
                nodes.append(
                    KbTreeNode(
                        type="file",
                        id=row["id"],
                        name=row["file_name"],
                        file_type=row.get("file_type") or "",
                        status=row.get("status") or "",
                    )
                )
            return nodes

        tree_nodes = _build(folder_id, 1)
        return KbTreeResult(
            folder_id=folder_id,
            folder_name=folder_name,
            depth_requested=depth,
            total_items=item_counter[0],
            truncated=truncated[0],
            tree=tree_nodes,
        )

    def execute_grep(
        self,
        user_id: str,
        pattern: str,
        folder_id: str | None = None,
        limit: int = 50,
    ) -> KbGrepResult:
        """Search full_markdown of user documents for regex pattern.

        folder_id=None searches all user docs.
        folder_id=uuid searches that folder's entire subtree (recursive).
        Returns matching document identifiers - not content excerpts.
        """
        limit = max(1, min(limit, 100))

        try:
            re.compile(pattern)
        except re.error as exc:
            raise KbNavigationError(f"Invalid regex pattern: {exc}") from exc

        query = (
            self.client.table("ose_raw_document_registry")
            .select("id,file_name,file_type,status,folder_id")
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .filter("full_markdown", "~*", pattern)
            .limit(limit)
        )

        if folder_id is not None:
            all_folders_resp = (
                self.client.table("kb_folders")
                .select("id,parent_id")
                .eq("user_id", user_id)
                .execute()
            )
            subtree_ids = _collect_folder_subtree_ids(
                all_folders_resp.data or [], folder_id
            )
            query = query.in_("folder_id", list(subtree_ids))

        resp = query.execute()
        matches = [
            KbSearchMatch(
                id=row["id"],
                name=row["file_name"],
                file_type=row.get("file_type") or "",
                status=row.get("status") or "",
                folder_id=row.get("folder_id"),
            )
            for row in resp.data or []
        ]
        return KbGrepResult(
            pattern=pattern,
            scope_folder_id=folder_id,
            match_count=len(matches),
            matches=matches,
        )

    def execute_glob(
        self,
        user_id: str,
        pattern: str,
        folder_id: str | None = None,
        limit: int = 200,
    ) -> KbGlobResult:
        """Match document filenames against a glob pattern.

        folder_id=None searches all user docs.
        folder_id=uuid searches that folder's entire subtree (recursive).
        Uses Python fnmatch - supports *, ?, [seq]. Case-insensitive.
        """
        limit = max(1, min(limit, 200))

        query = (
            self.client.table("ose_raw_document_registry")
            .select("id,file_name,file_type,status,folder_id")
            .eq("user_id", user_id)
            .neq("status", "deleted")
        )

        if folder_id is not None:
            all_folders_resp = (
                self.client.table("kb_folders")
                .select("id,parent_id")
                .eq("user_id", user_id)
                .execute()
            )
            subtree_ids = _collect_folder_subtree_ids(
                all_folders_resp.data or [], folder_id
            )
            query = query.in_("folder_id", list(subtree_ids))

        resp = query.execute()

        pattern_lower = pattern.lower()
        matches: list[KbSearchMatch] = []
        for row in resp.data or []:
            if fnmatch.fnmatchcase(row["file_name"].lower(), pattern_lower):
                matches.append(
                    KbSearchMatch(
                        id=row["id"],
                        name=row["file_name"],
                        file_type=row.get("file_type") or "",
                        status=row.get("status") or "",
                        folder_id=row.get("folder_id"),
                    )
                )
                if len(matches) >= limit:
                    break

        return KbGlobResult(
            pattern=pattern,
            scope_folder_id=folder_id,
            match_count=len(matches),
            matches=matches,
        )

    def execute_read(
        self,
        user_id: str,
        document_id: str,
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> KbReadResult:
        """Read full_markdown content of a document.

        start_line and end_line are 1-indexed and inclusive.
        If omitted: return full document (capped at 2000 lines).
        If provided: return the requested range (max 500 lines, validated upstream).
        """
        resp = (
            self.client.table("ose_raw_document_registry")
            .select("id,file_name,full_markdown")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise KbNavigationError(
                f"Document {document_id!r} not found for this user."
            )
        row = rows[0]
        full_markdown: str | None = row.get("full_markdown")
        if full_markdown is None:
            raise KbNavigationError(
                "Document content not yet available. Ingestion may still be in progress."
            )

        lines = full_markdown.split("\n")
        total_lines = len(lines)

        if start_line is None:
            actual_end = min(total_lines, self._FULL_READ_MAX_LINES)
            truncated = total_lines > self._FULL_READ_MAX_LINES
            content_lines = lines[:actual_end]
            return KbReadResult(
                document_id=document_id,
                name=row["file_name"],
                total_lines=total_lines,
                start_line=1,
                end_line=actual_end,
                truncated=truncated,
                content="\n".join(content_lines),
            )

        actual_end = min(end_line, total_lines)  # type: ignore[arg-type]
        content_lines = lines[start_line - 1 : actual_end]
        return KbReadResult(
            document_id=document_id,
            name=row["file_name"],
            total_lines=total_lines,
            start_line=start_line,
            end_line=actual_end,
            truncated=False,
            content="\n".join(content_lines),
        )

    def _resolve_folder_name(self, user_id: str, folder_id: str | None) -> str:
        if folder_id is None:
            return "Knowledge Base"
        resp = (
            self.client.table("kb_folders")
            .select("name")
            .eq("id", folder_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise KbNavigationError(f"Folder {folder_id!r} not found for this user.")
        return rows[0]["name"]

    def _resolve_folder_name_for_ls(self, user_id: str, folder_id: str | None) -> str:
        if folder_id is None:
            return "Knowledge Base"
        resp = (
            self.client.table("kb_folders")
            .select("name")
            .eq("id", folder_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0]["name"] if rows else ""


class KbNavigationError(RuntimeError):
    pass


def _collect_folder_subtree_ids(
    all_folder_rows: list[dict[str, Any]],
    root_folder_id: str,
) -> set[str]:
    """Return all folder IDs in the subtree rooted at root_folder_id (inclusive)."""
    children_by_parent: dict[str, list[str]] = {}
    for row in all_folder_rows:
        parent = row.get("parent_id")
        if parent:
            children_by_parent.setdefault(parent, []).append(row["id"])

    result: set[str] = set()
    queue = [root_folder_id]
    while queue:
        current = queue.pop()
        result.add(current)
        queue.extend(children_by_parent.get(current, []))
    return result


def _item_to_dict(item: KbItem) -> dict[str, Any]:
    if item.type == "folder":
        return {"type": "folder", "id": item.id, "name": item.name}
    return {
        "type": "file",
        "id": item.id,
        "name": item.name,
        "file_type": item.file_type,
        "status": item.status,
    }


def _tree_node_to_dict(node: KbTreeNode) -> dict[str, Any]:
    data: dict[str, Any] = {"type": node.type, "id": node.id, "name": node.name}
    if node.file_type is not None:
        data["file_type"] = node.file_type
    if node.status is not None:
        data["status"] = node.status
    if node.children:
        data["children"] = [_tree_node_to_dict(child) for child in node.children]
    return data


def ls_result_to_dict(result: KbLsResult) -> dict[str, Any]:
    return {
        "folder_id": result.folder_id,
        "folder_name": result.folder_name,
        "item_count": result.item_count,
        "items": [_item_to_dict(item) for item in result.items],
    }


def tree_result_to_dict(result: KbTreeResult) -> dict[str, Any]:
    return {
        "folder_id": result.folder_id,
        "folder_name": result.folder_name,
        "depth_requested": result.depth_requested,
        "total_items": result.total_items,
        "truncated": result.truncated,
        "tree": [_tree_node_to_dict(node) for node in result.tree],
    }


def _match_to_dict(match: KbSearchMatch) -> dict[str, Any]:
    return {
        "id": match.id,
        "name": match.name,
        "file_type": match.file_type,
        "status": match.status,
        "folder_id": match.folder_id,
    }


def grep_result_to_dict(result: KbGrepResult) -> dict[str, Any]:
    return {
        "pattern": result.pattern,
        "scope_folder_id": result.scope_folder_id,
        "match_count": result.match_count,
        "matches": [_match_to_dict(m) for m in result.matches],
    }


def glob_result_to_dict(result: KbGlobResult) -> dict[str, Any]:
    return {
        "pattern": result.pattern,
        "scope_folder_id": result.scope_folder_id,
        "match_count": result.match_count,
        "matches": [_match_to_dict(m) for m in result.matches],
    }


def read_result_to_dict(result: KbReadResult) -> dict[str, Any]:
    return {
        "document_id": result.document_id,
        "name": result.name,
        "total_lines": result.total_lines,
        "start_line": result.start_line,
        "end_line": result.end_line,
        "truncated": result.truncated,
        "content": result.content,
    }
