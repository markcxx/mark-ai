function MarkAIText({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      role="img"
      viewBox="0 0 920 180"
      width={Math.round(size * 4.65)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>MARKAI</title>
      <text
        dominantBaseline="middle"
        fontFamily="var(--font-plus-jakarta-sans), Arial, sans-serif"
        fontSize="108"
        fontWeight="720"
        letterSpacing="8"
        textAnchor="middle"
        x="460"
        y="92"
      >
        MARKAI
      </text>
    </svg>
  );
}

export function MarkAILoadingScreen({
  className = "",
  progress,
  status,
}: {
  className?: string;
  progress?: number;
  status?: string;
}) {
  return (
    <div
      aria-label="Loading"
      className={`relative flex h-screen h-dvh w-full items-center justify-center bg-[#f8f8f8] text-gray-950 dark:bg-black dark:text-gray-50 ${className}`}
      role="status"
    >
      <MarkAIText className="markai-brand-loading opacity-65" size={52} />
      {status && (
        <div className="absolute inset-x-0 bottom-[max(2.5rem,env(safe-area-inset-bottom))] mx-auto w-[min(22rem,calc(100vw-3rem))]">
          <div className="mb-2 flex items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="truncate">{status}</span>
            {typeof progress === "number" && (
              <span className="tabular-nums">{Math.round(progress)}%</span>
            )}
          </div>
          {typeof progress === "number" && (
            <div className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gray-700 transition-[width] duration-300 ease-out dark:bg-gray-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
