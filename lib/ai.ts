import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { createHash } from "node:crypto";
import type { RepoContext } from "./github";

const EMBED_DIMS = 1536;
const EMBED_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-5.4-nano";
const ANTHROPIC_MODEL = "claude-opus-4-8";
const GEMINI_MODEL = "gemini-2.5-flash-lite";

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export type ClassifyInput = {
  title: string;
  body: string | null;
  labels: string[];
};

export type ClassifyResult = {
  category: "bug" | "feature" | "question" | "docs" | "chore";
  priority: "P0" | "P1" | "P2" | "P3";
  complexity: "small" | "medium" | "large";
  summary: string;
  reasoning: string;
  model: string;
};

export async function classify(input: ClassifyInput): Promise<ClassifyResult> {
  const client = getOpenAI();
  if (!client) return mockClassify(input);

  const sys = `You triage GitHub issues. Return JSON only with this exact shape:
{
  "category": "bug" | "feature" | "question" | "docs" | "chore",
  "priority": "P0" | "P1" | "P2" | "P3",
  "complexity": "small" | "medium" | "large",
  "summary": "one sentence",
  "reasoning": "one or two sentences explaining the calls"
}
P0 = broken/blocking many users. P1 = important, clear user impact. P2 = nice to have. P3 = trivial/polish.`;

  const user = `Title: ${input.title}
Labels: ${input.labels.join(", ") || "(none)"}
Body: ${(input.body || "").slice(0, 3000)}`;

  const res = await client.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<ClassifyResult>;
  return {
    category: parsed.category ?? "chore",
    priority: parsed.priority ?? "P2",
    complexity: parsed.complexity ?? "medium",
    summary: parsed.summary ?? input.title,
    reasoning: parsed.reasoning ?? "",
    model: CHAT_MODEL,
  };
}

export async function embed(text: string): Promise<{ vector: number[]; model: string }> {
  const client = getOpenAI();
  if (!client) return { vector: mockEmbed(text), model: "mock-hash-v1" };
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: text.slice(0, 8000),
  });
  return { vector: res.data[0].embedding, model: EMBED_MODEL };
}

export async function generatePlan(input: ClassifyInput): Promise<{ content: string; model: string }> {
  const client = getOpenAI();
  if (!client) return { content: mockPlan(input), model: "mock-template-v1" };

  const sys = `You are an AI coding assistant that writes concise implementation plans for GitHub issues.
Return markdown only. Sections: ## Context, ## Approach, ## Files to touch, ## Validation, ## Risks.
Keep it under 300 words. Be concrete.`;

  const user = `Issue: ${input.title}
Labels: ${input.labels.join(", ") || "(none)"}
Body: ${(input.body || "").slice(0, 3000)}`;

  const res = await client.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  return {
    content: res.choices[0]?.message?.content ?? mockPlan(input),
    model: CHAT_MODEL,
  };
}

function mockClassify(input: ClassifyInput): ClassifyResult {
  const t = `${input.title} ${(input.body || "").slice(0, 500)}`.toLowerCase();
  const labels = input.labels.map((l) => l.toLowerCase());

  let category: ClassifyResult["category"] = "chore";
  if (/\bbug\b|broken|error|fail|crash|\bnot work/i.test(t) || labels.includes("bug")) category = "bug";
  else if (/feature|request|add|support|allow/i.test(t) || labels.includes("enhancement")) category = "feature";
  else if (/\?|how do|question/i.test(t) || labels.includes("question")) category = "question";
  else if (/docs?|readme|documentation/i.test(t) || labels.includes("documentation")) category = "docs";

  let priority: ClassifyResult["priority"] = "P2";
  if (/blocker|critical|p0|crash|security/i.test(t)) priority = "P0";
  else if (category === "bug") priority = "P1";
  else if (category === "docs" || category === "chore") priority = "P3";

  const words = t.split(/\s+/).length;
  const complexity: ClassifyResult["complexity"] =
    words < 30 ? "small" : words < 120 ? "medium" : "large";

  return {
    category,
    priority,
    complexity,
    summary: input.title,
    reasoning: `Rule-based triage (no OPENAI_API_KEY). Matched category=${category}, priority=${priority} from keywords and labels.`,
    model: "mock-rule-based-v1",
  };
}

function mockEmbed(text: string): number[] {
  // Deterministic hash-based embedding. Not semantic, but stable so cosine is consistent within the POC.
  const out = new Array<number>(EMBED_DIMS).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const tok of tokens) {
    const h = createHash("sha256").update(tok).digest();
    for (let i = 0; i < EMBED_DIMS; i++) {
      const byte = h[i % h.length];
      out[i] += (byte / 255 - 0.5) * 2;
    }
  }
  // L2 normalize so cosine distance behaves reasonably
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

function mockPlan(input: ClassifyInput): string {
  return `## Context
${input.title}

${(input.body || "").slice(0, 500)}

## Approach
1. Reproduce the issue locally against the failing path.
2. Identify the root cause in the relevant module.
3. Apply a targeted fix with no scope creep.
4. Add a regression test covering the reported behavior.

## Files to touch
- Likely: source module referenced in the issue body
- New: corresponding test file

## Validation
- Unit tests pass
- Manual smoke test reproduces the original flow
- No regressions in adjacent functionality

## Risks
- Template plan generated without OPENAI_API_KEY. Review before implementing.
`;
}

export function vectorToSqlLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

// --- Repo analyzer (Day 5) ---
// Unlike classify()/embed()/generatePlan(), the provider is never
// auto-detected from whichever key happens to be set — it's an explicit
// human choice (see the Day 5 staged flow: pick a provider, see the cost
// estimate, confirm, then run). isProviderAvailable() lets the caller check
// and surface "no key configured, will use fallback" *before* calling
// analyzeRepo() at all. The model is likewise a caller-supplied override,
// not hardcoded — these constants are only the defaults used when the
// caller doesn't ask for a specific model.
export type AnalyzeProvider = "openai" | "anthropic" | "gemini" | "fallback";

const DEFAULT_MODEL: Record<Exclude<AnalyzeProvider, "fallback">, string> = {
  openai: CHAT_MODEL,
  anthropic: ANTHROPIC_MODEL,
  gemini: GEMINI_MODEL,
};

export function isProviderAvailable(provider: AnalyzeProvider): boolean {
  switch (provider) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "gemini":
      return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    case "fallback":
      return true;
  }
}

export type ProposedIssueDraft = {
  title: string;
  body: string;
  categoryGuess: ClassifyResult["category"];
  priorityGuess: ClassifyResult["priority"];
};

export type AnalyzeInput =
  | { kind: "metadata"; context: RepoContext }
  | { kind: "file"; path: string; content: string };

// Exported so the estimate route can compute an accurate token count from
// the exact text that would actually be sent, instead of duplicating (and
// risking drifting out of sync with) the prompt-building logic here.
export function buildAnalyzePromptText(input: AnalyzeInput): string {
  return `${buildAnalyzeSystemPrompt()}\n\n${buildAnalyzeUserPrompt(input)}`;
}

// Exported so the estimate route resolves the same model analyzeRepo() would
// actually use, without duplicating the default-per-provider table.
export function resolveAnalyzeModel(provider: Exclude<AnalyzeProvider, "fallback">, model?: string): string {
  return model ?? DEFAULT_MODEL[provider];
}

export async function analyzeRepo(
  input: AnalyzeInput,
  provider: AnalyzeProvider,
  model?: string,
): Promise<{ proposals: ProposedIssueDraft[]; model: string }> {
  if (provider === "fallback" || !isProviderAvailable(provider)) {
    const proposals =
      input.kind === "metadata"
        ? mockAnalyzeMetadata(input.context)
        : mockAnalyzeFile(input.path, input.content);
    return { proposals, model: "mock-analyzer-v1" };
  }

  const resolvedModel = resolveAnalyzeModel(provider, model);
  const sys = buildAnalyzeSystemPrompt();
  const user = buildAnalyzeUserPrompt(input);

  let raw: string;

  if (provider === "openai") {
    const client = getOpenAI()!;
    const res = await client.chat.completions.create({
      model: resolvedModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });
    raw = res.choices[0]?.message?.content ?? "{}";
  } else if (provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: resolvedModel,
      max_tokens: 1024,
      messages: [{ role: "user", content: `${sys}\n\n${user}` }],
    });
    const block = res.content[0];
    raw = block?.type === "text" ? block.text : "{}";
  } else {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    });
    const interaction = await ai.interactions.create({
      model: resolvedModel,
      input: `${sys}\n\n${user}`,
    });
    raw = interaction.output_text ?? "{}";
  }

  return { proposals: parseProposals(raw), model: resolvedModel };
}

function buildAnalyzeSystemPrompt(): string {
  return `You analyze a software repository and propose candidate GitHub issues —
things that look missing, inconsistent, or worth fixing. Return JSON only,
with this exact shape:
{
  "issues": [
    {
      "title": "short, specific",
      "body": "one or two sentences, concrete",
      "category": "bug" | "feature" | "question" | "docs" | "chore",
      "priority": "P0" | "P1" | "P2" | "P3"
    }
  ]
}
Propose 3-5 issues. Never repeat anything matching an already-existing issue
title given to you. Be concrete and specific to what you were actually shown
— do not invent problems unrelated to the given content.`;
}

function buildAnalyzeUserPrompt(input: AnalyzeInput): string {
  if (input.kind === "metadata") {
    const { context } = input;
    return `Repo description: ${context.description ?? "(none)"}
Topics: ${context.topics.join(", ") || "(none)"}
README:
${(context.readme ?? "(no README found)").slice(0, 4000)}

Recent commit messages:
${context.recentCommitMessages.slice(0, 20).join("\n") || "(none)"}

Existing open issue titles (do not repeat these):
${context.existingIssueTitles.join("\n") || "(none)"}`;
  }
  return `File: ${input.path}
Content:
${input.content.slice(0, 6000)}`;
}

function parseProposals(raw: string): ProposedIssueDraft[] {
  // Strip a ```json ... ``` fence if the model wrapped its output in one,
  // despite being asked for JSON only.
  const cleaned = raw.trim().replace(/^```json\s*|^```\s*|```\s*$/gim, "");
  try {
    const parsed = JSON.parse(cleaned) as { issues?: Partial<ProposedIssueDraft & { category: string; priority: string }>[] };
    return (parsed.issues ?? []).map((i) => ({
      title: i.title ?? "(untitled)",
      body: i.body ?? "",
      categoryGuess: (i.category as ClassifyResult["category"]) ?? "chore",
      priorityGuess: (i.priority as ClassifyResult["priority"]) ?? "P2",
    }));
  } catch {
    return [];
  }
}

// Rule-based fallback for the metadata depth — deterministic checks, zero
// cost, same "happy path, not an error case" philosophy as mockClassify().
function mockAnalyzeMetadata(context: RepoContext): ProposedIssueDraft[] {
  const proposals: ProposedIssueDraft[] = [];
  const existing = context.existingIssueTitles.map((t) => t.toLowerCase());
  const alreadyProposed = (title: string) =>
    existing.some((t) => t.includes(title.toLowerCase().slice(0, 15)));

  if (!context.readme || context.readme.trim().length < 50) {
    const title = "Add or expand the README";
    if (!alreadyProposed(title)) {
      proposals.push({
        title,
        body: "No README was found (or it's very short). A README helps new contributors understand what this project does and how to run it.",
        categoryGuess: "docs",
        priorityGuess: "P3",
      });
    }
  }

  if (!context.description) {
    const title = "Add a repo description";
    if (!alreadyProposed(title)) {
      proposals.push({
        title,
        body: "This repo has no description set, making it harder to understand at a glance.",
        categoryGuess: "docs",
        priorityGuess: "P3",
      });
    }
  }

  const churnWords = /\b(fix|hotfix|workaround|temporary|hack)\b/i;
  const churnCount = context.recentCommitMessages.filter((m) => churnWords.test(m)).length;
  if (churnCount >= 3) {
    const title = "Recurring fixes suggest instability worth investigating";
    if (!alreadyProposed(title)) {
      proposals.push({
        title,
        body: `${churnCount} of the last ${context.recentCommitMessages.length} commits look like fixes or workarounds — worth a root-cause pass instead of continued patching.`,
        categoryGuess: "bug",
        priorityGuess: "P2",
      });
    }
  }

  return proposals;
}

// Rule-based fallback for the file-scoped depth — deterministic marker scan,
// zero cost. Not a substitute for real code understanding, but a real,
// honest signal (self-admitted debt), same as the metadata fallback's spirit.
function mockAnalyzeFile(path: string, content: string): ProposedIssueDraft[] {
  const lines = content.split("\n");
  const markers = /\b(TODO|FIXME|HACK)\b[:\s]?(.*)/i;
  const proposals: ProposedIssueDraft[] = [];

  lines.forEach((line, idx) => {
    const match = line.match(markers);
    if (match && proposals.length < 5) {
      proposals.push({
        title: `${match[1].toUpperCase()} in ${path}:${idx + 1}`,
        body: match[2]?.trim() || `Found a ${match[1].toUpperCase()} marker with no further detail.`,
        categoryGuess: "chore",
        priorityGuess: "P3",
      });
    }
  });

  return proposals;
}
