const BARS = [92, 88, 87, 85, 80, 79, 77, 76, 75, 74, 72, 70, 68, 66, 64, 62];

export default function RankingsLoading() {
  return (
    <div
      aria-label="正在加载模型排名"
      aria-busy="true"
      role="status"
      className="flex h-dvh w-full overflow-hidden bg-[var(--chat-app-bg)] p-0 md:p-2"
    >
      <aside className="hidden w-[248px] shrink-0 flex-col gap-2 p-3 md:flex">
        <div className="mb-4 flex items-center gap-3 px-2 pt-1">
          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-white/10" />
          <div className="h-4 w-20 rounded bg-gray-200 dark:bg-white/10" />
        </div>
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-9 rounded-lg bg-gray-200/60 dark:bg-white/[0.06]" />
        ))}
      </aside>
      <main className="min-w-0 flex-1 animate-pulse overflow-hidden md:rounded-xl md:border md:border-[#e5e5e5] md:bg-[#f4f5f7] dark:md:border-white/10 dark:md:bg-[#0e0f11]">
        <div className="h-[69px] border-b border-gray-200/70 dark:border-white/[0.07]" />
        <div className="mx-auto max-w-[1440px] space-y-4 px-3 py-4 md:px-6 md:py-6">
          <div className="h-9 w-full max-w-xl rounded-lg bg-gray-200/70 dark:bg-white/[0.06]" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="h-[118px] rounded-xl bg-white dark:bg-[#111214]" />
            ))}
          </div>
          <div className="flex h-[520px] items-end gap-3 overflow-hidden rounded-xl bg-white px-5 pb-40 pt-12 dark:bg-[#111214]">
            {BARS.map((height, index) => (
              <div
                key={index}
                className="w-[46px] shrink-0 rounded-t-md bg-gray-200 dark:bg-white/10"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
