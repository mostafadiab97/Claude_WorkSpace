// The window's language (0.13.0, owner's request 31 Oct 2026): English or Arabic, switched like light/dark.
// setLanguage() swaps the texts of T in place; the document direction flips for Arabic (right to left); the choice
// is remembered on this PC (local storage) and sent to the core, whose messages (Git, saving…) follow too.
import { createContext, useContext } from 'react'
import { isRtl, setLanguage, type Language } from '../../../shared/text'

const STORAGE_KEY = 'reqman.language'

export function loadSavedLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

/** Applies a language to texts, document direction and the core; remembers it. */
export function applyLanguage(lang: Language): void {
  setLanguage(lang)
  document.documentElement.lang = lang
  document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr'
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // private window: the choice is not remembered
  }
  void window.reqman.setLanguage(lang).catch(() => {})
}

export const isRtlDocument = (): boolean => document.documentElement.dir === 'rtl'

/** Components that memoise texts (tables, menus) read this so they recompute when the language changes. */
export const LanguageContext = createContext<Language>('en')
export const useLanguage = (): Language => useContext(LanguageContext)
