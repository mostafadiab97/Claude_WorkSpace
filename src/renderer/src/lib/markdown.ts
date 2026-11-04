// Item text shown formatted while it is not being edited (UI review UX-08, a small step before the rich-text editor
// of theme 3a). Item text comes from other people's commits, so it is treated as untrusted: raw HTML is shown as
// text, images show their description only, and only https/mailto links become links (the window opens them in the
// browser; it never navigates away — see main/index.ts). The page's Content-Security-Policy blocks scripts as well.
import { Marked } from 'marked'

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escape(text)
    },
    image({ text }) {
      return escape(text)
    },
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens)
      return /^(https:|mailto:)/i.test(href) ? `<a href="${escape(href)}" target="_blank" rel="noreferrer">${inner}</a>` : inner
    }
  }
})

/** Markdown → safe HTML for the editor's Text preview. */
export function renderItemText(md: string): string {
  return marked.parse(md, { async: false })
}

/** The text without Markdown markers, for one-line places such as the table's Text column. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, ''))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|>\s?)/gm, '')
    .replace(/(\*\*|\*|`|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
    // underscores mark emphasis only at word edges, never inside words (SIG_BRAKE_REQ, a_b_c) — as Markdown does
    .replace(/(^|[^\p{L}\p{N}_])(__|_)(?=\S)([\s\S]*?\S)\2(?![\p{L}\p{N}_])/gu, '$1$3')
    .replace(/\s+/g, ' ')
    .trim()
}
