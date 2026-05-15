import type { AssistantLine, UserLine } from './schemas.js';
import type { SegmentRole, RawSegment } from '../../schema/types.js';

// Re-export so existing imports from this module keep working. New code
// should import RawSegment directly from schema/types.js.
export type { RawSegment };

// Per-segment cap. Most assistant text fits well under 16 KB; tool_result
// content can be much larger (a `Read` of a file, a `Bash` of a build
// log, etc.). Indexing the entire body bloats the FTS5 index for low
// search value, so we truncate. The cap is a soft byte limit applied
// after the unicode-safe trimming used elsewhere.
const SEGMENT_CAP_BYTES = 16 * 1024;

export function extractTranscriptSegments(
  assistantLines: AssistantLine[],
  userLines: UserLine[],
): RawSegment[] {
  const out: RawSegment[] = [];

  for (const line of assistantLines) {
    let blockIdx = 0;
    for (const block of line.message.content) {
      if (block.type === 'text') {
        const text = (block as any).text;
        if (typeof text === 'string' && text.trim() !== '') {
          out.push({
            uid_suffix: `${line.uuid}:${blockIdx}`,
            timestamp: line.timestamp,
            role: 'assistant',
            text: capText(text),
          });
        }
      } else if (block.type === 'thinking') {
        const text = (block as any).thinking;
        if (typeof text === 'string' && text.trim() !== '') {
          out.push({
            uid_suffix: `${line.uuid}:${blockIdx}`,
            timestamp: line.timestamp,
            role: 'thinking',
            text: capText(text),
          });
        }
      }
      // tool_use blocks are not indexed here — their inputs are JSON
      // (commands, file paths) handled by the tool_calls table.
      blockIdx++;
    }
  }

  for (const line of userLines) {
    const c = line.message.content;
    if (typeof c === 'string') {
      if (c.trim() !== '') {
        out.push({
          uid_suffix: `${line.uuid}:0`,
          timestamp: line.timestamp,
          role: 'user',
          text: capText(c),
        });
      }
      continue;
    }
    if (!Array.isArray(c)) continue;
    let blockIdx = 0;
    for (const block of c as any[]) {
      if (!block) { blockIdx++; continue; }
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') {
        out.push({
          uid_suffix: `${line.uuid}:${blockIdx}`,
          timestamp: line.timestamp,
          role: 'user',
          text: capText(block.text),
        });
      } else if (block.type === 'tool_result') {
        // tool_result.content can be a string or an array of {type:'text',text}
        // sub-blocks; we flatten both into one segment per result so a single
        // command's output is one searchable unit.
        const content = block.content;
        let combined = '';
        if (typeof content === 'string') {
          combined = content;
        } else if (Array.isArray(content)) {
          combined = content
            .map((b: any) => (typeof b?.text === 'string' ? b.text : ''))
            .filter(Boolean)
            .join('\n');
        }
        if (combined.trim() !== '') {
          out.push({
            uid_suffix: `${line.uuid}:${blockIdx}`,
            timestamp: line.timestamp,
            role: 'tool_result',
            text: capText(combined),
          });
        }
      }
      blockIdx++;
    }
  }

  return out;
}

// Cap a string to SEGMENT_CAP_BYTES of utf-8 with an ellipsis suffix when
// truncated. Walks back to a unicode boundary so we never split a multi-
// byte character in the middle.
function capText(s: string): string {
  if (Buffer.byteLength(s, 'utf8') <= SEGMENT_CAP_BYTES) return s;
  let cap = SEGMENT_CAP_BYTES;
  while (cap > 0 && Buffer.byteLength(s.slice(0, cap), 'utf8') > SEGMENT_CAP_BYTES - 1) {
    cap--;
  }
  return s.slice(0, cap) + '…';
}
