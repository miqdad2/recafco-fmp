// FMP-AUTH-01 — text copied by "Copy Credentials" on the created-user screen.
// Login Email is the login identity; the internal username is never included.
export function buildCredentialsText(input: {
  email: string;
  tempPassword: string;
  roleLabel: string;
  moduleAccessLines: string[];
  /** FMP-ACCESS-01 — e.g. "Single Module Access — Contract Management". Line omitted when not given. */
  accessModeLabel?: string;
}): string {
  const modules =
    input.moduleAccessLines.length > 0
      ? input.moduleAccessLines.join('; ')
      : 'All modules default to My Department';
  return [
    `Login Email: ${input.email}`,
    `Temporary Password: ${input.tempPassword}`,
    `Role: ${input.roleLabel}`,
    ...(input.accessModeLabel ? [`Access Mode: ${input.accessModeLabel}`] : []),
    `Module Access: ${modules}`,
  ].join('\n');
}
