# Enter-screen audio (ElevenLabs, 24.10.2026)

Generated with the ElevenLabs Sound Effects API (the Music API needs a paid plan). Prompts describe genre, mood,
instrumentation and tempo only: no artist names, no song titles. Pipeline: /workspace/shots/enter/amfx/audio/{gen,build,analyze}.py on the box.

| File | Source | Processing | Loudness |
| --- | --- | --- | --- |
| drop.{webm,m4a} | sfx v2, "a single slow drop of clear oil landing in a shallow glass dish..." | one plop, 0.324-0.624 s of the take, so the transient lands 2.9 ms in; peak-normalised (loudnorm is unreliable under 0.4 s) | peak -6.0 dBFS |
| enter.{webm,m4a} | sfx v2, "gentle airy cinematic swell... into a warm quiet room at night" | 0.35-1.35 s of the take, so its RMS peak lands 512 ms in (mid-way through the 1.1 s photo rise); peak-normalised | -22.4 LUFS, peak -6.4 dBFS |
| mark.{webm,m4a} | sfx take 2 of 3, "a highlighter pen drawing one smooth line across a page, soft tactile felt squeak and paper texture, very quiet, intimate close microphone, dry" (1.0 s, influence 0.6) | leading silence removed, first 0.72 s, 5 ms fade-in, 140 ms fade-out, 120 Hz high-pass; plays once per About mark on its first forward draw | -20.6 LUFS, peak -8.5 dBFS |
| jazz.{webm,m4a} | sfx v3 loop=true 30 s, slow 70 BPM lo-fi jazz: brushes, upright bass, Rhodes ninths, clean chorus guitar | 1.5 s equal-power tail-into-head crossfade (seamless by construction), 28.5 s | -18.0 LUFS, -1.9 dBTP |

The click also plays Cuelume's `tap` (synthesised, src/lib/sound.ts): Cuelume owns the button's UI cue, these files own the scene.

Opus 48 kbps (webm) with AAC 64 kbps (m4a) fallback. The API key is never in this repo.
