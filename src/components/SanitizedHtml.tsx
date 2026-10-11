import sanitizeHtml from "sanitize-html";

export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a", "h2", "h3", "h4", "blockquote"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
