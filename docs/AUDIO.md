# Sound and adaptive music

Desktop/TV audio is on by default and starts at the first click or keypress, as required by browser autoplay policies. Explicit mute choices are remembered across reloads. Phone controllers remain quiet by default to avoid several soundtracks around one TV. Use **♫ Sound** to enable a phone or change volumes, effects, music and AI melody settings. Keeping only the TV computer audible is recommended for family mode.

## What you hear

| Event                               | Sound                                                                  | Why it fits                                                    |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| A figure reaches each space         | Alternating light wood taps plus a tiny pluck                          | A tactile tabletop hop, timed to the actual 3D animation       |
| Dice roll                           | One of two real dice throws                                            | Recognizable without looking at the board                      |
| Property purchase / option exercise | Coin handling and a small rising chime                                 | A distinct, satisfying acquisition cue                         |
| Rent and other payments             | A quieter, shorter coin sound                                          | Money changes hands without drowning out conversation          |
| Accepted deal                       | Cloth rustle, soft hand-like contact, and a very quiet resolving chime | Celebrates agreement; offers use a separate quiet notification |
| Chance / Community Chest            | Card slide                                                             | Suggests a physical card being drawn                           |
| Auction bid / winning bid           | Chip click / wooden gavel-like tap and coins                           | Separates incremental bidding from a completed sale            |
| Construction                        | Two wooden taps                                                        | Suggests setting houses on the board                           |
| Passing GO                          | Four-note rising chime                                                 | Makes income and progress easy to notice                       |
| New turn                            | A quiet two-note cue                                                   | Helps players notice the handover                              |
| Jail                                | Brief metal impact                                                     | A recognizable change without a loud alarm                     |
| Payment shortfall / bankruptcy      | Restrained falling tones                                               | Communicates trouble without mocking the player                |
| Winner                              | Short major-key flourish                                               | Gives the session a clear musical ending                       |

**Try the sounds** previews effects without moving figures or changing balances. Mood previews last 25 seconds; **Follow the game** ends a preview immediately, with the musical change at the next bar.

The handshake is a designed combination of cloth and soft impact recordings, not a recording of an actual handshake. It is wordless. The closing chime is reduced to 15% of its original gain (about 16.5 dB quieter), and the contact sound is softer too.

## Architecture

```text
Authoritative WebSocket snapshots + new public journal entries
       ├── CueTracker ──> short effects / animated figure taps
       └── MusicDirector ──> mood + chords + tempo + density
                                  │
                      Worker: Magenta MusicRNN
                      local CPU inference, 64 steps
                                  │
                    one buffered four-bar melody
                                  │
                     Web Audio bar scheduler
                    pads + bass + soft lead / pulse
                                  │
                     effects ducking + compressor
                                  │
                         TV / chosen speaker
```

### 1. An explainable director reads the game

The director is deterministic game logic, **not a language model** pretending to understand negotiations. It observes public balances, positions, debt phase, inflation, loan due dates, auction phase, and recent signed-deal logs. It never reads the hidden future dice/card sequence. Player names and free-form deal notes are not interpreted as instructions.

Priority, from highest to lowest:

- **Celebration:** the game is over.
- **Debt crisis:** a player is currently unable to settle a payment.
- **Under pressure:** an active player has less than $80 in base-year cash; a loan due within a lap exceeds 70% of the borrower's cash; or at least 20% of normal dice outcomes would land the current player on rent exceeding 65% of their cash.
- **Making deals:** an auction is active, or one of the five most recent public journal entries is a signed deal.
- **Relaxed:** none of those conditions applies, including the lobby.

These are dramatic cues, not a bankruptcy predictor or strategic advice. They deliberately measure liquid cash rather than treating a rich property portfolio as spendable money. The UI explains the current reason. Urgency increases immediately, but reductions wait at least 12 seconds after the last mood change. The audible transition occurs at the next bar, usually within 2–3.2 seconds, with overlapping release tails.

### 2. A real neural model composes the melody

This uses **Magenta MusicRNN, `chord_pitches_improv`**, a pretrained LSTM model conditioned on harmony. The approximately **5.6 MB** checkpoint is served by the game itself. The worker receives only a mood ID, a musical primer, and chord choices; it receives no player data or journal text. It generates a new four-bar melody (64 sixteenth-note steps) with restrained sampling temperatures (0.75–0.95).

The director chooses major/seventh harmonies for calm and trading; minor harmonies and repeated bass pulses for tension; and an E7 dominant for crisis resolution. Tempo ranges from 76 to 100 BPM. A Web Audio arrangement supplies soft pads, bass, and a rounded lead. The melody is AI-generated; accompaniment, instrumentation, effects, and mood selection are authored code. This is a synthesized adaptive score, not studio-quality raw audio generation or an AI orchestra.

The small note-generating model gives direct control over harmony and phrase timing. It can compose on this Mac in roughly half a second while the board stays on the main thread. A larger text-to-audio pipeline would add installation/service costs and make precise bar transitions and interruption harder; it is unnecessary for this version.

### 3. Playback stays independent of inference

- Inference runs in a **Web Worker on CPU**; it does not block the board or compete for its WebGL context.
- One future phrase is buffered. A response for an obsolete mood is discarded.
- Notes are scheduled against the AudioContext clock, with gentle envelopes and separate effect/music gains.
- Prominent effects briefly lower the music; a compressor limits combined peaks.
- Joining a table and reconnecting establish a journal baseline. Old sounds are never replayed. Duplicate updates and simultaneous payment logs are coalesced.
- Figure taps come from animation arrivals, not duplicated journal messages.
- Muting or hiding the tab stops scheduled sounds, so resuming does not replay stale effects.
- Missing/slow AI initialization (30 seconds) or composition (25 seconds) terminates the worker. A clearly labeled procedural ambient arrangement continues, and the user can retry or turn AI off.
- The first melody may wait for the next four-bar boundary. During preparation, the panel explicitly identifies the ambient arrangement.

The model and sample files are served locally, including over Cloudflare. There are no runtime calls to Google, Magenta, a music API, or a speech service. Cloudflare still carries ordinary game traffic when it is your chosen connection method.

## Sources and licenses

Effects are selected from Kenney's **CC0** [Casino Audio](https://kenney.nl/assets/casino-audio), [Impact Sounds](https://kenney.nl/assets/impact-sounds), and [RPG Audio](https://kenney.nl/assets/rpg-audio). The pack license files are kept in `public/audio/`. The selected recordings were converted from Ogg to 24 kHz mono PCM WAV for Safari/iOS compatibility. `public/audio/manifest.json` records original filenames and SHA-256 hashes. Musical chimes are synthesized by this project.

Magenta references: [MusicRNN API](https://magenta.github.io/magenta-js/music/classes/_music_rnn_model_.musicrnn.html), [official checkpoint catalog](https://github.com/magenta/magenta-js/blob/master/music/checkpoints/README.md), and [Apache-2.0 project license](https://github.com/magenta/magenta-js/blob/master/LICENSE). `public/music-model/SOURCE.json` records the official checkpoint URL and file hashes; `MAGENTA-LICENSE.txt` preserves the software license.

`@magenta/music` is pinned to 1.23.1 and its TensorFlow runtime to 2.8.6. Selective imports avoid loading its players and recording UI. Vite redirects its browser compatibility module to the provided worker-compatible implementation. Dependency overrides update legacy protobuf/static-eval/quote-stream/minimist dependencies; the installed tree passes `npm audit` with zero reported vulnerabilities. This does not imply indefinite upstream maintenance; recheck the dependency tree when updating it.

## Troubleshooting

- **No audio:** click Enable sound, check browser/OS/TV mute and the output device, and keep the tab visible. Re-enable sound after an OS audio interruption.
- **Only backing music:** expand How the soundtrack works. It shows the number of generated phrases and inference time. Wait for the next phrase boundary; retry the model if it failed.
- **Older phone struggles:** leave its audio off, or disable AI-composed melodies. The normal game controller remains independent of music.
- **Two soundtracks:** mute all devices except the computer connected to the TV. Same-origin tabs coordinate automatically; different origins/devices do not.
- **Cast picture but no sound:** choose the TV as the computer's audio output, or enable audio sharing in the casting software. Device-specific AirPlay/Cast routing is outside the game.

The automated and browser checks are recorded in [VERIFICATION.md](VERIFICATION.md). Physical phone/TV audio routing and subjective mixing still need a listen on your family's equipment.
