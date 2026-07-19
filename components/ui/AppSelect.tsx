"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AppSelectOption<Value> = {
  disabled?: boolean;
  label: ReactNode;
  value: Value;
};

export type AppSelectClassNames = {
  item?: string;
  list?: string;
  popup?: string;
  positioner?: string;
  trigger?: string;
  value?: string;
};

export type AppSelectProps<Value> = {
  className?: string;
  classNames?: AppSelectClassNames;
  defaultOpen?: boolean;
  defaultValue?: Value;
  disabled?: boolean;
  id?: string;
  name?: string;
  onChange?: (value: Value) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  options: AppSelectOption<Value>[];
  placeholder?: ReactNode;
  readOnly?: boolean;
  required?: boolean;
  size?: "large" | "middle" | "small";
  style?: CSSProperties;
  value?: Value;
};

export function AppSelect<Value extends string | number = string>({
  className,
  classNames,
  defaultOpen,
  defaultValue,
  disabled,
  id,
  name,
  onChange,
  onOpenChange,
  open,
  options,
  placeholder,
  readOnly,
  required,
  size = "middle",
  style,
  value,
}: AppSelectProps<Value>) {
  return (
    <Select.Root
      defaultOpen={defaultOpen}
      defaultValue={defaultValue}
      disabled={disabled}
      id={id}
      items={options}
      name={name}
      onOpenChange={(nextOpen) => onOpenChange?.(nextOpen)}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange?.(nextValue);
      }}
      open={open}
      readOnly={readOnly}
      required={required}
      value={value}
    >
      <Select.Trigger
        className={cn(
          "markai-select-trigger inline-flex w-full select-none items-center gap-2 rounded-md border font-sans text-gray-900 outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100",
          size === "small" && "min-h-6 px-2 text-xs leading-[18px]",
          size === "middle" && "min-h-8 px-[11px] py-1 text-sm leading-5",
          size === "large" && "min-h-10 px-3 py-1.5 text-base leading-6",
          className,
          classNames?.trigger,
        )}
        style={{ width: 240, ...style }}
      >
        <Select.Value
          className={cn(
            "min-w-0 flex-1 truncate text-left data-[placeholder]:text-gray-400 dark:data-[placeholder]:text-gray-500",
            classNames?.value,
          )}
          placeholder={placeholder}
        />
        <Select.Icon className="flex shrink-0 items-center text-gray-400 transition-transform duration-150 data-[popup-open]:rotate-180">
          <ChevronDown size={size === "small" ? 12 : 14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          align="start"
          alignItemWithTrigger={false}
          className={cn("z-[1100] outline-none", classNames?.positioner)}
          sideOffset={6}
        >
          <Select.Popup
            className={cn(
              "markai-select-popup origin-[var(--transform-origin)] overflow-hidden p-1 transition-[opacity,transform] duration-150 data-[ending-style]:scale-y-[0.92] data-[ending-style]:opacity-0 data-[starting-style]:scale-y-[0.92] data-[starting-style]:opacity-0",
              classNames?.popup,
            )}
            style={{
              maxHeight: "min(512px, var(--available-height))",
              maxWidth: "var(--available-width)",
              minWidth: "var(--anchor-width)",
            }}
          >
            <Select.List
              className={cn("max-h-[min(504px,var(--available-height))] overflow-y-auto", classNames?.list)}
            >
              {options.map((option) => (
                <Select.Item
                  className={cn(
                    "markai-select-item flex min-h-8 w-full select-none items-center px-3 py-1.5 text-sm leading-5 text-gray-900 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 dark:text-gray-100",
                    classNames?.item,
                  )}
                  disabled={option.disabled}
                  key={String(option.value)}
                  value={option.value}
                >
                  <Select.ItemText className="min-w-0 flex-1 truncate">
                    {option.label}
                  </Select.ItemText>
                  <Select.ItemIndicator className="ml-2 flex shrink-0 items-center text-primary">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
