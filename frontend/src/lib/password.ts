// Password rules mirror the backend RegisterRequest validation.
export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "len", label: "8–128 characters", test: (p) => p.length >= 8 && p.length <= 128 },
  { id: "lower", label: "a lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "an uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "digit", label: "a digit", test: (p) => /\d/.test(p) },
  { id: "special", label: "a special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function isPasswordValid(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

// Username: 3-30 chars, alphanumeric + _ -, no leading/trailing _ or -.
export function isUsernameValid(name: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{1,28}[a-zA-Z0-9])?$/.test(name);
}
