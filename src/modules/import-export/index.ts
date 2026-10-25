// PUBLIC ENTRY of the import-export module. Other code may import only from this file.
// Responsibility: turning requirements into files for people and tools outside the repository (CSV for Excel,
// Markdown for AI tools and reports) — and, from M7, reading Excel/CSV files back in. Pure functions: no file
// access; the workspace collects the data and the main process writes the file the user chose.
export { csvCell, parseCsv, toCsv } from './csv'
export { itemsToCsv, itemsToMarkdown, type ExportColumn, type ExportItem } from './items'
export { compareToCsv, compareToMarkdown } from './compare'
