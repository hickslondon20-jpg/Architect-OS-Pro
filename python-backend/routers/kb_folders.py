"""Folder CRUD endpoints for the Knowledge Base Explorer."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from supabase import Client, create_client

from core.config import Settings, get_settings


class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: UUID | None = None


class FolderRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class FolderMovePayload(BaseModel):
    parent_id: UUID | None = None


class FolderResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    parent_id: UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


bearer_scheme = HTTPBearer(auto_error=False)
router = APIRouter()


def _get_supabase_client(settings: Settings) -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> UUID:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")

    client = _get_supabase_client(get_settings())
    try:
        response = client.auth.get_user(credentials.credentials)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token.") from exc

    user = getattr(response, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id and isinstance(user, dict):
        user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token.")
    return UUID(str(user_id))


def _folder_response(row: dict) -> FolderResponse:
    return FolderResponse(**row)


def _find_owned_folder(client: Client, folder_id: UUID, user_id: UUID) -> dict | None:
    response = (
        client.table("kb_folders")
        .select("*")
        .eq("id", str(folder_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def _would_create_cycle(
    client: Client,
    folder_id: UUID,
    new_parent_id: UUID,
    user_id: UUID,
) -> bool:
    """
    Returns True if setting folder_id.parent_id = new_parent_id would create a cycle.
    A cycle exists if new_parent_id is folder_id itself, or is a descendant of folder_id.
    Walk up the ancestor chain of new_parent_id; if we ever hit folder_id, it's a cycle.
    """
    if new_parent_id == folder_id:
        return True

    visited: set[str] = set()
    current_id: str | None = str(new_parent_id)

    while current_id is not None:
        if current_id in visited:
            break
        visited.add(current_id)

        response = (
            client.table("kb_folders")
            .select("parent_id")
            .eq("id", current_id)
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            break

        parent = rows[0].get("parent_id")
        if parent is None:
            break

        if parent == str(folder_id):
            return True

        current_id = parent

    return False


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
def create_folder(payload: FolderCreate, user_id: Annotated[UUID, Depends(get_current_user_id)]) -> FolderResponse:
    client = _get_supabase_client(get_settings())
    if payload.parent_id and not _find_owned_folder(client, payload.parent_id, user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent folder not found or access denied.")

    response = (
        client.table("kb_folders")
        .insert(
            {
                "user_id": str(user_id),
                "name": payload.name,
                "parent_id": str(payload.parent_id) if payload.parent_id else None,
            }
        )
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not create folder.")
    return _folder_response(rows[0])


@router.patch("/{folder_id}", response_model=FolderResponse)
def rename_folder(
    folder_id: UUID,
    payload: FolderRename,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> FolderResponse:
    client = _get_supabase_client(get_settings())
    response = (
        client.table("kb_folders")
        .update({"name": payload.name})
        .eq("id", str(folder_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found or access denied.")
    return _folder_response(rows[0])


@router.patch("/{folder_id}/parent", response_model=FolderResponse)
def move_folder(
    folder_id: UUID,
    payload: FolderMovePayload,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> FolderResponse:
    client = _get_supabase_client(get_settings())
    if not _find_owned_folder(client, folder_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found or access denied.")

    if payload.parent_id:
        if not _find_owned_folder(client, payload.parent_id, user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent folder not found or access denied.")
        if _would_create_cycle(client, folder_id, payload.parent_id, user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder move would create a cycle.")

    response = (
        client.table("kb_folders")
        .update({"parent_id": str(payload.parent_id) if payload.parent_id else None})
        .eq("id", str(folder_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found or access denied.")
    return _folder_response(rows[0])


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_folder(folder_id: UUID, user_id: Annotated[UUID, Depends(get_current_user_id)]) -> None:
    client = _get_supabase_client(get_settings())
    if not _find_owned_folder(client, folder_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found or access denied.")

    client.table("kb_folders").delete().eq("id", str(folder_id)).eq("user_id", str(user_id)).execute()
    return None


@router.get("", response_model=list[FolderResponse])
def list_folders(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    parent_id: UUID | None = None,
) -> list[FolderResponse]:
    client = _get_supabase_client(get_settings())
    query = client.table("kb_folders").select("*").eq("user_id", str(user_id))
    if parent_id is not None:
        query = query.eq("parent_id", str(parent_id))
    response = query.order("name").execute()
    return [_folder_response(row) for row in response.data or []]
