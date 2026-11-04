declare module '*.css'
declare module '*.md?raw' {
  const text: string
  export default text
}
declare module '*.svg' {
  const url: string
  export default url
}
