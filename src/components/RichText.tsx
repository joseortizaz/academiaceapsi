import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

interface RichTextProps {
  html: string | null | undefined;
  className?: string;
}

// Detect legacy plain-text values (no HTML tags). Render as preserved whitespace.
function isHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

export function RichText({ html, className }: RichTextProps) {
  if (!html) return null;
  if (!isHtml(html)) {
    return (
      <div className={cn("whitespace-pre-wrap", className)}>{html}</div>
    );
  }
  const clean = typeof window === "undefined"
    ? html // SSR: trust stored HTML (we only write Tiptap output from admin)
    : DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
