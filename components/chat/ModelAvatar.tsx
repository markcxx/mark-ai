"use client";

import { ModelBrandIcon } from "./ModelBrandIcon";

export function ModelAvatar({
  className,
  model,
  provider,
  size = 32,
}: {
  className?: string;
  model?: string;
  provider?: string;
  size?: number;
}) {
  return <ModelBrandIcon className={className} model={model} provider={provider} size={size} />;
}
