import { cn } from "@/lib/utils";

export function ToggleSwitch({
  checked,
  className,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const track = (
    <span
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-gray-300 dark:bg-gray-600",
        disabled && "opacity-60",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </span>
  );

  if (!onChange) return track;

  return (
    <button
      aria-checked={checked}
      className="inline-flex h-7 w-11 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed dark:hover:bg-white/[0.07]"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      {track}
    </button>
  );
}
