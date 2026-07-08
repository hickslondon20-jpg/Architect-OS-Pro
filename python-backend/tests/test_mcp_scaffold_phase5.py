from services.mcp_client import MCPClientManager, MCPServerConfig, oauth_refresh_not_implemented
from services.mcp_connectors import list_connector_candidates
from services.mcp_credentials import MCPCredentialStore
from services.tool_registry import RegistryNativeScopeSource, ToolExecutionContext, ToolRegistry


def test_mcp_manager_discovers_registers_searches_and_calls_fake_server():
    manager = MCPClientManager(
        servers=[MCPServerConfig(server_name="notion", transport="stdio", user_id="user-1")],
        adapter=_FakeMCPAdapter(),
    )
    registry = ToolRegistry(scope_source=RegistryNativeScopeSource())

    assert registry.register_mcp_tools(manager, user_id="user-1") == 1

    definition = registry.get("mcp_notion_find_page")
    assert definition.source == "mcp"
    assert definition.executor_kind == "mcp"
    assert definition.loading == "deferred"
    assert definition.mcp_metadata["server_name"] == "notion"

    matches = registry.tool_search("notion pages", surface="virtual_cso", capability="mcp_connector")
    assert [match.name for match in matches] == ["mcp_notion_find_page"]

    scoped = registry.get_tools(
        surface="virtual_cso",
        capability="mcp_connector",
        names=["mcp_notion_find_page"],
    )
    assert [tool.name for tool in scoped] == ["mcp_notion_find_page"]

    envelope = registry.execute(
        "mcp_notion_find_page",
        ToolExecutionContext(user_id="user-1"),
        {"query": "pricing"},
    )
    assert envelope.content["content"][0]["text"] == "Found pricing page"
    assert envelope.sources[0].source_kind == "mcp"
    assert envelope.sources[0].source_id == "notion:find_page"
    assert envelope.sources[0].verbatim == "Found pricing page"


def test_mcp_zero_server_path_registers_nothing():
    registry = ToolRegistry(scope_source=RegistryNativeScopeSource())
    manager = MCPClientManager(servers=[], adapter=_FakeMCPAdapter())

    assert registry.register_mcp_tools(manager) == 0
    assert not [name for name in registry.tool_names() if name.startswith("mcp_")]


def test_mcp_credential_store_uses_vault_schema_only():
    client = _FakeVaultClient()
    store = MCPCredentialStore(client)

    secret_id = store.create_secret(secret="super-secret", name="mcp-temp", description="test")
    assert secret_id == "vault-secret-1"
    assert store.get_decrypted_secret(secret_id) == "super-secret"
    store.delete_secret(secret_id)

    assert client.public_tables == {}
    assert client.deleted == ["vault-secret-1"]


def test_connector_candidates_are_named_and_read_only():
    rows = list_connector_candidates()

    assert [row["key"] for row in rows] == ["quickbooks", "gohighlevel", "notion"]
    assert all(row["status"] == "coming_soon" for row in rows)


def test_oauth_lifecycle_is_explicit_stub():
    try:
        oauth_refresh_not_implemented()
    except NotImplementedError as exc:
        assert "scaffolded" in str(exc)
    else:
        raise AssertionError("OAuth lifecycle should not be implemented in Phase 5.")


class _FakeMCPAdapter:
    def list_tools(self, server):
        assert server.server_name == "notion"
        return {
            "tools": [
                {
                    "name": "find_page",
                    "description": "Find Notion pages by query.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"query": {"type": "string"}},
                        "required": ["query"],
                    },
                    "annotations": {"readOnlyHint": True},
                }
            ]
        }

    def call_tool(self, server, tool_name, arguments):
        assert server.server_name == "notion"
        assert tool_name == "find_page"
        assert arguments == {"query": "pricing"}
        return {"content": [{"type": "text", "text": "Found pricing page"}]}


class _FakeVaultClient:
    def __init__(self):
        self.secrets = {}
        self.deleted = []
        self.public_tables = {}

    def schema(self, name):
        assert name == "vault"
        return _FakeVaultSchema(self)


class _FakeVaultSchema:
    def __init__(self, parent):
        self.parent = parent

    def rpc(self, name, params):
        return _FakeVaultRpc(self.parent, name, params)

    def table(self, name):
        assert name == "decrypted_secrets"
        return _FakeVaultQuery(self.parent)


class _FakeVaultRpc:
    def __init__(self, parent, name, params):
        self.parent = parent
        self.name = name
        self.params = params

    def execute(self):
        if self.name == "create_secret":
            self.parent.secrets["vault-secret-1"] = self.params["secret"]
            return _FakeResponse("vault-secret-1")
        if self.name == "delete_secret":
            self.parent.deleted.append(self.params["secret_id"])
            return _FakeResponse(None)
        raise AssertionError(f"Unexpected Vault RPC: {self.name}")


class _FakeVaultQuery:
    def __init__(self, parent):
        self.parent = parent
        self.secret_id = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        assert key == "id"
        self.secret_id = value
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self.secret_id in self.parent.secrets:
            return _FakeResponse([{"id": self.secret_id, "decrypted_secret": self.parent.secrets[self.secret_id]}])
        return _FakeResponse([])


class _FakeResponse:
    def __init__(self, data):
        self.data = data
