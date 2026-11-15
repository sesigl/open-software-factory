// The Markdown of a skill's SKILL.md as HTML for the page "/skills/<name>" (ADR 0141). The text comes from a
// repository, so the HTML holds no raw HTML, no script, no image and no link but to the web or to an email address.
import MarkdownIt, { type Token } from "markdown-it";

/** The only links that keep their anchor: the web and email. */
const KEPT = /^(https?|mailto):/i;

// Raw HTML is text; no linkify and no typographer: what the author wrote is what the page shows. These are
// markdown-it's defaults, written out because the page's safety rests on them.
// Stryker disable next-line ObjectLiteral: the same options as the defaults
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

// Every link parses, so a link the page does not keep shows its words, not its Markdown.
markdown.validateLink = () => true;

// Stryker disable next-line StringLiteral: the rule's name is only its name
markdown.core.ruler.push("osf_skill", (state) => {
  for (const block of state.tokens) {
    // A heading of SKILL.md sits below the page's title and the panel's heading: "#" is an h3.
    if (block.type === "heading_open" || block.type === "heading_close")
      block.tag = `h${Math.min(Number(block.tag.slice(1)) + 2, 6)}`;
    // A link that is not kept is hidden, its words stay. Markdown has no link inside a link, so a link's close is
    // the next one.
    let hide = false;
    for (const token of block.children ?? []) {
      if (token.type === "link_open") {
        hide = !KEPT.test(token.attrGet("href") as string);
        token.attrSet("rel", "nofollow noreferrer");
      }
      // Stryker disable next-line ConditionalExpression,EqualityOperator,StringLiteral: a browser drops the end tag of a hidden link's anchor
      if (token.type === "link_open" || token.type === "link_close") token.hidden = hide;
    }
  }
});

// An image shows its alternative text: no image of any origin loads.
markdown.renderer.rules.image = (tokens, index, options, env, self) =>
  markdown.utils.escapeHtml(self.renderInlineAsText((tokens[index] as Token).children as Token[], options, env));

/** The HTML of a skill's Markdown. */
export const htmlOf = (text: string): string => markdown.render(text);
