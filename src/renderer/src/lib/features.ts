// Feature switches in the window (P-40a). Personal choices are remembered on this PC (local storage); the team's
// choices come from the open repository's schema.yaml (`features:`) and are set by WorkspaceScreen when it opens.
// Components read `useFeature('export')` and re-render when either side changes.
import { useSyncExternalStore } from 'react'
import { featureOn, type FeatureFlags, type FeatureId } from '../../../shared/features'

const STORAGE_KEY = 'reqman.features'

function loadPersonal(): FeatureFlags {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as FeatureFlags) : {}
  } catch {
    return {}
  }
}

let personal: FeatureFlags = loadPersonal()
let team: FeatureFlags | undefined
let version = 0
const listeners = new Set<() => void>()
const changed = (): void => {
  version++
  for (const l of listeners) l()
}
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** This PC's choice for a feature (undefined = not set = on). */
export const personalChoice = (id: FeatureId): boolean => personal[id] !== false
/** True when the team turned the feature off for the open repository. */
export const teamTurnedOff = (id: FeatureId): boolean => team?.[id] === false

export function setPersonalFeature(id: FeatureId, on: boolean): void {
  personal = { ...personal, [id]: on }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(personal))
  } catch {
    // private window: the choice lasts until the app closes
  }
  changed()
}

/** Called with the open repository's schema features (or undefined when no repository is open). */
export function setTeamFeatures(flags: FeatureFlags | undefined): void {
  if (JSON.stringify(flags ?? null) === JSON.stringify(team ?? null)) return
  team = flags
  changed()
}

/** Whether a feature is on now; re-renders the component when a switch changes. */
export function useFeature(id: FeatureId): boolean {
  useSyncExternalStore(subscribe, () => version)
  return featureOn(id, personal, team)
}

/** Re-renders when any switch changes (for the Settings list). */
export function useFeatureVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
