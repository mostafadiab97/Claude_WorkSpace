// The user guide inside the app (the owner on 0.14.1 step 4 and 0.14.2 step 2): docs/USER-GUIDE.md is bundled at build
// time and shown in Settings and help, one page per "## " section, with the sections in the left panel. The file is
// ours (no user content), rendered with marked (MIT).
import { Marked } from 'marked'
import guideText from '../../../../docs/USER-GUIDE.md?raw'
import { slug, splitGuide } from '../../../shared/guide'

export interface GuidePage {
  /** Anchor of the page's "## " heading ('' for the first page: title, introduction and contents). */
  id: string
  title: string
  html: string
  /** Every heading anchor on the page (to follow a link to a sub-section). */
  anchors: string[]
}

const render = (md: string, anchors: string[]): string =>
  new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens)
        const id = slug(inner)
        anchors.push(id)
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`
      }
    }
  }).parse(md, { async: false })

let cache: GuidePage[] | null = null
export function guidePages(): GuidePage[] {
  if (cache) return cache
  cache = splitGuide(guideText).map((p) => {
    const anchors: string[] = []
    const html = render(p.md, anchors)
    return { id: p.id, title: p.title, html, anchors }
  })
  return cache
}
