"""Document move endpoints for the Knowledge Base Explorer."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.config import get_settings
from routers.kb_folders import _find_owned_folder, _get_supabase_client, get_current_user_id


class DocumentMovePayload(BaseModel):
    folder_id: UUID | None = None


class DocumentMoveResponse(BaseModel):
    document_id: UUID
    folder_id: UUID | None


router = APIRouter()


@router.patch("/{document_id}/folder", response_model=DocumentMoveResponse)
def move_document(
    document_id: UUID,
    payload: DocumentMovePayload,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> DocumentMoveResponse:
    client = _get_supabase_client(get_settings())
    document_response = (
        client.table("ose_raw_document_registry")
        .select("id")
        .eq("id", str(document_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    if not (document_response.data or []):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found or access denied.")

    if payload.folder_id and not _find_owned_folder(client, payload.folder_id, user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder not found or access denied.")

    update_response = (
        client.table("ose_raw_document_registry")
        .update({"folder_id": str(payload.folder_id) if payload.folder_id else None})
        .eq("id", str(document_id))
        .eq("user_id", str(user_id))
        .execute()
    )
    if not (update_response.data or []):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found or access denied.")

    return DocumentMoveResponse(document_id=document_id, folder_id=payload.folder_id)
