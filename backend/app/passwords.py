"""Advisory password feedback; strength never restricts password selection."""

import re
from typing import Literal


def password_strength(password: str) -> Literal["Weak", "Medium", "Strong"]:
    common = {"password", "password123", "12345678", "qwerty123", "letmein"}
    if len(password) < 8 or len(set(password)) < 3 or password.lower() in common:
        return "Weak"
    variety = sum(
        bool(re.search(pattern, password))
        for pattern in (r"[a-z]", r"[A-Z]", r"[0-9]", r"[^a-zA-Z0-9]")
    )
    if (len(password) >= 12 and variety >= 3) or (len(password) >= 20 and variety >= 2):
        return "Strong"
    return "Medium"
