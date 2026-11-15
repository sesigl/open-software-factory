// The Markdown of a skill's SKILL.md as HTML for the page "/skills/<name>" (ADR 0141). The text comes from a
// repository, so the HTML holds no raw HTML, no script, no image and no link but to the web or to an email address.
import MarkdownIt from "markdown-it";

/** The only links that keep their anchor: the web and email. */
const KEPT = /^(https?|mailto):/i;

// Raw HTML is text; no linkify and no typographer: what the author wrote is what the page shows.
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

// Every link parses, so a link the page does not keep shows its words, not its Markdown.
markdown.validateLink = () => true;

markdown.core.ruler.push("osf_skill", (state) => {
  for (const block of state.tokens) {
    // A heading of SKILL.md sits below the page's title and the panel's heading: "#" is an h3.
    if (block.type === "heading_open" || block.type === "heading_close")
      block.tag = `h${Math.min(Number(block.tag.slice(1)) + 2, 6)}`;
    // A link that is not kept is hidden, its words stay; links nest by their close.
    const kept: boolean[] = [];
    for (const token of block.children ?? []) {
      if (token.type === "link_open") {
        const keep = KEPT.test(token.attrGet("href") as string);
        kept.push(keep);
        if (keep) token.attrSet("rel", "nofollow noreferrer");
        token.hidden = !keep;
      } else if (token.type === "link_close") token.hidden = !kept.pop();
    }
  }
});

// An image shows its alternative text: no image of any origin loads.
markdown.renderer.rules.image = (tokens, index, options, env, self) =>
  markdown.utils.escapeHtml(self.renderInlineAsText(tokens[index]?.children ?? [], options, env));

/** The HTML of a skill's Markdown. */
export const htmlOf = (text: string): string => markdown.render(text);
