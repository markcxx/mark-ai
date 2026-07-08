'use client';

import { ModelIcon } from '@lobehub/icons';

import { cn } from '@/lib/utils';

export function ModelAvatar({
  className,
  model,
  size = 32,
}: {
  className?: string;
  model?: string;
  provider?: string;
  size?: number;
}) {
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-gray-200',
        className,
      )}
      style={{ height: size, width: size }}
    >
      <ModelIcon model={model} size={size} type="avatar" />
    </div>
  );
}

