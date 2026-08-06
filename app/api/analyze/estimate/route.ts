// POST /api/analyze/estimate
// Zero-spend pre-flight check: gathers the real input (free GitHub reads),
// then either reports that the free fallback will be used, or computes a
// token/cost estimate from the exact prompt analyzeRepo() would send. Purely
// arithmetic (character count -> tokens -> per-model rates) — never calls a
// real model itself, and never claims to be more than an approximation the
// user should independently verify.
import { NextResponse } from "next/server";
import { getRepoContext, getFileContent } from "@/lib/github";
import {
  isProviderAvailable,
  buildAnalyzePromptText,
  resolveAnalyzeModel,
  type AnalyzeInput,
  type AnalyzeProvider,
} from "@/lib/ai";
import { estimateCost, formatUsd } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rough expected output size: 3-5 proposed issues as JSON, ~150 tokens each.
const ESTIMATED_OUTPUT_TOKENS = 700;

const APPROXIMATION_NOTE =
  "Approximate only, based on a rough character-based token count and published per-model rates — not a live pricing lookup. Verify against the provider's current pricing page before relying on this for real budgeting.";

type Body = {
  repo?: string;
  kind?: "metadata" | "file";
  path?: string;
  provider?: AnalyzeProvider;
  model?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { repo, kind, path, provider, model } = body;

  if (!repo || (kind !== "metadata" && kind !== "file") || !provider) {
    return NextResponse.json(
      { ok: false, message: "repo, kind ('metadata' | 'file'), and provider are required" },
      { status: 400 },
    );
  }
  if (kind === "file" && !path) {
    return NextResponse.json({ ok: false, message: "path is required for kind='file'" }, { status: 400 });
  }

  let input: AnalyzeInput;
  if (kind === "metadata") {
    const context = await getRepoContext(repo);
    input = { kind: "metadata", context };
  } else {
    const content = await getFileContent(repo, path!);
    if (content === null) {
      return NextResponse.json({ ok: false, message: `file not found: ${path}` }, { status: 404 });
    }
    input = { kind: "file", path: path!, content };
  }

  if (provider === "fallback" || !isProviderAvailable(provider)) {
    return NextResponse.json({
      ok: true,
      willUseFallback: true,
      message:
        provider === "fallback"
          ? "Using the free rule-based fallback — no cost."
          : `No key configured for ${provider} — will use the free rule-based fallback instead. No cost.`,
    });
  }

  const resolvedModel = resolveAnalyzeModel(provider, model);
  const promptText = buildAnalyzePromptText(input);
  const estimate = estimateCost(promptText, ESTIMATED_OUTPUT_TOKENS, resolvedModel);

  if (!estimate) {
    return NextResponse.json({
      ok: true,
      willUseFallback: false,
      provider,
      model: resolvedModel,
      unknownPricing: true,
      message: `No pricing data for model "${resolvedModel}" — cost cannot be estimated at all. Proceed with caution.`,
    });
  }

  return NextResponse.json({
    ok: true,
    willUseFallback: false,
    provider,
    model: resolvedModel,
    estimate: {
      inputTokens: estimate.inputTokens,
      estimatedOutputTokens: estimate.estimatedOutputTokens,
      estimatedCostUsd: estimate.estimatedCostUsd,
      estimatedCostFormatted: formatUsd(estimate.estimatedCostUsd),
    },
    approximationNote: APPROXIMATION_NOTE,
    message: `Approximate estimated cost: ${formatUsd(estimate.estimatedCostUsd)} (${resolvedModel}). ${APPROXIMATION_NOTE}`,
  });
}
