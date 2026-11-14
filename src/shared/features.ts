// Feature switches (P-40a, the owner 2 Nov 2026): every switchable feature can be turned off by a person on this PC
// (Settings → Features) or by the team for one repository (`features:` in requirements/.reqman/schema.yaml).
// A feature is on only when neither turned it off. New features start as `preview` until a pilot cycle has used
// them without problems; if one shows a defect it can be turned off and work goes on while it is fixed.
// Changes to the file format are never behind a switch (both old and new files must always be readable).

// 0.25 (the owner, 14 Nov 2026: "new features are not added to it"): Versions (0.18) and Traceability (0.20) joined
export const FEATURE_IDS = ['branches', 'import', 'export', 'versions', 'traceability'] as const
export type FeatureId = (typeof FEATURE_IDS)[number]

/** Features still in preview: shown with a "Preview" mark in Settings. */
export const PREVIEW_FEATURES: readonly FeatureId[] = []

export type FeatureFlags = Partial<Record<string, boolean>>

export const isFeatureId = (id: string): id is FeatureId => (FEATURE_IDS as readonly string[]).includes(id)

/** On unless this PC (`personal`) or the team (`team`, from schema.yaml) turned it off. */
export function featureOn(id: FeatureId, personal: FeatureFlags, team: FeatureFlags | undefined): boolean {
  return personal[id] !== false && team?.[id] !== false
}
