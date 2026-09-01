import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";

export const Route = createFileRoute("/tmp-editor-test")({
  component: TmpEditorTest,
});

const initial =
  '<h2>Beneficios del formato</h2><p>Este texto tiene <strong>negrita</strong> y una lista:</p><ul><li><p>Primer punto con viñeta</p></li><li><p>Segundo punto</p></li></ul><p>Texto normal de cierre.</p>';

function TmpEditorTest() {
  const [html, setHtml] = useState(initial);
  return (
    <div className="container mx-auto max-w-2xl p-8">
      <RichTextEditor value={html} onChange={setHtml} minHeight={220} />
      <pre id="out" className="mt-4 whitespace-pre-wrap text-xs">{html}</pre>
    </div>
  );
}
