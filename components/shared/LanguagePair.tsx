import { cn } from "@/lib/utils";

interface LanguagePairProps {
  languageIn?: string | null;
  languageOut?: string | null;
  className?: string;
}

/** Source and target language shown as "enUS → ptBR". */
export function LanguagePair({ languageIn, languageOut, className }: LanguagePairProps) {
  return (
    <span className={cn("whitespace-nowrap text-gray-700 dark:text-gray-300", className)}>
      {languageIn || "-"} → {languageOut || "-"}
    </span>
  );
}
