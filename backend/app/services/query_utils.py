from __future__ import annotations


def like_pattern(term: str) -> str:
    """Build a LIKE pattern that matches ``term`` literally (used with ESCAPE '\\')."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
