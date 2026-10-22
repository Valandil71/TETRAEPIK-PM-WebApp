"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

// Formatting SAP uses in instruction bodies; anything else (scripts, images, styles, forms) is dropped.
const ALLOWED_TAGS = [
  "p", "br", "div", "span", "strong", "b", "em", "i", "u", "code", "hr",
  "ul", "ol", "li", "a", "h3", "h4",
  "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col",
];
const ALLOWED_ATTR = ["href", "colspan", "rowspan"];

let linkHookAdded = false;

function sanitizeInstructionHtml(html: string): string | null {
  // DOMPurify needs the browser DOM; without it the plain-text fallback is shown.
  if (typeof window === "undefined" || !DOMPurify.isSupported) return null;
  if (!linkHookAdded) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    linkHookAdded = true;
  }
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

const HTML_CLASSES = [
  "text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words",
  "[&_p]:mb-2 [&_p:last-child]:mb-0",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1",
  "[&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_u]:underline",
  "[&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1",
  "[&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline",
  "[&_code]:font-mono [&_code]:text-xs [&_code]:bg-amber-100/60 dark:[&_code]:bg-gray-900/60 [&_code]:px-1 [&_code]:rounded",
  "[&_hr]:my-3 [&_hr]:border-amber-200 dark:[&_hr]:border-amber-800/40",
  "[&_table]:my-2 [&_table]:border-collapse [&_table]:block [&_table]:overflow-x-auto",
  "[&_td]:border [&_th]:border [&_td]:border-amber-200 [&_th]:border-amber-200 dark:[&_td]:border-amber-800/40 dark:[&_th]:border-amber-800/40",
  "[&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
].join(" ");

/** Body of a SAP instruction: SAP's HTML (sanitized) when stored, otherwise the plain text. */
export function SapInstructionBody({ html, text }: { html?: string; text: string }) {
  const safeHtml = useMemo(() => (html ? sanitizeInstructionHtml(html) : null), [html]);

  if (safeHtml) {
    return (
      <div
        className={HTML_CLASSES}
        style={{ overflowWrap: "anywhere" }}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <p
      className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line break-words"
      style={{ overflowWrap: "anywhere" }}
    >
      {text}
    </p>
  );
}
