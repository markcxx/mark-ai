import Image from "@/components/ui/AppImage";
import type { RankingVendor } from "@/lib/model-rankings";
import { cn } from "@/lib/utils";

/** Brand glyph tinted with the vendor color, matching the bar it labels. */
export function VendorLogo({
  className,
  name,
  size = 20,
  vendor,
}: {
  className?: string;
  name?: string;
  size?: number;
  vendor: RankingVendor;
}) {
  const style = {
    "--vendor": vendor.color,
    "--vendor-dark": vendor.darkColor || vendor.color,
  } as React.CSSProperties;
  if (!vendor.icon) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-gray-100 font-jakarta font-bold text-gray-500 dark:bg-white/[0.08] dark:text-gray-400",
          className,
        )}
        style={{ fontSize: Math.round(size * 0.5), height: size, width: size }}
      >
        {(name || vendor.label).match(/[a-z0-9]/i)?.[0]?.toUpperCase() || "·"}
      </span>
    );
  }
  // "-color" assets carry their own palette; monochrome assets are masked.
  const colored = vendor.icon.endsWith("-color");
  return (
    <Image
      native
      mask={!colored}
      alt=""
      aria-hidden="true"
      src={`/images/model-icons/${vendor.icon}.svg`}
      width={size}
      height={size}
      containerClassName={cn(
        "shrink-0 text-[var(--vendor)] dark:text-[var(--vendor-dark)]",
        className,
      )}
      containerStyle={style}
    />
  );
}
