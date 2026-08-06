"use client";

import { useState } from "react";
import { MODEL_PRICING } from "@/lib/pricing";

type AnalyzeFormProps = {
  repo: string;
  onCancel?: () => void;
};

// Helper function to group and filter models by provider prefix
const getModelsForProvider = (provider: "openai" | "anthropic" | "gemini") => {
  const prefixes: Record<string, string> = {
    openai: "gpt-",
    anthropic: "claude-",
    gemini: "gemini-",
  };

  const prefix = prefixes[provider];
  return Object.entries(MODEL_PRICING)
    .filter(([modelId]) => modelId.startsWith(prefix) && !modelId.includes("embedding"))
    .map(([modelId, pricing]) => ({
      id: modelId,
      name: modelId,
      inputPer1M: pricing.inputPer1M,
      outputPer1M: pricing.outputPer1M,
    }))
    .sort((a, b) => a.inputPer1M - b.inputPer1M);
};

// AnalyzeForm is a multi-step wizard for configuring a repository analysis.
// Users progress through kind selection (metadata vs file), then file path (if needed),
// then provider and model selection with pricing display, cost estimation, and confirmation.
export function AnalyzeForm({ repo, onCancel }: AnalyzeFormProps) {
  // Track current step in the wizard
  const [step, setStep] = useState<"kind" | "path" | "provider" | "confirm">("kind");
  // Analysis kind: "metadata" or "file"
  const [kind, setKind] = useState<"metadata" | "file">("metadata");
  // File path for "file" kind analysis
  const [filePath, setFilePath] = useState("");
  // Selected AI provider: openai, anthropic, gemini, fallback
  const [provider, setProvider] = useState<"openai" | "anthropic" | "gemini" | "fallback">("fallback");
  // Selected model ID for the chosen provider
  const [selectedModel, setSelectedModel] = useState<string>("");
  // Whether to show the model picker modal
  const [showModelPicker, setShowModelPicker] = useState(false);
  // Temporary provider being evaluated (user clicked this provider, now picking model)
  const [tempProvider, setTempProvider] = useState<"openai" | "anthropic" | "gemini" | null>(null);

  // When user selects a kind option, automatically advance to next step
  const handleSelectKind = (selectedKind: "metadata" | "file") => {
    setKind(selectedKind);
    setStep(selectedKind === "file" ? "path" : "provider");
  };

  // Move to next step in the wizard
  const handleNext = () => {
    if (step === "path") {
      setStep("provider");
    } else if (step === "provider") {
      setStep("confirm");
    }
  };

  // Move back to previous step
  const handleBack = () => {
    if (step === "path") {
      setStep("kind");
    } else if (step === "provider") {
      setStep(kind === "file" ? "path" : "kind");
    } else if (step === "confirm") {
      setStep("provider");
    }
  };

  // Render step 1: Kind picker (metadata vs specific file)
  if (step === "kind") {
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-base font-semibold">Choose Analysis Type</h4>
            <span className="text-xs bg-action-bg px-2 py-1 rounded text-action-text">Step 1 of {kind === "file" ? "4" : "3"}</span>
          </div>

          {/* Kind picker: clicking an option auto-advances to next step */}
          <div className="space-y-3">
            {/* Repository Metadata option — click to select and advance */}
            <button
              onClick={() => handleSelectKind("metadata")}
              className="flex items-center gap-3 w-full p-3 rounded border border-inkLine hover:border-glow transition text-left"
            >
              <input
                type="radio"
                name="kind"
                value="metadata"
                checked={kind === "metadata"}
                readOnly
                className="w-4 h-4"
              />
              <div>
                <div className="font-semibold text-ink-text">Repository Metadata</div>
                <div className="text-xs text-inkDim">Analyze README, commits, description, topics</div>
              </div>
            </button>

            {/* Specific File option — click to select and advance */}
            <button
              onClick={() => handleSelectKind("file")}
              className="flex items-center gap-3 w-full p-3 rounded border border-inkLine hover:border-glow transition text-left"
            >
              <input
                type="radio"
                name="kind"
                value="file"
                checked={kind === "file"}
                readOnly
                className="w-4 h-4"
              />
              <div>
                <div className="font-semibold text-ink-text">Specific File</div>
                <div className="text-xs text-inkDim">Scan a file for TODOs, FIXMEs, HANGs</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render step 2: File path input (only for file kind)
  if (step === "path" && kind === "file") {
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-base font-semibold">Enter File Path</h4>
            <span className="text-xs bg-action-bg px-2 py-1 rounded text-action-text">Step 2 of 4</span>
          </div>

          {/* File path input with example and validation hint */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="e.g., src/lib/ai.ts or src/components/Button.tsx"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              className="w-full px-3 py-2 rounded border border-inkLine bg-action-bg text-ink-text text-sm placeholder-inkDim focus:outline-none focus:border-glow"
            />
            <p className="text-xs text-inkDim">Enter the exact file path relative to repository root</p>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={handleBack} className="action">
            Back
          </button>
          <button onClick={handleNext} disabled={!filePath.trim()} className="action action-primary disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    );
  }

  // Render step 3: Provider picker (which AI service to use)
  if (step === "provider") {
    const stepNum = kind === "file" ? "3" : "2";
    const totalSteps = kind === "file" ? "4" : "3";

    return (
      <>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h4 className="text-base font-semibold">Choose AI Provider</h4>
              <span className="text-xs bg-action-bg px-2 py-1 rounded text-action-text">Step {stepNum} of {totalSteps}</span>
            </div>

            {/* Provider options — clicking shows model picker modal for paid providers */}
            <div className="space-y-3">
              {/* OpenAI option — click to show model picker */}
              <button
                onClick={() => {
                  setTempProvider("openai");
                  setShowModelPicker(true);
                }}
                className="flex items-center gap-3 w-full p-3 rounded border border-inkLine hover:border-glow transition text-left"
              >
                <input type="radio" name="provider" value="openai" checked={provider === "openai"} readOnly className="w-4 h-4" />
                <div>
                  <div className="font-semibold text-ink-text">OpenAI</div>
                  <div className="text-xs text-inkDim">Select model to view pricing</div>
                </div>
              </button>

              {/* Anthropic option — click to show model picker */}
              <button
                onClick={() => {
                  setTempProvider("anthropic");
                  setShowModelPicker(true);
                }}
                className="flex items-center gap-3 w-full p-3 rounded border border-inkLine hover:border-glow transition text-left"
              >
                <input type="radio" name="provider" value="anthropic" checked={provider === "anthropic"} readOnly className="w-4 h-4" />
                <div>
                  <div className="font-semibold text-ink-text">Claude (Anthropic)</div>
                  <div className="text-xs text-inkDim">Select model to view pricing</div>
                </div>
              </button>

              {/* Gemini option — click to show model picker */}
              <button
                onClick={() => {
                  setTempProvider("gemini");
                  setShowModelPicker(true);
                }}
                className="flex items-center gap-3 w-full p-3 rounded border border-inkLine hover:border-glow transition text-left"
              >
                <input type="radio" name="provider" value="gemini" checked={provider === "gemini"} readOnly className="w-4 h-4" />
                <div>
                  <div className="font-semibold text-ink-text">Google Gemini</div>
                  <div className="text-xs text-inkDim">Select model to view pricing</div>
                </div>
              </button>

              {/* Fallback option — no model picker needed, directly select */}
              <button
                onClick={() => {
                  setProvider("fallback");
                  setSelectedModel("fallback");
                  setStep("confirm");
                }}
                className="flex items-center gap-3 w-full p-3 rounded border border-inkLine hover:border-glow transition text-left"
              >
                <input type="radio" name="provider" value="fallback" checked={provider === "fallback"} readOnly className="w-4 h-4" />
                <div>
                  <div className="font-semibold text-ink-text">Rule-Based (Free)</div>
                  <div className="text-xs text-inkDim">No API key needed, offline</div>
                </div>
              </button>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={handleBack} className="action">
              Back
            </button>
          </div>
        </div>

        {/* Model picker modal — shown when user clicks a provider */}
        {showModelPicker && tempProvider && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-inkLine rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-inkLine p-4 sticky top-0 bg-card">
                <h4 className="text-lg font-semibold">Select Model</h4>
                <button
                  onClick={() => {
                    setShowModelPicker(false);
                    setTempProvider(null);
                  }}
                  className="text-inkDim hover:text-ink-text text-xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Model list with pricing — showing input/output costs per 1M tokens */}
              <div className="p-4 space-y-2">
                {getModelsForProvider(tempProvider).map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setProvider(tempProvider as "openai" | "anthropic" | "gemini");
                      setSelectedModel(model.id);
                      setShowModelPicker(false);
                      setTempProvider(null);
                      setStep("confirm");
                    }}
                    className="w-full text-left p-3 rounded border border-inkLine hover:border-glow transition"
                  >
                    <div className="font-semibold text-ink-text">{model.name}</div>
                    <div className="text-xs text-inkDim">
                      Input: ${model.inputPer1M.toFixed(2)}/1M tokens | Output: ${model.outputPer1M.toFixed(2)}/1M tokens
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Render step 4: Confirm and run analysis
  if (step === "confirm") {
    const stepNum = kind === "file" ? "4" : "3";
    const totalSteps = kind === "file" ? "4" : "3";

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-base font-semibold">Review & Confirm</h4>
            <span className="text-xs bg-action-bg px-2 py-1 rounded text-action-text">Step {stepNum} of {totalSteps}</span>
          </div>

          {/* Summary of selected options — shows kind, file path (if applicable), provider, and model */}
          <div className="space-y-3">
            <div className="p-3 rounded border border-inkLine bg-action-bg">
              <div className="text-xs font-semibold text-action-text mb-1">Analysis Type</div>
              <div className="text-sm text-ink-text">{kind === "metadata" ? "Repository Metadata" : "Specific File"}</div>
            </div>

            {/* Show file path if analyzing a specific file */}
            {kind === "file" && (
              <div className="p-3 rounded border border-inkLine bg-action-bg">
                <div className="text-xs font-semibold text-action-text mb-1">File Path</div>
                <div className="text-sm text-ink-text font-mono">{filePath}</div>
              </div>
            )}

            {/* Show selected provider and model */}
            <div className="p-3 rounded border border-inkLine bg-action-bg">
              <div className="text-xs font-semibold text-action-text mb-1">AI Provider</div>
              <div className="text-sm text-ink-text">
                {provider === "fallback"
                  ? "Rule-Based (Free)"
                  : `${provider.charAt(0).toUpperCase() + provider.slice(1)} — ${selectedModel}`}
              </div>
            </div>

            {/* Show repository being analyzed */}
            <div className="p-3 rounded border border-inkLine bg-action-bg">
              <div className="text-xs font-semibold text-action-text mb-1">Repository</div>
              <div className="text-sm text-ink-text font-mono">{repo}</div>
            </div>
          </div>
        </div>

        {/* Navigation and action buttons */}
        <div className="flex justify-between gap-2 pt-4">
          <button onClick={handleBack} className="action">
            Back
          </button>
          <button className="action action-primary">Analyze</button>
        </div>
      </div>
    );
  }

  // Fallback — should not reach here
  return <div className="text-inkDim">Loading...</div>;
}
