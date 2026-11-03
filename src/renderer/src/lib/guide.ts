// The user guide inside the app (Mostafa on 0.14.1 step 4): docs/USER-GUIDE.md is bundled at build time and shown in
// Settings with its sections in the left panel. The file is ours (no user content), rendered with marked (MIT).
import { Marked } from 'marked'
import guideText from '../../../../docs/USER-GUIDE.md?raw'

/** GitHub-style heading anchor, so the guide's own table of contents links work in the app too. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-')
}

export interface GuideSection {
  id: string
  title: string
}

/** The "## " sections of the guide, in order (for the left panel). */
export function guideSections(text = guideText): GuideSection[] {
  return [...text.matchAll(/^## (.+)$/gm)].map((m) => ({ id: slug(m[1] ?? ''), title: (m[1] ?? '').trim() }))
}

let html: string | null = null
/** The guide as HTML with an id on every heading. */
export function guideHtml(): string {
  if (html !== null) return html
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens)
        return `<h${depth} id="${slug(inner)}">${inner}</h${depth}>\n`
      }
    }
  })
  html = marked.parse(guideText, { async: false })
  return html
}
