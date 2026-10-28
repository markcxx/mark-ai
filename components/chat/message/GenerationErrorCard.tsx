import { AlertCircle, ChevronDown } from "lucide-react";
import { getGenerationErrorDisplay } from "@/lib/chat/generation-error-display";

export function GenerationErrorCard({ content }: { content: string }) {
  const error = getGenerationErrorDisplay(content);
  return (
    <div
      role="alert"
      className="mt-3 min-w-0 rounded-lg border border-gray-200 bg-gray-50/80 text-sm dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="flex items-start gap-2.5 p-3">
        <AlertCircle
          aria-hidden="true"
          size={17}
          className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium text-gray-800 dark:text-gray-200">{error.title}</p>
            {error.code && (
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                HTTP {error.code}
              </span>
            )}
          </div>
          <p className="mt-1 break-words leading-relaxed text-gray-500 dark:text-gray-400">
            {error.message}
          </p>
        </div>
      </div>
      <details className="group border-t border-gray-200 dark:border-white/10">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 px-3 text-xs text-gray-500 outline-none hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:text-gray-400 dark:hover:text-gray-200 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            aria-hidden="true"
            size={14}
            className="transition-transform group-open:rotate-180"
          />
          错误详情
        </summary>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 font-mono text-xs leading-relaxed text-gray-600 [overflow-wrap:anywhere] dark:text-gray-400">
          {error.details}
        </pre>
      </details>
    </div>
  );
}
