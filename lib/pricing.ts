// Static pricing data, checked live against each provider's pricing page on
// 2026-08-06 — not a live API call, so this drifts out of date as providers
// change prices. Re-verify before trusting this for real budgeting,
// especially anything more than a few months old.

export type TokenPricing = {
  // Dollars per 1,000,000 tokens.
  inputPer1M: number;
  outputPer1M: number;
};

export const MODEL_PRICING: Record<string, TokenPricing> = {
  // --- OpenAI ---
  "gpt-5.6-sol": { inputPer1M: 5.0, outputPer1M: 30.0 },
  "gpt-5.6-terra": { inputPer1M: 2.0, outputPer1M: 12.0 },
  "gpt-5.6-luna": { inputPer1M: 0.2, outputPer1M: 1.2 },
  "gpt-5.5": { inputPer1M: 5.0, outputPer1M: 30.0 },
  "gpt-5.5-pro": { inputPer1M: 30.0, outputPer1M: 180.0 },
  "gpt-5.4": { inputPer1M: 2.5, outputPer1M: 15.0 },
  "gpt-5.4-mini": { inputPer1M: 0.75, outputPer1M: 4.5 },
  "gpt-5.4-nano": { inputPer1M: 0.2, outputPer1M: 1.25 },
  "gpt-5.4-pro": { inputPer1M: 30.0, outputPer1M: 180.0 },
  "gpt-5.2": { inputPer1M: 1.75, outputPer1M: 14.0 },
  "gpt-5.2-pro": { inputPer1M: 21.0, outputPer1M: 168.0 },
  "gpt-5.1": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "gpt-5": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "gpt-5-mini": { inputPer1M: 0.25, outputPer1M: 2.0 },
  "gpt-5-nano": { inputPer1M: 0.05, outputPer1M: 0.4 },
  "gpt-5-pro": { inputPer1M: 15.0, outputPer1M: 120.0 },
  "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  o1: { inputPer1M: 15.0, outputPer1M: 60.0 },
  "o1-pro": { inputPer1M: 150.0, outputPer1M: 600.0 },
  "o3-pro": { inputPer1M: 20.0, outputPer1M: 80.0 },
  o3: { inputPer1M: 2.0, outputPer1M: 8.0 },
  "o4-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
  "o3-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
  "gpt-3.5-turbo": { inputPer1M: 0.5, outputPer1M: 1.5 },
  "text-embedding-3-small": { inputPer1M: 0.02, outputPer1M: 0 },
  "text-embedding-3-large": { inputPer1M: 0.13, outputPer1M: 0 },
  "text-embedding-ada-002": { inputPer1M: 0.1, outputPer1M: 0 },

  // --- Claude (Anthropic) ---
  "claude-fable-5": { inputPer1M: 10.0, outputPer1M: 50.0 },
  "claude-opus-5": { inputPer1M: 5.0, outputPer1M: 25.0 },
  "claude-opus-4-8": { inputPer1M: 5.0, outputPer1M: 25.0 },
  "claude-opus-4-7": { inputPer1M: 5.0, outputPer1M: 25.0 },
  "claude-opus-4-6": { inputPer1M: 5.0, outputPer1M: 25.0 },
  "claude-sonnet-5": { inputPer1M: 3.0, outputPer1M: 15.0 }, // intro pricing $2/$10 through 2026-08-31
  "claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-4-5": { inputPer1M: 1.0, outputPer1M: 5.0 },

  // --- Gemini (Google) ---
  "gemini-3.6-flash": { inputPer1M: 1.5, outputPer1M: 7.5 },
  "gemini-3.5-flash": { inputPer1M: 1.5, outputPer1M: 9.0 },
  "gemini-3.5-flash-lite": { inputPer1M: 0.3, outputPer1M: 2.5 },
  "gemini-3.1-flash-lite": { inputPer1M: 0.25, outputPer1M: 1.5 },
  "gemini-3.1-pro-preview": { inputPer1M: 2.0, outputPer1M: 12.0 }, // <=200k tokens
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10.0 }, // <=200k tokens
  "gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 },
  "gemini-2.5-flash-lite": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gemini-embedding-2": { inputPer1M: 0.2, outputPer1M: 0 },
  "gemini-embedding": { inputPer1M: 0.15, outputPer1M: 0 },
};
