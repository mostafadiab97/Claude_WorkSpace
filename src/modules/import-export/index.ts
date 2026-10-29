// PUBLIC ENTRY of the import-export module. Other code may import only from this file.
// Responsibility: turning requirements into files for people and tools outside the repository (CSV for Excel,
// Markdown for AI tools and reports, Excel) — and reading Excel/CSV files back in (M7: guessing what each column
// means and planning the import). Pure functions: no file
// access; the workspace collects the data and the main process writes the file the user chose.
export { csvCell, detectSeparator, parseCsv, toCsv } from './csv'
export { cellText, readXlsx, updateXlsx, writeXlsx, type CellEdit, type SheetData } from './xlsx'
export { guessHeaderRow, guessMapping, outlineOf, planImport, type ExistingItems, type ImportPlan, type ImportPlanInput, type PlannedItem } from './importPlan'
export { markdownToXhtml, readReqif, REQIF_COLUMNS, writeReqif, type ReqifItem } from './reqif'
export { itemsToCsv, itemsToMarkdown, itemsToSheet, itemsToTable, type ExportColumn, type ExportItem } from './items'
export { compareToCsv, compareToMarkdown, compareToSheet } from './compare'
