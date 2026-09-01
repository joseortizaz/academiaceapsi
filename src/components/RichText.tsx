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
        "prose prose-lg max-w-none",
        "[&_h2]:text-foreground [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4",
        "[&_h3]:text-foreground [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-3",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:bg-muted/50 [&_blockquote]:p-4 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_blockquote]:text-lg",
        "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
