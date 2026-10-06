import type { GameAudio, AudioSettings } from "./engine";
import type { Cue } from "./director";
import { MOODS, type Mood } from "./music";

export function installAudioUI(
  audio: GameAudio,
  openDialog: (html: string) => void,
) {
  const toggle = (key: keyof AudioSettings, label: string, help: string) =>
    `<label class="rule-check"><input type="checkbox" role="switch" data-audio-setting="${key}" ${audio.settings[key] ? "checked" : ""}><span><b>${label}</b><small>${help}</small></span></label>`;
  function open() {
    openDialog(`<div class="sound-panel"><span class="eyebrow">THE SOUND OF THE TABLE</span><h2>Sound & music</h2>
      <p>Music starts on your first click or keypress on a computer or TV display. Phones start quiet. Your mute preference is remembered on this device.</p>
      <button class="primary full" data-audio="power"></button><p class="audio-status" id="audio-status" role="status"></p>
      <div class="audio-now"><span class="eyebrow">CURRENT SOUNDTRACK</span><h3 id="audio-mood"></h3><p id="audio-reason"></p><small id="audio-model"></small></div>
      ${toggle("effects", "Tabletop effects", "Coins, dice, cards, figures, construction, and auctions.")}
      <label class="audio-volume"><span>Effects volume</span><input aria-label="Effects volume" type="range" min="0" max="100" value="${Math.round(audio.settings.effectsVolume * 100)}" data-audio-volume="effectsVolume"></label>
      ${toggle("music", "Adaptive music", "Relaxed when the table is healthy; more urgent when cash or debt becomes a problem.")}
      <label class="audio-volume"><span>Music volume</span><input aria-label="Music volume" type="range" min="0" max="100" value="${Math.round(audio.settings.musicVolume * 100)}" data-audio-volume="musicVolume"></label>
      ${toggle("ai", "AI-composed melodies", "Magenta composes locally in the background. A light ambient arrangement fills any gaps.")}
      <button class="text-button" data-audio="retry" id="audio-retry" hidden>Retry music model</button>
      <details class="audio-preview"><summary>Try the sounds</summary><p>Previews affect only what you hear. They do not change the game.</p>
        <div class="audio-buttons">${(
          [
            ["step", "Figure hop"],
            ["dice", "Dice"],
            ["purchase", "Coin drop"],
            ["deal", "Handshake & deal"],
            ["card", "Draw a card"],
            ["sold", "Auction sold"],
            ["build", "Construction"],
            ["go", "Pass Launch"],
            ["debt", "Payment warning"],
            ["victory", "Victory"],
          ] as [Cue, string][]
        )
          .map(
            ([cue, label]) =>
              `<button data-audio-cue="${cue}">${label}</button>`,
          )
          .join("")}</div>
        <h4>Preview a music mood</h4><p>Each preview lasts 25 seconds. Music changes at a bar boundary.</p><div class="audio-buttons">${Object.entries(
          MOODS,
        )
          .map(
            ([mood, score]) =>
              `<button data-audio-mood="${mood}">${score.label}</button>`,
          )
          .join("")}<button data-audio="live">Follow the game</button></div>
      </details>
      <details class="audio-preview"><summary>How the soundtrack works</summary><p>Public game state and recent events guide the mood: cash reserves, unpaid bills, nearby rent, loans, auctions, and signed deals. No chat or player names are sent to an AI service.</p><p>Magenta MusicRNN generates new four-bar melodies. Soft synthesized instruments provide the backing. Rising tension adds a minor-key pulse; recovery gives the music time to relax.</p><small id="audio-diagnostics"></small><p>Sound effects: Kenney (CC0). Music model: Magenta chord_pitches_improv. No account or subscription needed.</p></details></div>`);
    update();
  }
  function update() {
    const text = (id: string, value: string) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== value) el.textContent = value;
    };
    const power = document.querySelector<HTMLButtonElement>(
      "[data-audio='power']",
    );
    if (power) {
      power.textContent = audio.enabled
        ? "Mute this device"
        : "Enable sound on this device";
      power.setAttribute("aria-pressed", String(audio.enabled));
    }
    const header =
      document.querySelector<HTMLButtonElement>("[data-ui='sound']");
    if (header) {
      header.classList.toggle("sound-active", audio.enabled);
      header.setAttribute(
        "aria-label",
        audio.enabled
          ? "Sound settings · sound enabled"
          : "Sound settings · muted",
      );
    }
    text(
      "audio-status",
      audio.audioError
        ? "Audio could not start. Try enabling it again."
        : !audio.enabled
          ? audio.waitingForGesture
            ? "Click or press a key to start the default soundtrack, or use Enable sound."
            : "Sound is off. Click Enable sound to begin."
          : audio.contextState !== "running"
            ? "Audio is paused. Keep this tab visible, or mute and enable sound again."
            : "Sound is enabled on this device.",
    );
    text("audio-mood", MOODS[audio.currentMood].label);
    text(
      "audio-reason",
      audio.previewing
        ? "Previewing a mood. The live game is unchanged."
        : audio.director.current.reason,
    );
    text(
      "audio-model",
      !audio.enabled || !audio.settings.music
        ? "Music is off."
        : audio.modelStatus === "loading"
          ? "Loading the local AI model · ambient music is playing."
          : audio.modelStatus === "failed"
            ? "AI unavailable · ambient music continues. You can retry below."
            : audio.playingAI
              ? "AI melody playing · composed on this device."
              : audio.modelStatus === "ready"
                ? "AI is composing · ambient music fills the gap."
                : "Ambient arrangement playing · AI is off.",
    );
    text(
      "audio-diagnostics",
      `Generated phrases: ${audio.generated} · Last generation: ${audio.generationMs} ms · Loaded sounds: ${audio.samplesLoaded}/12`,
    );
    const retry = document.getElementById("audio-retry");
    if (retry) retry.hidden = audio.modelStatus !== "failed";
    document
      .querySelectorAll<HTMLButtonElement>(
        "[data-audio-mood],[data-audio-cue],[data-audio='live']",
      )
      .forEach((b) => (b.disabled = !audio.enabled));
    document
      .querySelectorAll<HTMLButtonElement>("[data-audio-mood]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(audio.previewing && audio.currentMood === b.dataset.audioMood),
        ),
      );
  }
  document.addEventListener("click", async (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-audio],[data-audio-cue],[data-audio-mood],[data-ui='sound']",
    );
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.dataset.ui === "sound") open();
    else if (el.dataset.audio === "power") {
      if (audio.enabled) audio.disable();
      else await audio.enable();
    } else if (el.dataset.audio === "retry") audio.retryModel();
    else if (el.dataset.audio === "live") audio.endPreview();
    else if (el.dataset.audioCue) audio.cue(el.dataset.audioCue as Cue, true);
    else if (el.dataset.audioMood)
      audio.previewMood(el.dataset.audioMood as Mood);
    update();
  });
  document.addEventListener("change", (event) => {
    const el = event.target as HTMLInputElement,
      key = el.dataset.audioSetting as "effects" | "music" | "ai" | undefined;
    if (key) audio.set(key, el.checked);
  });
  document.addEventListener("input", (event) => {
    const el = event.target as HTMLInputElement,
      key = el.dataset.audioVolume as
        "effectsVolume" | "musicVolume" | undefined;
    if (key) audio.set(key, Math.max(0, Math.min(100, Number(el.value))) / 100);
  });
  audio.addEventListener("change", update);
}
