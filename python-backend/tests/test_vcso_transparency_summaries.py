from services.vcso_chat_service import _safe_input_summary, _safe_output_summary


def test_input_summary_preserves_search_args_and_recursively_redacts_secrets():
    summary = _safe_input_summary(
        {
            "query": "client concentration",
            "limit": 5,
            "content": "private document body",
            "context_scope": {
                "api_key": "sk-example-secret-value",
                "authorization": "Bearer secret-token-value",
            },
        }
    )

    assert summary["query"] == "client concentration"
    assert summary["limit"] == 5
    assert summary["content"] == "[21 chars]"
    assert summary["context_scope"]["api_key"] == "[redacted]"
    assert summary["context_scope"]["authorization"] == "[redacted]"


def test_output_summary_keeps_safe_search_labels_without_excerpts():
    summary = _safe_output_summary(
        {
            "summary": "Found 2 wiki pages matching query.",
            "result_count": 2,
            "findings": [
                {
                    "title": "Revenue Concentration",
                    "canonical_key": "revenue_concentration",
                    "similarity": 0.91,
                    "excerpt": "Sensitive client and financial details.",
                },
                {
                    "title": "Current Quarter",
                    "canonical_key": "current_quarter",
                    "similarity": 0.84,
                    "content": "Full wiki page content.",
                },
            ],
            "pages": [{"title": "duplicate payload"}, {"title": "duplicate payload"}],
        }
    )

    assert summary["result_count"] == 2
    assert summary["findings"] == [
        {"title": "Revenue Concentration", "canonical_key": "revenue_concentration", "similarity": 0.91},
        {"title": "Current Quarter", "canonical_key": "current_quarter", "similarity": 0.84},
    ]
    assert summary["pages"] == "[2 items]"
    assert "excerpt" not in summary["findings"][0]


def test_output_summary_hides_rows_and_secret_text_tokens():
    summary = _safe_output_summary(
        {
            "rows": [{"client": "A", "revenue": 1000}],
            "message": "Request used Bearer abc.def.secret and sk-abcdefghijklmnop.",
            "password": "do-not-show",
        }
    )

    assert summary["rows"] == "[1 rows]"
    assert summary["password"] == "[redacted]"
    assert "abc.def.secret" not in summary["message"]
    assert "sk-abcdefghijklmnop" not in summary["message"]
