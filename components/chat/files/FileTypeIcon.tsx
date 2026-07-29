import { FileArchive, FileImage, FileSpreadsheet, FileText, Presentation } from "lucide-react";

import { cn } from "@/lib/utils";

type FileVisual = {
  icon: typeof FileText;
  iconColor: string;
  tileColor: string;
};

const getFileVisual = (contentType: string, name: string): FileVisual => {
  const lowerName = name.toLowerCase();

  if (contentType.startsWith("image/")) {
    return {
      icon: FileImage,
      iconColor: "text-blue-600 dark:text-blue-400",
      tileColor: "bg-blue-500 dark:bg-blue-500",
    };
  }
  if (
    contentType.includes("spreadsheet") ||
    [".csv", ".xls", ".xlsx"].some((extension) => lowerName.endsWith(extension))
  ) {
    return {
      icon: FileSpreadsheet,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      tileColor: "bg-emerald-600 dark:bg-emerald-600",
    };
  }
  if (
    contentType.includes("presentation") ||
    [".ppt", ".pptx"].some((extension) => lowerName.endsWith(extension))
  ) {
    return {
      icon: Presentation,
      iconColor: "text-amber-600 dark:text-amber-400",
      tileColor: "bg-amber-600 dark:bg-amber-600",
    };
  }
  if (contentType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return {
      icon: FileText,
      iconColor: "text-red-500 dark:text-red-400",
      tileColor: "bg-red-500 dark:bg-red-500",
    };
  }
  if (
    contentType.includes("wordprocessing") ||
    contentType === "application/msword" ||
    [".doc", ".docx"].some((extension) => lowerName.endsWith(extension))
  ) {
    return {
      icon: FileText,
      iconColor: "text-blue-600 dark:text-blue-400",
      tileColor: "bg-blue-600 dark:bg-blue-600",
    };
  }
  if (
    contentType.includes("zip") ||
    [".7z", ".rar", ".tar", ".zip"].some((extension) => lowerName.endsWith(extension))
  ) {
    return {
      icon: FileArchive,
      iconColor: "text-violet-600 dark:text-violet-400",
      tileColor: "bg-violet-600 dark:bg-violet-600",
    };
  }
  return {
    icon: FileText,
    iconColor: "text-gray-600 dark:text-gray-300",
    tileColor: "bg-gray-600 dark:bg-gray-500",
  };
};

export function FileTypeIcon({
  className,
  contentType,
  name,
  tile = false,
  tileClassName,
}: {
  className?: string;
  contentType: string;
  name: string;
  tile?: boolean;
  tileClassName?: string;
}) {
  const visual = getFileVisual(contentType, name);
  const Icon = visual.icon;

  if (tile) {
    return (
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm",
          visual.tileColor,
          tileClassName,
        )}
      >
        <Icon className={cn("h-5 w-5 text-white", className)} />
      </span>
    );
  }

  return <Icon className={cn("h-5 w-5", visual.iconColor, className)} />;
}
