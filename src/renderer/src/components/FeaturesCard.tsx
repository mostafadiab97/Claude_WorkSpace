import { FEATURE_IDS, PREVIEW_FEATURES } from '../../../shared/features'
import { T } from '../../../shared/text'
import { personalChoice, setPersonalFeature, teamTurnedOff, useFeatureVersion } from '../lib/features'

/** Settings → Features (P-40a): turn a feature off on this PC; shows when the team turned one off. */
export function FeaturesCard() {
  useFeatureVersion()
  return (
    <section className="card" aria-labelledby="features-title">
      <h2 id="features-title">{T.settings.features.title}</h2>
      <p className="hint hint--flush">{T.settings.features.intro}</p>
      <ul className="features">
        {FEATURE_IDS.map((id) => (
          <li key={id} className="features__item">
            <label className="check">
              <input type="checkbox" checked={personalChoice(id)} onChange={(e) => setPersonalFeature(id, e.target.checked)} />
              <span>{T.settings.features.names[id] ?? id}</span>
            </label>
            {PREVIEW_FEATURES.includes(id) && <span className="badge">{T.settings.features.preview}</span>}
            {teamTurnedOff(id) && <span className="muted-inline">{T.settings.features.teamOff}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
