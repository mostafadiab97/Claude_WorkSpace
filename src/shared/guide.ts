// Pure helpers of the in-app user guide (tested in tests/guide-0.14.2.test.ts).

/** GitHub-style heading anchor, so the guide's own table of contents links work in the app too. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-')
}

/** Splits a guide into pages at its "## " headings; "## Contents" stays on the first page. */
export function splitGuide(text: string): { id: string; title: string; md: string }[] {
  const parts = text.split(/^(?=## )/m)
  const pages: { id: string; title: string; md: string }[] = []
  for (const part of parts) {
    const title = part.match(/^## (.+)$/m)?.[1]?.trim()
    if (!title || pages.length === 0 || /^contents$/i.test(title)) {
      if (pages.length === 0) pages.push({ id: '', title: part.match(/^# (.+)$/m)?.[1]?.trim() ?? '', md: part })
      else pages[0]!.md += part
      continue
    }
    pages.push({ id: slug(title), title, md: part.replace(/\n---\s*$/, '\n') })
  }
  return pages
}


/** The quick-start page, opened from the start screen (UX-24); a test checks the guide still has it. */
export const QUICK_START_PAGE = '1-quick-start-15-minutes'
