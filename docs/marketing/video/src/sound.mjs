// Makes the sound of the film and of the logo sting: every effect is calculated here (sine waves and filtered
// noise - nothing recorded, nothing downloaded), then the spoken lines in narration/ are laid over them.
//   node sound.mjs            -> audio/film.wav (voice + effects), audio/film-effects.wav, audio/film-voice.wav,
//                                audio/sting.wav, and a table of levels
// The times below are the film's clock and mirror index.html; the sting's times mirror build-sting.mjs.
// Needs ffmpeg on the PATH (only to read the spoken lines). render.mjs and render-sting.mjs put the result into the MP4s.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const RATE = 48000
const db = (x) => 10 ** (x / 20)
const toDb = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity)

// the same "random" numbers on every run, so the sound is the same file every time
function noiseSource(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1
  }
}

class Track {
  constructor(seconds) {
    this.l = new Float32Array(Math.ceil(seconds * RATE))
    this.r = new Float32Array(this.l.length)
    this.noise = noiseSource(7)
  }
  /** Adds a sound: fn(seconds since its start) -> sample; pan -1 (left) … 1 (right); level in dB. */
  add(at, length, level, pan, fn) {
    const g = db(level), gl = g * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2 * 0.5 * 2 ** 0.5, gr = g * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2 * 0.5 * 2 ** 0.5
    const i0 = Math.round(at * RATE), n = Math.round(length * RATE)
    for (let i = 0; i < n && i0 + i < this.l.length; i++) {
      if (i0 + i < 0) continue
      const t = i / RATE
      // 3 ms fade at both ends: no clicks from a sound that starts or stops mid-wave
      const edge = Math.min(1, t / 0.003, (length - t) / 0.003)
      const s = fn(t, i) * edge
      this.l[i0 + i] += s * gl
      this.r[i0 + i] += s * gr
    }
  }
  /** Filtered noise: a band that can move while the sound plays (state-variable filter). */
  band(length, freqAt, q = 2) {
    const n = Math.round(length * RATE), out = new Float32Array(n)
    let low = 0, bandv = 0
    for (let i = 0; i < n; i++) {
      const f = 2 * Math.sin((Math.PI * Math.min(freqAt(i / RATE), 9000)) / RATE)
      const high = this.noise() - low - bandv / q
      bandv += f * high
      low += f * bandv
      out[i] = bandv
    }
    return out
  }

  // ---- the effects ----
  /** A letter or a row appears: a very short, dry tick. */
  tick(at, { level = -27, pan = 0, pitch = 2100 } = {}) {
    const nz = this.band(0.03, () => pitch * 1.6, 1.2)
    this.add(at, 0.03, level, pan, (t, i) => (Math.sin(2 * Math.PI * pitch * t) * 0.7 + nz[i] * 0.5) * Math.exp(-t / 0.006))
  }
  /** Something pops up: a short note that slides up, like a bubble. */
  pop(at, { level = -21, pan = 0, pitch = 620 } = {}) {
    let ph = 0
    this.add(at, 0.16, level, pan, (t) => {
      const f = pitch * (0.62 + 0.38 * Math.min(1, t / 0.035))
      ph += (2 * Math.PI * f) / RATE
      return Math.sin(ph) * Math.exp(-t / 0.04)
    })
  }
  /** A button is pressed: down and up, two small clicks with a little body. */
  click(at, { level = -20, pan = 0 } = {}) {
    for (const [dt, g, f] of [[0, 1, 2600], [0.085, 0.6, 3200]]) {
      const nz = this.band(0.02, () => f, 1.5)
      this.add(at + dt, 0.02, level + toDb(g), pan, (t, i) => nz[i] * Math.exp(-t / 0.0035))
    }
    this.add(at, 0.05, level - 4, pan, (t) => Math.sin(2 * Math.PI * 170 * t) * Math.exp(-t / 0.012))
  }
  /** A dot bounces off a letter: a soft, round "boing" - the note dips and comes back. */
  bounce(at, { level = -15, pan = 0, pitch = 440 } = {}) {
    let ph = 0
    this.add(at, 0.34, level, pan, (t) => {
      const f = pitch * (1 + 0.45 * Math.exp(-t / 0.018) - 0.05 * Math.exp(-t / 0.09))
      ph += (2 * Math.PI * f) / RATE
      return (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph)) * Math.exp(-t / 0.085) * Math.min(1, t / 0.002)
    })
    this.tick(at, { level: level - 12, pan, pitch: pitch * 4 })
  }
  /** A bell-like note that rings out (the dots land; a link is confirmed). */
  chime(at, { level = -15, pan = 0, pitch = 523.25, ring = 0.5 } = {}) {
    const parts = [[1, 1, 1], [2, 0.38, 0.6], [3.01, 0.16, 0.4], [4.2, 0.08, 0.25]]
    this.add(at, ring * 5, level, pan, (t) => {
      let s = 0
      for (const [mult, g, life] of parts) s += g * Math.sin(2 * Math.PI * pitch * mult * t) * Math.exp(-t / (ring * life))
      return s * Math.min(1, t / 0.003) * 0.62
    })
  }
  /** A scene changes or a card slides in: air moving past. */
  whoosh(at, { level = -25, length = 0.5, from = -0.5, to = 0.5, low = 350, high = 2600 } = {}) {
    const nz = this.band(length, (t) => low + (high - low) * Math.sin((Math.PI * t) / length) ** 2, 1.1)
    const n = nz.length
    // moves from one side to the other while it plays
    const i0 = Math.round(at * RATE), g = db(level)
    for (let i = 0; i < n && i0 + i < this.l.length; i++) {
      if (i0 + i < 0) continue
      const x = i / n, pan = from + (to - from) * x, env = Math.sin(Math.PI * x) ** 2
      this.l[i0 + i] += nz[i] * env * g * Math.cos(((pan + 1) * Math.PI) / 4)
      this.r[i0 + i] += nz[i] * env * g * Math.sin(((pan + 1) * Math.PI) / 4)
    }
  }
  /** A bar fills: a quiet note gliding up. */
  rise(at, { level = -28, length = 0.7, from = 330, to = 660, pan = 0 } = {}) {
    let ph = 0
    this.add(at, length, level, pan, (t) => {
      ph += (2 * Math.PI * (from + (to - from) * (t / length) ** 1.5)) / RATE
      return Math.sin(ph) * Math.sin((Math.PI * t) / length)
    })
  }
  /** Something is missing or wrong: two soft low notes going down. */
  low(at, { level = -19, pan = 0 } = {}) {
    this.chime(at, { level, pan, pitch: 293.66, ring: 0.16 })
    this.chime(at + 0.13, { level, pan, pitch: 220, ring: 0.22 })
  }
  /** The look of the window is switched (Light, Dark, Ember): a soft switch with a warm tail. */
  flip(at, { level = -18, pan = 0, pitch = 392 } = {}) {
    this.click(at, { level: level - 3, pan })
    this.chime(at + 0.01, { level: level - 5, pan, pitch, ring: 0.2 })
  }
}

// ---- the logo sting (times as in sting/src/build-sting.mjs: where each dot touches a letter) ----
const NOTE = { C4: 261.63, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5 }
function sting(track, t0, gain = 0) {
  track.whoosh(t0 + 0.02, { level: -24 + gain, length: 0.5, from: 0.9, to: 0.3, low: 500, high: 3000 }) // green flies in from the right
  track.whoosh(t0 + 0.3, { level: -24 + gain, length: 0.5, from: -0.9, to: -0.3, low: 400, high: 2400 }) // red from the left
  const green = [[0.5, 'G4', 0.5], [0.8, 'A4', 0.38], [1.1, 'C5', 0.22], [1.4, 'D5', 0.12]]
  const red = [[0.8, 'C4', -0.45], [1.25, 'E4', -0.3]]
  for (const [t, n, pan] of green) track.bounce(t0 + t, { level: -15 + gain, pan, pitch: NOTE[n] })
  for (const [t, n, pan] of red) track.bounce(t0 + t + 0.012, { level: -15 + gain, pan, pitch: NOTE[n] })
  // both dots land in their letters: two bell notes a fifth apart, a moment after each other
  track.bounce(t0 + 1.75, { level: -17 + gain, pan: -0.12, pitch: NOTE.G4 })
  track.chime(t0 + 1.75, { level: -14 + gain, pan: -0.12, pitch: NOTE.C5, ring: 0.5 })
  track.chime(t0 + 1.8, { level: -15 + gain, pan: 0.12, pitch: NOTE.G5, ring: 0.55 })
  // the two blinks near the end
  for (const t of [4.855, 5.205]) track.tick(t0 + t, { level: -27 + gain, pitch: 1500 })
}

// ---- the film ----
function film(track) {
  const every = (from, step, count, fn) => { for (let k = 0; k < count; k++) fn(from + k * step, k) }
  // A · the file is written line by line, the folder opens, the window comes in, the same words light up in both
  every(0.4, 0.25, 8, (t) => track.tick(t, { pan: -0.3 }))
  track.tick(2.4, { pan: -0.3 }); track.tick(2.75, { pan: -0.3 })
  track.whoosh(4.05, { length: 0.45, from: -0.2, to: 0.5 })
  every(4.5, 0.2, 2, (t) => track.tick(t, { pan: 0.35 }))
  every(4.9, 0.15, 4, (t) => track.tick(t, { pan: 0.35, pitch: 2400 }))
  track.whoosh(7.65, { length: 0.5, from: 0.6, to: 0 })
  every(8.9, 0.7, 3, (t, k) => track.pop(t, { pitch: [520, 620, 740][k] }))
  every(11.6, 0.15, 6, (t, k) => track.tick(t, { pan: 0.1, pitch: 1700 + k * 90, level: -25 }))
  // B · one change; two links turn suspect; one is kept
  track.whoosh(14.95, { length: 0.55 })
  every(15.2, 0.1, 4, (t, k) => track.tick(t, { pan: [-0.5, 0, 0.5, 0.5][k], level: -29 }))
  track.click(17.0, { level: -21 }); track.pop(17.3, { pitch: 700 })
  track.rise(18.2, { length: 0.5, from: 500, to: 300, level: -27 })
  track.low(18.7, { pan: 0.4 }); track.low(18.85, { pan: 0.45, level: -22 })
  track.click(21.0, { pan: 0.4 })
  track.chime(21.6, { pan: 0.4, pitch: NOTE.E5, ring: 0.18, level: -19 }); track.chime(21.7, { pan: 0.4, pitch: NOTE.G5, ring: 0.3, level: -19 })
  // C · Alice pushes, Bob pulls and pushes; the fields are combined
  track.whoosh(23.45, { length: 0.55 })
  track.pop(24.5, { pan: -0.6, pitch: 560 }); track.pop(24.8, { pan: 0.6, pitch: 660 })
  track.click(25.5, { pan: -0.6 }); track.whoosh(25.6, { length: 0.4, from: -0.5, to: 0, level: -27 }); track.pop(26.25, { pitch: 820, level: -23 })
  track.click(27.0, { pan: 0.6 }); track.whoosh(27.15, { length: 0.4, from: 0, to: 0.5, level: -27 }); track.pop(27.9, { pan: 0.6, pitch: 560 })
  track.chime(28.2, { pitch: NOTE.E5, ring: 0.18, level: -19 }); track.chime(28.3, { pitch: NOTE.G5, ring: 0.3, level: -19 })
  track.click(28.8, { pan: 0.6 }); track.whoosh(28.9, { length: 0.4, from: 0.5, to: 0, level: -27 }); track.pop(29.5, { pitch: 820, level: -23 })
  // D · coverage: two bars fill, one gap shows
  track.whoosh(30.45, { length: 0.55 })
  track.rise(31.0, { from: 330, to: 660 }); track.rise(31.4, { from: 330, to: 620 })
  track.low(32.5)
  // E · Light, Dark, Ember; five languages
  track.whoosh(34.75, { length: 0.55 })
  track.tick(34.9, { level: -24 })
  track.flip(35.6, { pitch: NOTE.E4 }); track.flip(37.0, { pitch: NOTE.G4 })
  every(39.0, 0.5, 4, (t, k) => track.pop(t, { pitch: 520 + k * 50, level: -24, pan: -0.3 + k * 0.15 }))
  track.pop(40.95, { pitch: 760, level: -22, pan: 0.3 }); track.whoosh(41.0, { length: 0.45, from: 0.5, to: -0.5, level: -27 }) // the window turns right to left
  // F · the end card: the sting, then the card turns Dark and Ember
  track.whoosh(42.15, { length: 0.5, level: -24 })
  sting(track, 42.4, 0)
  track.flip(45.0, { pitch: NOTE.E4, level: -20 }); track.flip(45.8, { pitch: NOTE.G4, level: -20 })
}

// ---- the spoken lines ----
function readSpeech(file) {
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(RATE), '-'], { maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${r.stderr}`)
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 2)
}
function voice(track) {
  const plan = JSON.parse(readFileSync(join(here, 'narration.json'), 'utf8'))
  let used = 0
  for (const line of plan.lines) {
    const file = ['flac', 'wav'].map((e) => join(here, 'narration', `${line.id}.${e}`)).find(existsSync)
    if (!file) { console.warn(`narration/${line.id} is missing - that line stays silent`); continue }
    const s = readSpeech(file)
    // every line equally loud: the loud parts (above -40 dB) are brought to -21 dB on average
    let sum = 0, count = 0
    for (const x of s) if (Math.abs(x) > 0.01) { sum += x * x; count++ }
    const g = db(-21) / Math.sqrt(sum / Math.max(1, count))
    const length = s.length / RATE
    if (line.at + length > line.until) console.warn(`line ${line.id} is ${(line.at + length - line.until).toFixed(2)} s too long for its place`)
    track.add(line.at, length, 0, 0, (t, i) => s[i] * g)
    used++
  }
  return used
}

// ---- levels and files ----
function stats(track, from = 0, to = Infinity) {
  let peak = 0, sum = 0, n = 0
  for (let i = Math.round(from * RATE); i < Math.min(track.l.length, to * RATE); i++) {
    peak = Math.max(peak, Math.abs(track.l[i]), Math.abs(track.r[i]))
    sum += track.l[i] ** 2 + track.r[i] ** 2
    n += 2
  }
  return { peak: toDb(peak), rms: toDb(Math.sqrt(sum / n)) }
}
function scale(track, g) {
  for (let i = 0; i < track.l.length; i++) { track.l[i] *= g; track.r[i] *= g }
}
function mix(a, b) {
  const out = new Track(a.l.length / RATE)
  for (let i = 0; i < out.l.length; i++) { out.l[i] = a.l[i] + b.l[i]; out.r[i] = a.r[i] + b.r[i] }
  return out
}
function writeWav(name, track) {
  const n = track.l.length, buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, track.l[i])) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, track.r[i])) * 32767), 46 + i * 4)
  }
  writeFileSync(join(here, 'audio', name), buf)
}
const PEAK = -3 // loudest moment of every file, in dB below full scale (the AAC in the MP4 adds a little on top)
const show = (name, s) => console.log(`${name.padEnd(34)} peak ${s.peak.toFixed(1).padStart(6)} dB   average ${s.rms.toFixed(1).padStart(6)} dB`)

mkdirSync(join(here, 'audio'), { recursive: true })
const effects = new Track(48), speech = new Track(48)
film(effects)
const lines = voice(speech)
const both = mix(effects, speech)
const g = db(PEAK - stats(both).peak)
for (const t of [effects, speech, both]) scale(t, g)
writeWav('film.wav', both); writeWav('film-effects.wav', effects); writeWav('film-voice.wav', speech)
console.log(`film: ${lines} spoken lines`)
show('film.wav (voice + effects)', stats(both))
show('  voice alone', stats(speech))
show('  effects alone', stats(effects))
show('  effects while the voice speaks', stats(effects, 0, 42.1))
show('  effects, end card (42.2-48 s)', stats(effects, 42.2, 48))

const alone = new Track(6)
sting(alone, 0, 0)
scale(alone, db(PEAK - stats(alone).peak))
writeWav('sting.wav', alone)
show('sting.wav', stats(alone))
