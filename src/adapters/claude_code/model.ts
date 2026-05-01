const DATED_SUFFIX_RE = /-(\d{8})$/;

export function canonicalizeClaudeModel(raw: string): string {
  return raw.replace(DATED_SUFFIX_RE, '');
}
