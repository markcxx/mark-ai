import type { TokenUsageSource } from "@/lib/chat/types";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  tokenUsageSource?: TokenUsageSource;
};

export type ResolvedTokenUsage = Required<Omit<TokenUsage, "tokenUsageSource">> & {
  tokenUsageSource: TokenUsageSource;
};

export const getUsageNumber = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === "number" && Number.isFinite(item));
  return typeof value === "number" ? Math.max(0, Math.round(value)) : undefined;
};

export const resolveTokenUsage = ({
  estimatedInputTokens,
  estimatedOutputTokens,
  providerUsage,
}: {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  providerUsage?: TokenUsage;
}): ResolvedTokenUsage => {
  let inputTokens = getUsageNumber(providerUsage?.inputTokens);
  let outputTokens = getUsageNumber(providerUsage?.outputTokens);
  const providerTotalTokens = getUsageNumber(providerUsage?.totalTokens);

  if (
    inputTokens === undefined &&
    outputTokens !== undefined &&
    providerTotalTokens !== undefined
  ) {
    inputTokens = Math.max(providerTotalTokens - outputTokens, 0);
  }
  if (
    outputTokens === undefined &&
    inputTokens !== undefined &&
    providerTotalTokens !== undefined
  ) {
    outputTokens = Math.max(providerTotalTokens - inputTokens, 0);
  }

  const isProviderUsage = inputTokens !== undefined && outputTokens !== undefined;
  const resolvedInputTokens = inputTokens ?? estimatedInputTokens;
  const resolvedOutputTokens = outputTokens ?? estimatedOutputTokens;

  return {
    inputTokens: resolvedInputTokens,
    outputTokens: resolvedOutputTokens,
    tokenUsageSource: isProviderUsage ? "provider" : "estimated",
    totalTokens: providerTotalTokens ?? resolvedInputTokens + resolvedOutputTokens,
  };
};

export const addTokenUsage = (
  current: ResolvedTokenUsage | undefined,
  next: ResolvedTokenUsage,
): ResolvedTokenUsage => ({
  inputTokens: (current?.inputTokens || 0) + next.inputTokens,
  outputTokens: (current?.outputTokens || 0) + next.outputTokens,
  tokenUsageSource:
    !current || (current.tokenUsageSource === "provider" && next.tokenUsageSource === "provider")
      ? next.tokenUsageSource
      : "estimated",
  totalTokens: (current?.totalTokens || 0) + next.totalTokens,
});
