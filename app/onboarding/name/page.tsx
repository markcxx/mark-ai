"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, MoveRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { OnboardingShell, onboardingButtonClass } from "@/components/onboarding/OnboardingShell";

export default function NameOnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    void fetch("/api/profile")
      .then((response) => response.json())
      .then((data) => setName(data.user?.fullName || ""))
      .catch(() => undefined);
  }, []);

  const save = async () => {
    if (name.trim().length < 2) return toast.error("昵称至少需要 2 个字符");
    setLoading(true);
    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify({ fullName: name.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "昵称保存失败");
      toast.success("记住你的名字了");
      router.push("/onboarding/age");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingShell
      eyebrow="设置昵称"
      step={2}
      subtitle="告诉我们希望怎样称呼你。这个名字会出现在你的个人空间里，也可以随时修改。"
      title="我们应该怎么称呼你？"
    >
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
        你的昵称
        <div className="mt-2 flex items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.04]">
          <Sparkles className="mr-3 shrink-0 text-gray-400" size={20} />
          <input
            autoFocus
            className="h-14 min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
            placeholder="输入你喜欢的名字"
            value={name}
          />
        </div>
      </label>
      <div className="mt-8">
        <button className={onboardingButtonClass} disabled={loading} onClick={save} type="button">
          {loading && <LoaderCircle className="animate-spin" size={17} />}继续
          <MoveRight size={17} />
        </button>
      </div>
    </OnboardingShell>
  );
}
