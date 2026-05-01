import { z } from 'zod';

const UsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_read_input_tokens: z.number().int().nonnegative().optional().default(0),
  cache_creation_input_tokens: z.number().int().nonnegative().optional().default(0),
  cache_creation: z.object({
    ephemeral_5m_input_tokens: z.number().int().nonnegative().optional().default(0),
    ephemeral_1h_input_tokens: z.number().int().nonnegative().optional().default(0),
  }).optional(),
  service_tier: z.string().optional(),
}).passthrough();

const ContentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).passthrough(),
  z.object({ type: z.literal('thinking'), thinking: z.string().optional() }).passthrough(),
  z.object({ type: z.literal('tool_use'), id: z.string(), name: z.string() }).passthrough(),
  z.object({ type: z.literal('tool_result') }).passthrough(),
]);

const BaseLineSchema = z.object({
  sessionId: z.string(),
  uuid: z.string(),
  timestamp: z.string(),
  cwd: z.string(),
  version: z.string().optional(),
  userType: z.string().optional(),
  entrypoint: z.string().optional(),
  gitBranch: z.string().optional(),
  isSidechain: z.boolean().optional(),
  agentId: z.string().optional(),
}).passthrough();

export const AssistantLineSchema = BaseLineSchema.extend({
  type: z.literal('assistant'),
  message: z.object({
    id: z.string(),
    model: z.string(),
    role: z.literal('assistant'),
    content: z.array(ContentBlockSchema).default([]),
    stop_reason: z.string().nullable().optional(),
    usage: UsageSchema,
  }).passthrough(),
  requestId: z.string().optional(),
  attribution_agent: z.string().optional(),
});

export const UserLineSchema = BaseLineSchema.extend({
  type: z.literal('user'),
  message: z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(z.any())]),
  }).passthrough(),
});

export type AssistantLine = z.infer<typeof AssistantLineSchema>;
export type UserLine = z.infer<typeof UserLineSchema>;
