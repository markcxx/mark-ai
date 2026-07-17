"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, LoaderCircle, MoveRight, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { OnboardingShell, onboardingButtonClass } from "@/components/onboarding/OnboardingShell";
import { uploadFile } from "@/lib/client/file-upload";

export default function AvatarOnboardingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const continueNext = async () => {
    if (!file) {
      router.push("/onboarding/name");
      return;
    }
    setLoading(true);
    try {
      await uploadFile(file, { kind: "avatar" });
      toast.success("头像已保存");
      router.push("/onboarding/name");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingShell
      eyebrow="设置头像"
      step={1}
      subtitle="让你的 MarkAI 空间更有辨识度。你可以现在上传，也可以稍后再设置。"
      title="选择一张你喜欢的头像"
    >
      <input
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
        ref={inputRef}
        type="file"
      />
      <button
        className="group relative mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400 ring-1 ring-gray-200 transition-colors hover:bg-gray-200 dark:bg-white/[0.06] dark:ring-white/10 dark:hover:bg-white/[0.1]"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {preview ? (
          <Image
            alt="头像预览"
            className="h-full w-full object-cover"
            height={160}
            src={preview}
            unoptimized
            width={160}
          />
        ) : (
          <UserRound size={56} strokeWidth={1.4} />
        )}
        <span className="absolute inset-x-0 bottom-0 flex h-12 items-center justify-center gap-2 bg-black/45 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Camera size={15} />
          更换头像
        </span>
      </button>
      <button
        className="mx-auto mt-5 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <ImagePlus size={16} />
        {file ? "重新选择图片" : "从设备中选择"}
      </button>
      <p className="mt-2 text-center text-xs text-gray-400">JPG、PNG 或 WebP，最大 2 MB</p>
      <div className="mx-auto mt-8 max-w-sm">
        <button
          className={onboardingButtonClass}
          disabled={loading}
          onClick={continueNext}
          type="button"
        >
          {loading && <LoaderCircle className="animate-spin" size={17} />}
          {file ? "保存并继续" : "暂时跳过"}
          <MoveRight size={17} />
        </button>
      </div>
    </OnboardingShell>
  );
}
