from services.skills import parse_skill_md, serialize_skill_md


def test_parse_vanilla_skill_md_defaults_extension_fields():
    parsed = parse_skill_md(
        "---\n"
        "name: Review Skill\n"
        "description: Reviews a founder decision.\n"
        "---\n"
        "# Instructions\n"
        "Use the founder context carefully.\n"
    )

    assert parsed["name"] == "Review Skill"
    assert parsed["description"] == "Reviews a founder decision."
    assert parsed["domain"] is None
    assert parsed["skill_kind"] is None
    assert parsed["trigger_tags"] == []
    assert parsed["required_platform_context"] == []
    assert parsed["body"] == "# Instructions\nUse the founder context carefully.\n"


def test_serialize_parse_round_trip_preserves_skill_fields():
    row = {
        "name": "Margin Review",
        "description": "Reviews delivery margin tradeoffs.",
        "domain": "financial",
        "skill_kind": "diagnostic",
        "trigger_tags": ["margin", "pricing review"],
        "required_platform_context": ["financial_context", "current_quarter_sprint"],
        "body": "# Margin Review\n\nFollow this exact sequence.\n",
    }

    reparsed = parse_skill_md(serialize_skill_md(row))

    assert reparsed == row
