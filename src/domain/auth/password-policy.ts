export const MIN_PASSWORD_LENGTH = 10;

export function validateNewPassword(password: string, email: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 200) return "That password is too long.";
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) return "Your password can't be your email address.";
  return null;
}
