/** Strip Claude Code's command wrappers from a snippet for display (the index itself is untouched). */
export function cleanSnippet(s: string): string {
  return s
    .replace(/<command-(name|message|args)>[\s\S]*?<\/command-\1>/g, '')
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '')
    .replace(/<\/?local-command-stdout>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split FTS5 `<mark>` highlights into runs so they can be rendered as text nodes. */
export function splitMarks(s: string): { t: string; m: boolean }[] {
  const out: { t: string; m: boolean }[] = [];
  const re = /<mark>([\s\S]*?)<\/mark>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), m: false });
    out.push({ t: m[1], m: true });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: s.slice(last), m: false });
  return out;
}
