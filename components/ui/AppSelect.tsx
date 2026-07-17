'use client';

import { Select } from '@lobehub/ui/base-ui';
import type { SelectProps } from '@lobehub/ui/base-ui';

import { cn } from '@/lib/utils';

export function AppSelect<Value = string>({
  classNames,
  style,
  ...props
}: SelectProps<Value>) {
  return (
    <Select
      {...props}
      classNames={{
        ...classNames,
        item: cn('markai-select-item', classNames?.item),
        popup: cn('markai-select-popup', classNames?.popup),
        trigger: cn('markai-select-trigger', classNames?.trigger),
      }}
      style={{ width: 240, ...style }}
    />
  );
}
