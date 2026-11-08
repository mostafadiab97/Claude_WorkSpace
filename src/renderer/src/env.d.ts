declare module '*.css'
declare module '*.md?raw' {
  const text: string
  export default text
}
declare module '*.svg' {
  const url: string
  export default url
}

// import.meta.glob (Vite) — used for the user guide's pictures (lib/guide.ts)
interface ImportMeta {
  glob(pattern: string, options: { query: '?raw'; import: 'default'; eager: true }): Record<string, unknown>
}
