"""Service-role-only Supabase Vault helpers for MCP credentials."""

from __future__ import annotations

from typing import Any


class MCPCredentialError(RuntimeError):
    pass


class MCPCredentialStore:
    """Stores MCP secrets in Supabase Vault, never in public metadata rows."""

    def __init__(self, supabase_client: Any) -> None:
        self._client = supabase_client

    def create_secret(self, *, secret: str, name: str, description: str | None = None) -> str:
        response = _vault_rpc(
            self._client,
            "create_secret",
            {
                "secret": secret,
                "name": name,
                "description": description or "",
            },
        )
        secret_id = response.data
        if isinstance(secret_id, list) and secret_id:
            secret_id = secret_id[0]
        if isinstance(secret_id, dict):
            secret_id = secret_id.get("id")
        if not secret_id:
            raise MCPCredentialError("Vault did not return a secret id.")
        return str(secret_id)

    def get_decrypted_secret(self, secret_id: str) -> str:
        response = (
            _schema(self._client, "vault")
            .table("decrypted_secrets")
            .select("id,decrypted_secret")
            .eq("id", str(secret_id))
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise MCPCredentialError("Vault secret was not found or is not decryptable.")
        secret = rows[0].get("decrypted_secret")
        if secret is None:
            raise MCPCredentialError("Vault secret response did not include decrypted_secret.")
        return str(secret)

    def delete_secret(self, secret_id: str) -> None:
        _vault_rpc(self._client, "delete_secret", {"secret_id": str(secret_id)})


def _vault_rpc(client: Any, function_name: str, params: dict[str, Any]) -> Any:
    scoped = _schema(client, "vault")
    if hasattr(scoped, "rpc"):
        return scoped.rpc(function_name, params).execute()
    if hasattr(client, "rpc"):
        return client.rpc(f"vault.{function_name}", params).execute()
    raise MCPCredentialError("Supabase client does not support Vault RPC calls.")


def _schema(client: Any, schema_name: str) -> Any:
    if hasattr(client, "schema"):
        return client.schema(schema_name)
    if hasattr(client, "postgrest") and hasattr(client.postgrest, "schema"):
        return client.postgrest.schema(schema_name)
    return client
