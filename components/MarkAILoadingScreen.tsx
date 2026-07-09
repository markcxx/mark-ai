function MarkAIText({ className = '', size = 40 }: { className?: string; size?: number }) {
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

export function MarkAILoadingScreen({ className = '' }: { className?: string }) {
  return (
    <div
      aria-label="Loading"
      className={`flex h-screen h-dvh w-full items-center justify-center bg-[#f8f8f8] text-gray-950 dark:bg-black dark:text-gray-50 ${className}`}
      role="status"
    >
      <MarkAIText className="markai-brand-loading opacity-65" size={52} />
    </div>
  );
}
