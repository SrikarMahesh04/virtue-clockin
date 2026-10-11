// Advisory feedback only: every nonempty password is allowed regardless of strength.
export function passwordStrength(
  password: string,
): "Weak" | "Medium" | "Strong" {
  const common = new Set([
    "password",
    "password123",
    "12345678",
    "qwerty123",
    "letmein",
  ]);
  if (
    password.length < 8 ||
    new Set(password).size < 3 ||
    common.has(password.toLowerCase())
  )
    return "Weak";
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(
    (pattern) => pattern.test(password),
  ).length;
  if (
    (password.length >= 12 && variety >= 3) ||
    (password.length >= 20 && variety >= 2)
  )
    return "Strong";
  return "Medium";
}
