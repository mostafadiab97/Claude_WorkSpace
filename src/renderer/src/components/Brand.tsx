// The reqochet brand in the window (owner, 4 Nov 2026 — docs/reviews/done/2026-11-04-rename-reqochet.md). The files in
// resources/brand are final and used unchanged (never redrawn, recoloured or mirrored in Arabic); the light, dark or
// Ember files are chosen by the window's colour mode, the Arabic name by the window's language (owner, 13 Nov 2026).
// Animations play inside <img> and stop by themselves when Windows animations are off (prefers-reduced-motion is in
// each file).
import { T, type Language } from '../../../shared/text'
import logoOnLight from '../../../../resources/brand/logo/reqochet-logo-on-light.svg'
import logoOnDark from '../../../../resources/brand/logo/reqochet-logo-on-dark.svg'
import logoOnEmber from '../../../../resources/brand/logo/reqochet-logo-on-ember.svg'
import logoArOnLight from '../../../../resources/brand/logo/reqochet-logo-ar-on-light.svg'
import logoArOnDark from '../../../../resources/brand/logo/reqochet-logo-ar-on-dark.svg'
import logoArOnEmber from '../../../../resources/brand/logo/reqochet-logo-ar-on-ember.svg'
import eyesIdleSmall from '../../../../resources/brand/motion/reqochet-eyes-idle-small.svg'
import eyesIdleLightSmall from '../../../../resources/brand/motion/reqochet-eyes-idle-light-small.svg'
import eyesIdleLight from '../../../../resources/brand/motion/reqochet-eyes-idle-light.svg'
import eyesIdle from '../../../../resources/brand/motion/reqochet-eyes-idle.svg'
import eyesIdleEmber from '../../../../resources/brand/motion/reqochet-eyes-idle-ember.svg'
import eyesIdleEmberSmall from '../../../../resources/brand/motion/reqochet-eyes-idle-ember-small.svg'
import eyesThinkingSmall from '../../../../resources/brand/motion/reqochet-eyes-thinking-small.svg'
import eyesThinkingLightSmall from '../../../../resources/brand/motion/reqochet-eyes-thinking-light-small.svg'
import eyesThinkingLight from '../../../../resources/brand/motion/reqochet-eyes-thinking-light.svg'
import eyesThinking from '../../../../resources/brand/motion/reqochet-eyes-thinking.svg'
import eyesThinkingEmber from '../../../../resources/brand/motion/reqochet-eyes-thinking-ember.svg'
import eyesThinkingEmberSmall from '../../../../resources/brand/motion/reqochet-eyes-thinking-ember-small.svg'
import iconSmall from '../../../../resources/brand/icon/reqochet-icon-small.svg'
import iconLightSmall from '../../../../resources/brand/icon/reqochet-icon-light-small.svg'
import icon from '../../../../resources/brand/icon/reqochet-icon.svg'
import iconLight from '../../../../resources/brand/icon/reqochet-icon-light.svg'
import iconEmber from '../../../../resources/brand/icon/reqochet-icon-ember.svg'
import iconEmberSmall from '../../../../resources/brand/icon/reqochet-icon-ember-small.svg'
import loadingOnLight from '../../../../resources/brand/motion/reqochet-loading-on-light.svg'
import loadingOnDark from '../../../../resources/brand/motion/reqochet-loading-on-dark.svg'
import loadingOnEmber from '../../../../resources/brand/motion/reqochet-loading-on-ember.svg'
import loadingArOnLight from '../../../../resources/brand/motion/reqochet-loading-ar-on-light.svg'
import loadingArOnDark from '../../../../resources/brand/motion/reqochet-loading-ar-on-dark.svg'
import loadingArOnEmber from '../../../../resources/brand/motion/reqochet-loading-ar-on-ember.svg'
import loadingIcon from '../../../../resources/brand/motion/reqochet-loading-icon.svg'
import loadingIconEmber from '../../../../resources/brand/motion/reqochet-loading-icon-ember.svg'

/** The colour set shown (the same three as `Shown` in theme/applyTheme.ts). */
export type Mode = 'light' | 'dark' | 'ember'
export type FaceState = 'idle' | 'thinking' | 'still'

// The Arabic name is drawn in the same units as the English one and is shorter: at this share of the English width
// its letters are exactly as tall (resources/brand/brand-tokens.json → logo.arabic.widthOfEnglish).
const ARABIC_WIDTH = 0.7704
// Arabic has its own name; every other language (English, German, French, Spanish) shows the Latin name
type Script = 'latin' | 'arabic'
const scriptOf = (lang: Language): Script => (lang === 'ar' ? 'arabic' : 'latin')
const NAME: Record<Script, Record<Mode, string>> = {
  latin: { light: logoOnLight, dark: logoOnDark, ember: logoOnEmber },
  arabic: { light: logoArOnLight, dark: logoArOnDark, ember: logoArOnEmber }
}
const LOADING: Record<Script, Record<Mode, string>> = {
  latin: { light: loadingOnLight, dark: loadingOnDark, ember: loadingOnEmber },
  arabic: { light: loadingArOnLight, dark: loadingArOnDark, ember: loadingArOnEmber }
}
// the dark tile in the light window, the white tile in the dark one, the Ember tile in Ember: [full drawing, small cut]
const FACE: Record<FaceState, Record<Mode, readonly [string, string]>> = {
  still: { light: [icon, iconSmall], dark: [iconLight, iconLightSmall], ember: [iconEmber, iconEmberSmall] },
  thinking: { light: [eyesThinking, eyesThinkingSmall], dark: [eyesThinkingLight, eyesThinkingLightSmall], ember: [eyesThinkingEmber, eyesThinkingEmberSmall] },
  idle: { light: [eyesIdle, eyesIdleSmall], dark: [eyesIdleLight, eyesIdleLightSmall], ember: [eyesIdleEmber, eyesIdleEmberSmall] }
}
const nameWidth = (language: Language, width: number): number => Math.round(language === 'ar' ? width * ARABIC_WIDTH : width)

/**
 * The name, as the drawn logo (never set in a font): «ريكوشيه» while the window is in Arabic. `width` is the width of
 * the English name, at least 100 px (brand rule); the Arabic name is drawn at the same letter height.
 */
export function BrandName({ mode, width, language = 'en' }: { mode: Mode; width: number; language?: Language }) {
  return <img className="brand-name" src={NAME[scriptOf(language)][mode]} alt={T.brand.name} width={nameWidth(language, Math.max(100, width))} />
}

/**
 * The app's face: the q and o of the icon as eyes. idle = glances and blinks; thinking = looks around while the app
 * works; still = the plain icon, when the window is in the background. Small cut below 32 px (brand rule); the dark
 * tile in the light window, the white tile in the dark one, the Ember tile in Ember. The same in every language.
 */
export function BrandFace({ mode, state, size }: { mode: Mode; state: FaceState; size: number }) {
  return <img className="brand-face" src={FACE[state][mode][size < 32 ? 1 : 0]} alt="" width={size} height={size} data-state={state} />
}

/** The loading animation: the name with its two dots bouncing (start of the app, opening a repository). */
export function BrandLoading({ mode, width, label, language = 'en' }: { mode: Mode; width: number; label: string; language?: Language }) {
  return (
    <div className="brand-loading" role="status">
      <img src={LOADING[scriptOf(language)][mode]} alt="" width={nameWidth(language, width)} />
      <span className="brand-loading__label">{label}</span>
    </div>
  )
}

/** The small busy icon (the icon with its dots bouncing) for long waits inside a panel. */
export function BrandBusy({ size = 24, mode = 'light' }: { size?: number; mode?: Mode }) {
  return <img className="brand-busy" src={mode === 'ember' ? loadingIconEmber : loadingIcon} alt="" width={size} height={size} />
}
