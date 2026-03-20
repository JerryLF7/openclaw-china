/**
 * WeChat MP text normalization utilities
 *
 * Provides markdown-friendly text normalization that can be shared between
 * the reply pipeline (dispatch.ts) and direct outbound (outbound.ts).
 *
 * The normalization behavior is controlled by the `renderMarkdown` config:
 * - true (default): Apply markdown-friendly formatting for WeChat MP
 * - false: Minimal passthrough, preserving original text
 */

/**
 * Normalize text for WeChat MP delivery.
 *
 * When renderMarkdown is enabled (default), converts markdown to WeChat MP
 * friendly plain text. When disabled, returns text with minimal changes.
 *
 * @param text - The raw text to normalize
 * @param renderMarkdown - Whether to apply markdown-friendly formatting
 * @returns Normalized text ready for WeChat MP delivery
 */
export function normalizeWechatMpText(text: string, renderMarkdown: boolean): string {
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  // When renderMarkdown is disabled, pass through with minimal normalization
  if (!renderMarkdown) {
    return raw;
  }

  // Apply markdown-friendly normalization for WeChat MP
  return stripMarkdownForWechatMp(raw);
}

/**
 * Strip markdown formatting and convert to WeChat MP friendly plain text.
 *
 * WeChat MP text messages do not support markdown, so we convert to a
 * readable plain-text format similar to the wecom-app implementation.
 */
function stripMarkdownForWechatMp(text: string): string {
  let result = text;

  // 1. Code blocks: extract content with indentation (preserve language label)
  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return "";
    const langLabel = lang ? `[${lang}]\n` : "";
    const indentedCode = trimmedCode
      .split("\n")
      .map((line: string) => `    ${line}`)
      .join("\n");
    return `\n${langLabel}${indentedCode}\n`;
  });

  // 2. Headings: use brackets to mark
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "[$1]");

  // 3. Bold/italic: preserve text (exclude underscores in URLs)
  result = result
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    // Only replace standalone underscores (surrounded by space/punctuation), avoid URLs
    .replace(/(?<![\w/])_(.+?)_(?![\w/])/g, "$1");

  // 4. Unordered list items to bullet points
  result = result.replace(/^[-*]\s+/gm, "- ");

  // 5. Ordered lists keep numbering
  result = result.replace(/^(\d+)\.\s+/gm, "$1. ");

  // 6. Inline code: preserve content
  result = result.replace(/`([^`]+)`/g, "$1");

  // 7. Strikethrough
  result = result.replace(/~~(.*?)~~/g, "$1");

  // 8. Links: preserve text and URL
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // 9. Images: display alt text
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, "[image: $1]");

  // 10. Tables: simplify to aligned text (basic table support)
  result = result.replace(
    /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)*)/g,
    (_match, header, body) => {
      const headerCells = header.split("|").map((c: string) => c.trim()).filter(Boolean);
      const rows = body.trim().split("\n").map((row: string) =>
        row.split("|").map((c: string) => c.trim()).filter(Boolean)
      );

      // Calculate max width per column
      const colWidths = headerCells.map((h: string, i: number) => {
        const maxRowWidth = Math.max(...rows.map((r: string[]) => (r[i] || "").length));
        return Math.max(h.length, maxRowWidth);
      });

      // Format header
      const formattedHeader = headerCells
        .map((h: string, i: number) => h.padEnd(colWidths[i]))
        .join("  ");

      // Format data rows
      const formattedRows = rows
        .map((row: string[]) =>
          headerCells.map((_: string, i: number) =>
            (row[i] || "").padEnd(colWidths[i])
          ).join("  ")
        )
        .join("\n");

      return `${formattedHeader}\n${formattedRows}\n`;
    }
  );

  // 11. Blockquotes: remove > prefix
  result = result.replace(/^>\s?/gm, "");

  // 12. Horizontal rules
  result = result.replace(/^[-*_]{3,}$/gm, "------------");

  // 13. Collapse multiple blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * Resolve the renderMarkdown setting from account config.
 * Defaults to true if not explicitly set to false.
 */
export function resolveRenderMarkdown(config: { renderMarkdown?: boolean }): boolean {
  return config.renderMarkdown !== false;
}
