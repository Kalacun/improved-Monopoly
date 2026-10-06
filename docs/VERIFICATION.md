# Verification record

Verified on the development Mac on 22 September 2026.

- `npm run build`: TypeScript and production bundle pass.
- `npm test`: 77 scenarios pass, including complete seeded Classic and Economy bot matches.
- `npm run test:network`: three independent WebSocket clients perform 90 synchronized actions against an isolated real server. Checks cover host-only start, seat/turn authorization, concealed future random state, model sharing, rejected cross-seat upload, and rejoining the same saved seats after a server restart. Saves use a hidden `.data` folder, matching normal operation.
- Browser interaction: table setup, human/AI seat selection, starting, rolling, planning a move, buying a title, proposing a 20% royalty sale, switching to the recipient, accepting, and checking the resulting cash balances.
- Browser model import: the provided ASCII STL, OBJ, GLB, and embedded glTF samples all load successfully. The STL file survives a restart and rejoin. Production uploads are served from the default hidden save directory.
- Visual checks: desktop 1440×1000, narrow 390×844, normal browser panel; orbital and overhead cameras, board fit, contract editor, and piece placement.
- `npm audit` after dependency updates: no reported vulnerabilities.

Scope of evidence: multiplayer tests run several clients on this Mac. A second physical computer, all browser/GPU combinations, unusually large third-party models, compressed glTF extensions, and long human negotiation sessions were not tested. The server exposes standard HTTP/WebSocket connections on every interface, and the hosting guide explains local Wi-Fi and Cloudflare access. Balance parameters are configurable and need real playtesting.

## Name, credit, and rule controls update

- Rules tests cover credits on personal laps 2/4/6, the cap of 3, disabled accrual, no catch-up refills, individual contract switches, legacy-rule migration, unsigned-offer cancellation, and honoring existing options/loans after disabling issuance.
- The network test also verifies authorized in-game renaming, rejected cross-seat/blank renames, host-only rule changes, and persistence of names and individual switches after restart.
- Live browser verification: created a separate pass-and-play test table, disabled royalties in the lobby, started the game, renamed Robin to Robin Investor, and verified the heading, player selector, and journal updated. Disabled vetoes and options during play and confirmed the deal editor disables the corresponding inputs. Inspected the recommendations page, checklist layout, and credit balance/refill guidance.

## Cloudflare and TV + phones update

- Production build and all 77 game/camera tests pass. The three-client network suite still completes 90 synchronized actions and verifies persistence after restart.
- `npm run test:party` verifies seatless hosting, invitation keys, host-only start, read-only display permissions, phone deals, recovery codes, synchronized turns, and heartbeats against an isolated server.
- The same party suite passed through an actual Cloudflare Quick Tunnel using HTTPS/WSS. No account, domain, VPN, or router configuration was required.
- Browser verification used a TV host and two phone-controller browser sessions: QR invitation, joining, lobby readiness, start, roll, movement decisions, buying a title, sending a $25 deal, and accepting it on the other phone session (cash updated to $1,525). Phone mode renders no WebGL canvas; the TV renders exactly one.
- Launcher verification: a second launch is rejected without changing the active tunnel; graceful shutdown stops its server and connector and releases the launch lock.
- Physical phones, a physical TV/casting receiver, and a permanent Cloudflare account/domain configuration were not tested. These require the user's devices and account.

## Rule toggles, follow camera, tuning, and Slovene

- Production build and 84 automated tests pass. New scenarios cover starting with one credit, refills only on laps 5/10/15, configurable caps, legacy defaults, invalid number bounds, preserved balances, custom grants/taxes, camera corner mapping, figure visibility, and Slovene terminology/messages/parameter integrity.
- Multiplayer suite passes 90 synchronized actions and saves/reloads the five-lap refill setting and custom cap. TV/phone party suite passes all existing authorization, recovery, deal, and synchronization checks.
- Browser checks used a separate isolated save directory: Slovene setup, native accessible switches rendered as sliding toggles, disabling rent shares, expanding number tuning, saving 1 starting point / 5 laps, and starting with those values. The tuning section remains open while settings synchronize.
- Visually checked tracking along the south edge, rotation to the west edge after the jail corner, and turn changes. Verified manual overhead view pauses following and Follow turn resumes it. Switching English → Slovene rejoins the same player with the same balance and position. Generic board labels and the current-turn journal display in Slovene; proper street and player names remain unchanged.
- Language checks preserve invitation URLs and custom deal notes. The translation catalog and terminology decisions are documented in `docs/SLOVENE.md`. No professional native-speaker editorial certification is claimed. Physical TV and phone hardware were not newly tested in this update.

## Sound effects and adaptive AI music — 26 September 2026

- Production build passes; 103 automated tests pass. Audio coverage includes log deduplication, reconnect/restore baselines, signed-versus-proposed deals, actual-animation movement cues, inflation-adjusted low cash, nearby rent exposure, loan maturity, debt/victory priority, mood recovery delay, bounded model notes, and bundled asset integrity.
- Lifecycle tests verify no samples/model load before a gesture, continued ambient playback after a worker failure, explicit retry, timeout termination, independent AI/music switches, and cancellation of scheduled sounds on mute or page hiding.
- Production-browser checks used port 4320 and an isolated temporary save directory. The real Magenta worker loaded the bundled checkpoint, generated new phrases in approximately 430–490 ms on this Mac, and reached AI playback for relaxed and crisis moods. All 12 PCM sound files decoded successfully; no browser warning/error was reported in these checks.
- Exercised purchase and deal previews, AI-to-ambient switching, mute, reload into silence, and English/Slovene controls. The browser reports installed local voices for both languages. Voice quality was not independently recorded or assessed.
- Phone mode starts muted. Checked the Slovene sound panel at an actual 390×844 viewport: no horizontal page overflow, readable descriptions, and accessible switches/sliders. Sound settings are separate for phone and TV profiles.
- `npm audit` reports zero vulnerabilities after patching Magenta's older transitive dependencies with scoped package overrides. Checkpoint hashes and sample provenance are recorded with the bundled files.
- No server protocol or game-rule changes were needed. The user's running port-3000 server and saved tables were not stopped, modified, or used as test fixtures. Existing multiplayer suites were not rerun for this client-only audio change.
- Scope: browser playback/decoding/inference and simulated audio lifecycle checks on this Mac. Physical phone speakers, TV/AirPlay/Cast audio routing, a human listening/mixing session, and other operating systems were not tested. The selected model produces note sequences rendered by soft synthesized instruments; this is not studio-quality raw audio generation. See `docs/AUDIO.md` for the explicit procedural fallback and voice-availability behavior.

## Wordless deals and readable cards — 26 September 2026

- Removed speech synthesis and its UI toggle; old saved voice preferences are ignored. Deal chime gain is 0.012 instead of 0.08 (about −16.5 dB); the soft contact sample is also reduced.
- 109 tests and the production build pass. Card tests cover chained draws, retained history after end-turn/save restore, reconnect deduplication, old-save journal fallback, history limits, draw-time inflation, escaped names, and translation of all 32 cards.
- Multiplayer tests pass 90 synchronized actions; the party suite passes 20 synchronized actions and its existing TV/phone authorization and recovery checks.
- Browser checks against an isolated fixture: a phone moves onto Market News, reads the back-three card as 1/2, reads the resulting bank-error Civic Fund card as 2/2, continues, ends the turn, and reopens both cards from history. The read-only TV displays the latest card prominently. Verified the Slovene reader at 390×844. The user's saved tables were not used as fixtures.
- Deck descriptions follow classic pre-2021 US effects, with concise wording rather than a claim of verbatim text from every edition; source references and behavior are in `docs/CARDS.md`.

September 27 board update: owner-colored pastel tile backgrounds follow authoritative deed ownership (including railroads/utilities and transfers); original group bands remain. Home camera is closer and framing is checked at four aspect ratios. Current card faces expire on turn-number change while history remains. Slovenian names cover every purchasable space and card destination. Build, unit, network and party checks pass; browser checked with a disposable two-owner fixture, separate DATA_DIR, at phone and desktop widths.

## October 5 public-release preparation

The current design restores the square 40-space board and classic US property names at the user's request. Its visual board art, title, figures and card stories remain original to Estate Exchange. Slovene interface mode preserves the English US place names. Desktop/TV audio starts at the first pointer/key interaction, respects saved mute preferences and keeps phone controllers quiet.

The prior build, multiplayer and platform-package results above refer to the earlier circular board. No GitHub repository, upload or public release has been created automatically.

All five distribution ZIPs and their SHA-256 files were generated locally (Apple silicon Mac, Intel Mac, Windows x64, Linux x64 and ARM64). ZIP inspection found no private hosting folders/keys or node_modules. The bundled Mac launcher also starts its bundled Cloudflare connector and publishes a reachable HTTPS tunnel; the 20-action party suite passes through that real tunnel. Native Windows/Linux/Intel execution remains untested here.

## October 6 board and card restoration

Restored the square board and classic US place names, then restored the standard 16 Chance and traditional 16 Community Chest effects with concise original wording. Card indices and effect handling remain stable for saved tables. Rebranded the visible decks from Market News/Civic Fund to Chance/Community Chest. Added the distinction between the traditional pre-2021 US Community Chest deck and newer editions to `docs/CARDS.md`.

TypeScript and the production client build pass. A disposable TV-mode table visibly confirmed the square board and classic labels. The automated test suite was not rerun during this restoration. Local platform ZIPs were repackaged from this build; native platform launch checks were not repeated.
