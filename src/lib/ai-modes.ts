export const AI_MODES_SETTING_KEY = "ai_modes";

export const DEFAULT_AI_MODES = {
  chat_tools: true,
  external_mcp: true,
  assistant: true,
} as const;

export type AiModeKey = keyof typeof DEFAULT_AI_MODES;
export type AiModes = Record<AiModeKey, boolean>;

export function normalizeAiModes(value: unknown): AiModes {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    chat_tools: typeof raw["chat_tools"] === "boolean" ? raw["chat_tools"] : DEFAULT_AI_MODES.chat_tools,
    external_mcp: typeof raw["external_mcp"] === "boolean" ? raw["external_mcp"] : DEFAULT_AI_MODES.external_mcp,
    assistant: typeof raw["assistant"] === "boolean" ? raw["assistant"] : DEFAULT_AI_MODES.assistant,
  };
}
