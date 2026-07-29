import { FileImage, FileSpreadsheet, FileText, Presentation } from "lucide-react";

import { cn } from "@/lib/utils";

export function FileTypeIcon({
  className,
  contentType,
  name,
}: {
  className?: string;
  contentType: string;
  name: string;
}) {
  const lowerName = name.toLowerCase();
  const iconClassName = cn("h-5 w-5", className);

  if (contentType.startsWith("image/")) {
    return <FileImage className={cn(iconClassName, "text-blue-600 dark:text-blue-400")} />;
  }
  if (
    contentType.includes("spreadsheet") ||
    [".csv", ".xls", ".xlsx"].some((extension) => lowerName.endsWith(extension))
  ) {
    return (
      <FileSpreadsheet className={cn(iconClassName, "text-emerald-600 dark:text-emerald-400")} />
    );
  }
  if (
    contentType.includes("presentation") ||
    [".ppt", ".pptx"].some((extension) => lowerName.endsWith(extension))
  ) {
    return <Presentation className={cn(iconClassName, "text-amber-600 dark:text-amber-400")} />;
  }
  if (contentType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return <FileText className={cn(iconClassName, "text-red-500 dark:text-red-400")} />;
  }
  if (
    contentType.includes("wordprocessing") ||
    [".doc", ".docx"].some((extension) => lowerName.endsWith(extension))
  ) {
    return <FileText className={cn(iconClassName, "text-blue-600 dark:text-blue-400")} />;
  }
  return <FileText className={cn(iconClassName, "text-gray-600 dark:text-gray-300")} />;
}
