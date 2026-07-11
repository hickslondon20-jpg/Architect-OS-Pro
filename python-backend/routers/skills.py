"""Skill pack CRUD and SKILL.md ZIP import/export endpoints."""

from __future__ import annotations

import base64
import binascii
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field

from routers.kb_folders import _get_supabase_client, get_current_user_id
from core.config import get_settings
from services.mcp_connectors import list_connector_candidates
from services.skill_draft_synthesis import GuidedDraftRequest, SkillDraftSynthesisError, SkillDraftSynthesisService
from services.skills import SkillService, SkillServiceError


class SkillPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: str = Field(..., min_length=1, max_length=800)
    domain: str | None = None
    skill_kind: str | None = None
    trigger_tags: list[str] = Field(default_factory=list)
    required_platform_context: list[str] = Field(default_factory=list)
    body: str = Field(..., min_length=1)


class SkillPatchPayload(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1, max_length=800)
    domain: str | None = None
    skill_kind: str | None = None
    trigger_tags: list[str] | None = None
    required_platform_context: list[str] | None = None
    body: str | None = Field(default=None, min_length=1)


class GuidedSkillMessage(BaseModel):
    role: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class GuidedSkillDraftPayload(BaseModel):
    messages: list[GuidedSkillMessage] = Field(default_factory=list)
    currentDraft: dict = Field(default_factory=dict)


class SkillImportJsonPayload(BaseModel):
    filename: str = Field(..., min_length=1)
    contentBase64: str = Field(..., min_length=1)


router = APIRouter()


def _service() -> SkillService:
    return SkillService(_get_supabase_client(get_settings()))


def _draft_service() -> SkillDraftSynthesisService:
    return SkillDraftSynthesisService.from_env()


@router.get("")
def list_skills(user_id: Annotated[UUID, Depends(get_current_user_id)]) -> list[dict]:
    try:
        return _service().list_visible(user_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not load skills: {exc}") from exc


@router.get("/connectors")
def list_connectors(_user_id: Annotated[UUID, Depends(get_current_user_id)]) -> list[dict]:
    return list_connector_candidates()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_skill(payload: SkillPayload, user_id: Annotated[UUID, Depends(get_current_user_id)]) -> dict:
    try:
        return _service().create(user_id, payload.model_dump())
    except SkillServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not create skill: {exc}") from exc


@router.patch("/{skill_id}")
def update_skill(
    skill_id: UUID,
    payload: SkillPatchPayload,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    try:
        return _service().update(user_id, skill_id, payload.model_dump(exclude_unset=True))
    except SkillServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not update skill: {exc}") from exc


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_skill(skill_id: UUID, user_id: Annotated[UUID, Depends(get_current_user_id)]) -> None:
    try:
        _service().delete(user_id, skill_id)
    except SkillServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not delete skill: {exc}") from exc
    return None


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_skill_zip(
    file: Annotated[UploadFile, File()],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a .zip file.")
    try:
        return _service().import_zip(user_id, await file.read())
    except SkillServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not import skill: {exc}") from exc


@router.post("/import-json", status_code=status.HTTP_201_CREATED)
def import_skill_zip_json(
    payload: SkillImportJsonPayload,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    if not payload.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a .zip file.")
    try:
        zip_bytes = base64.b64decode(payload.contentBase64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ZIP payload is not valid base64.") from exc
    try:
        return _service().import_zip(user_id, zip_bytes)
    except SkillServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not import skill: {exc}") from exc


@router.post("/guided-draft")
def guided_skill_draft(
    payload: GuidedSkillDraftPayload,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> dict:
    try:
        return _draft_service().draft(
            GuidedDraftRequest(
                messages=[message.model_dump() for message in payload.messages],
                current_draft=payload.currentDraft,
            ),
            user_id=str(user_id),
        )
    except SkillDraftSynthesisError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not draft skill: {exc}") from exc


@router.get("/{skill_id}/export")
def export_skill_zip(skill_id: UUID, user_id: Annotated[UUID, Depends(get_current_user_id)]) -> Response:
    try:
        filename, content = _service().export_zip(user_id, skill_id)
    except SkillServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not export skill: {exc}") from exc
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
