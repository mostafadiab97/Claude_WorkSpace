// The reqochet brand in the window (owner, 4 Nov 2026 — docs/reviews/2026-11-04-rename-reqochet.md). The files in
// resources/brand are final and used unchanged (never redrawn, recoloured or mirrored in Arabic); light or dark files
// are chosen by the window's colour mode. Animations play inside <img> and stop by themselves when Windows
// animations are off (prefers-reduced-motion is in each file).
import { T } from '../../../shared/text'
import logoOnLight from '../../../../resources/brand/logo/reqochet-logo-on-light.svg'
import logoOnDark from '../../../../resources/brand/logo/reqochet-logo-on-dark.svg'
import eyesIdleSmall from '../../../../resources/brand/motion/reqochet-eyes-idle-small.svg'
import eyesIdleLight from '../../../../resources/brand/motion/reqochet-eyes-idle-light.svg'
import eyesIdle from '../../../../resources/brand/motion/reqochet-eyes-idle.svg'
import eyesThinkingSmall from '../../../../resources/brand/motion/reqochet-eyes-thinking-small.svg'
import eyesThinkingLight from '../../../../resources/brand/motion/reqochet-eyes-thinking-light.svg'
import eyesThinking from '../../../../resources/brand/motion/reqochet-eyes-thinking.svg'
import iconSmall from '../../../../resources/brand/icon/reqochet-icon-small.svg'
import iconLightSmall from '../../../../resources/brand/icon/reqochet-icon-light-small.svg'
import icon from '../../../../resources/brand/icon/reqochet-icon.svg'
import iconLight from '../../../../resources/brand/icon/reqochet-icon-light.svg'
import loadingOnLight from '../../../../resources/brand/motion/reqochet-loading-on-light.svg'
import loadingOnDark from '../../../../resources/brand/motion/reqochet-loading-on-dark.svg'
import loadingIcon from '../../../../resources/brand/motion/reqochet-loading-icon.svg'

export type Mode = 'light' | 'dark'
export type FaceState = 'idle' | 'thinking' | 'still'

/** The name, as the drawn logo (never set in a font). At least 100 px wide (brand rule). */
export function BrandName({ mode, width }: { mode: Mode; width: number }) {
  return <img className="brand-name" src={mode === 'dark' ? logoOnDark : logoOnLight} alt={T.brand.name} width={Math.max(100, width)} />
}

/**
 * The app's face: the q and o of the icon as eyes. idle = glances and blinks; thinking = looks around while the app
 * works; still = the plain icon, when the window is in the background. Small cut below 32 px (brand rule); the dark
 * tile in the light window, the white tile in the dark one.
 */
export function BrandFace({ mode, state, size }: { mode: Mode; state: FaceState; size: number }) {
  const small = size < 32
  const src =
    state === 'still'
      ? mode === 'dark'
        ? small
          ? iconLightSmall
          : iconLight
        : small
          ? iconSmall
          : icon
      : state === 'thinking'
        ? mode === 'dark'
          ? eyesThinkingLight
          : small
            ? eyesThinkingSmall
            : eyesThinking
        : mode === 'dark'
          ? eyesIdleLight
          : small
            ? eyesIdleSmall
            : eyesIdle
  return <img className="brand-face" src={src} alt="" width={size} height={size} data-state={state} />
}

/** The loading animation: the name with its two dots bouncing (start of the app, opening a repository). */
export function BrandLoading({ mode, width, label }: { mode: Mode; width: number; label: string }) {
  return (
    <div className="brand-loading" role="status">
      <img src={mode === 'dark' ? loadingOnDark : loadingOnLight} alt="" width={width} />
      <span className="brand-loading__label">{label}</span>
    </div>
  )
}

/** The small busy icon (the icon with its dots bouncing) for long waits inside a panel. */
export function BrandBusy({ size = 24 }: { size?: number }) {
  return <img className="brand-busy" src={loadingIcon} alt="" width={size} height={size} />
}
