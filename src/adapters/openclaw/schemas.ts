import { z } from 'zod';

// OpenClaw's `usage.cost` is union-shaped — sometimes a number, sometimes
// an object with a `total` field, sometimes missing. Normalize at parse
// time so downstream code reads a single shape.
const CostSchema = z.union([
  z.number(),
  z.object({ total: z.number().optional() }).passthrough(),
  z.null(),
]).optional();

const UsageSchema = z.object({
  input: z.number().int().nonnegative().optional().default(0),
  output: z.number().int().nonnegative().optional().default(0),
  cacheRead: z.number().int().nonnegative().optional().default(0),
  cacheWrite: z.number().int().nonnegative().optional().default(0),
  totalTokens: z.number().int().nonnegative().optional(),
  cost: CostSchema,
}).passthrough();

// Content blocks under message.content for OpenClaw lines. Compared to
// Claude Code: tool calls use `toolCall` (camelCase) with an `arguments`
// field instead of `tool_use`/`input`.
const ContentBlockSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string() }).passthrough(),
  z.object({ type: z.literal('thinking'), thinking: z.string().optional() }).passthrough(),
  z.object({
    type: z.literal('toolCall'),
    id: z.string(),
    name: z.string(),
    arguments: z.unknown().optional(),
    partialJson: z.string().optional(),
  }).passthrough(),
  z.object({ type: z.string() }).passthrough(),  // unknown block types ignored
]);

const BaseRecord = z.object({
  type: z.string(),
  id: z.string().optional(),
  parentId: z.string().nullable().optional(),
  timestamp: z.string().optional(),
}).passthrough();

// `type: "session"` header line.
export const SessionLineSchema = BaseRecord.extend({
  type: z.literal('session'),
  id: z.string(),
  timestamp: z.string(),
  cwd: z.string().optional(),
  version: z.number().int().optional(),
});

// `type: "model_change"` event. We buffer the active provider/model from
// these and apply them to subsequent assistant messages.
export const ModelChangeLineSchema = BaseRecord.extend({
  type: z.literal('model_change'),
  provider: z.string(),
  modelId: z.string(),
});

// `type: "message"` records carry the actual conversation. The role lives
// inside `message.role` and takes values: 'user' | 'assistant' | 'toolResult'.
export const MessageLineSchema = BaseRecord.extend({
  type: z.literal('message'),
  timestamp: z.string(),
  message: z.object({
    role: z.string(),
    content: z.union([z.string(), z.array(ContentBlockSchema)]).optional(),
    // Assistant-only fields:
    id: z.string().optional(),
    model: z.string().optional(),
    provider: z.string().optional(),
    usage: UsageSchema.optional(),
    // toolResult-only fields:
    toolCallId: z.string().optional(),
    toolName: z.string().optional(),
    isError: z.boolean().optional(),
  }).passthrough(),
});

export type SessionLine = z.infer<typeof SessionLineSchema>;
export type ModelChangeLine = z.infer<typeof ModelChangeLineSchema>;
export type MessageLine = z.infer<typeof MessageLineSchema>;

// Normalize the union `usage.cost` shape into a single number (or null).
export function normalizeCost(cost: unknown): number | null {
  if (cost === null || cost === undefined) return null;
  if (typeof cost === 'number') return Number.isFinite(cost) ? cost : null;
  if (typeof cost === 'object' && cost !== null && 'total' in cost) {
    const t = (cost as { total?: unknown }).total;
    if (typeof t === 'number' && Number.isFinite(t)) return t;
  }
  return null;
}
