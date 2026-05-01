import { z } from 'zod';

const TokenUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  cached_input_tokens: z.number().int().nonnegative().optional().default(0),
  output_tokens: z.number().int().nonnegative(),
  reasoning_output_tokens: z.number().int().nonnegative().optional().default(0),
  total_tokens: z.number().int().nonnegative().optional(),
}).passthrough();

const SessionMetaSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  cwd: z.string(),
  originator: z.string().optional(),
  cli_version: z.string().optional(),
  instructions: z.string().optional(),
  source: z.string().optional(),
  git: z.unknown().optional(),
}).passthrough();

const TurnContextSchema = z.object({
  cwd: z.string().optional(),
  approval_policy: z.string().optional(),
  sandbox_policy: z.unknown().optional(),
  model: z.string(),
  effort: z.string().optional(),
  summary: z.string().optional(),
}).passthrough();

const TokenCountPayload = z.object({
  type: z.literal('token_count'),
  info: z.object({
    total_token_usage: TokenUsageSchema,
    last_token_usage: TokenUsageSchema.optional(),
    model_context_window: z.number().int().nonnegative().optional(),
  }).passthrough(),
}).passthrough();

const ResponseItemSchema = z.object({
  type: z.string(),
  role: z.string().optional(),
  content: z.unknown().optional(),
}).passthrough();

const EventMsgSchema = z.union([TokenCountPayload, z.object({ type: z.string() }).passthrough()]);

export const EnvelopeLineSchema = z.discriminatedUnion('type', [
  z.object({ timestamp: z.string(), type: z.literal('session_meta'), payload: SessionMetaSchema }),
  z.object({ timestamp: z.string(), type: z.literal('turn_context'), payload: TurnContextSchema }),
  z.object({ timestamp: z.string(), type: z.literal('event_msg'), payload: EventMsgSchema }),
  z.object({ timestamp: z.string(), type: z.literal('response_item'), payload: ResponseItemSchema }),
]);

export const LegacyLineSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  instructions: z.string().optional(),
}).passthrough();

export type EnvelopeLine = z.infer<typeof EnvelopeLineSchema>;

export function isEnvelope(obj: unknown): boolean {
  return typeof obj === 'object' && obj !== null
    && 'type' in (obj as any) && 'payload' in (obj as any) && 'timestamp' in (obj as any);
}
