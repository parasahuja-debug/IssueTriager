// Pure arithmetic, no AI call involved — used to show a cost estimate
// *before* asking permission to actually spend anything on a real model call.
import { MODEL_PRICING } from "./pricing";

// Rough approximation: ~4 characters per token for English text. Good enough
// for a pre-flight estimate, not meant to match a real tokenizer exactly.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type CostEstimate = {
  model: string;
  inputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
};

// Returns null if the model isn't in the static pricing table — caller
// decides how to handle an unknown/unpriced model (skip the estimate, warn).
export function estimateCost(
  inputText: string,
  estimatedOutputTokens: number,
  model: string,
): CostEstimate | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;

  const inputTokens = estimateTokens(inputText);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.outputPer1M;

  return {
    model,
    inputTokens,
    estimatedOutputTokens,
    estimatedCostUsd: inputCost + outputCost,
  };
}

// Standard 2-decimal currency formatting would round anything under half a
// cent down to "$0.00" — misleading for a number a human is about to approve
// spending. Sub-cent amounts get more decimal places instead.
export function formatUsd(amountUsd: number): string {
  if (amountUsd > 0 && amountUsd < 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(amountUsd);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountUsd);
}
