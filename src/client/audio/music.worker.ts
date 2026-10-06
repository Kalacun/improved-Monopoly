import { MusicRNN } from "@magenta/music/esm/music_rnn/model";
import * as tf from "@tensorflow/tfjs";
import { MOODS, primer, sanitizeNotes, type Mood } from "./music";

let model: MusicRNN;
let busy = false;
self.onmessage = async (
  event: MessageEvent<{
    type: string;
    mood: Mood;
    id: number;
    modelUrl?: string;
  }>,
) => {
  const { type, mood, id, modelUrl } = event.data;
  if (busy) return;
  busy = true;
  try {
    if (type === "init") {
      await tf.setBackend("cpu");
      await tf.ready();
      model = new MusicRNN(modelUrl!);
      await model.initialize();
      self.postMessage({ type: "ready" });
    } else if (type === "compose" && MOODS[mood] && model) {
      const started = performance.now(),
        score = MOODS[mood];
      const sequence = await model.continueSequence(
        primer(mood),
        64,
        score.temperature,
        [score.chords[0], ...score.chords],
      );
      const notes = sanitizeNotes(sequence.notes || []);
      if (!notes.length) throw new Error("Empty musical phrase");
      self.postMessage({
        type: "phrase",
        id,
        mood,
        notes,
        duration: Math.round(performance.now() - started),
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Music generation failed",
    });
  } finally {
    busy = false;
  }
};
