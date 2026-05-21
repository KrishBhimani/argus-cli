from argus.adapters.claude_code.model import canonicalize_claude_model


def test_passes_alias_forms_through():
    assert canonicalize_claude_model("claude-opus-4-7") == "claude-opus-4-7"
    assert canonicalize_claude_model("claude-sonnet-4-6") == "claude-sonnet-4-6"
    assert canonicalize_claude_model("claude-haiku-4-5") == "claude-haiku-4-5"


def test_strips_date_suffix_from_dated_forms():
    assert canonicalize_claude_model("claude-opus-4-5-20251101") == "claude-opus-4-5"
    assert canonicalize_claude_model("claude-sonnet-4-5-20251022") == "claude-sonnet-4-5"
    assert canonicalize_claude_model("claude-haiku-4-5-20251001") == "claude-haiku-4-5"


def test_returns_raw_for_unknown():
    assert canonicalize_claude_model("claude-experiment-x") == "claude-experiment-x"
