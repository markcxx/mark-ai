"use client";

import { useRouter } from "next/navigation";
import { CakeSlice, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import { OnboardingShell, onboardingButtonClass } from "@/components/onboarding/OnboardingShell";

export default function AgeOnboardingPage() {
  const router = useRouter();
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);

  const finish = async () => {
    const value = Number(age);
    if (!Number.isInteger(value) || value < 6 || value > 120)
      return toast.error("请输入 6～120 岁之间的有效年龄");
    setLoading(true);
    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify({ age: value, complete: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "年龄保存失败");
      toast.success("一切准备就绪，欢迎来到 MarkAI");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingShell
      eyebrow="完善年龄"
      step={3}
      subtitle="年龄信息用于调整表达方式与内容边界，不会展示给其他用户。"
      title="你的年龄是多少？"
    >
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
        年龄
        <div className="mt-2 flex items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.04]">
          <CakeSlice className="mr-3 shrink-0 text-gray-400" size={20} />
          <input
            autoFocus
            className="h-14 min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
            max={120}
            min={6}
            onChange={(event) => setAge(event.target.value.replace(/\D/g, "").slice(0, 3))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void finish();
            }}
            placeholder="18"
            type="number"
            value={age}
          />
          <span className="pr-2 text-sm text-gray-400">岁</span>
        </div>
      </label>
      <div className="mt-8">
        <button className={onboardingButtonClass} disabled={loading} onClick={finish} type="button">
          {loading ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}
          进入 MarkAI
        </button>
      </div>
    </OnboardingShell>
  );
}
