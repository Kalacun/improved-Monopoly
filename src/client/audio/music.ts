export type Mood = "calm" | "trade" | "tense" | "crisis" | "victory";
export type Note = { pitch: number; start: number; end: number };
export type Phrase = { mood: Mood; notes: Note[] };
export const MOODS: Record<
  Mood,
  {
    label: string;
    bpm: number;
    chords: string[];
    voicings: number[][];
    temperature: number;
    density: number;
  }
> = {
  calm: {
    label: "Relaxed",
    bpm: 76,
    chords: ["Cmaj7", "Am7", "Fmaj7", "G6"],
    voicings: [
      [48, 55, 59, 64],
      [45, 55, 60, 64],
      [41, 53, 57, 64],
      [43, 55, 59, 64],
    ],
    temperature: 0.75,
    density: 0.45,
  },
  trade: {
    label: "Making deals",
    bpm: 88,
    chords: ["C6", "Dm7", "G7", "Cmaj7"],
    voicings: [
      [48, 55, 57, 64],
      [50, 57, 60, 65],
      [43, 55, 59, 65],
      [48, 55, 59, 64],
    ],
    temperature: 0.9,
    density: 0.7,
  },
  tense: {
    label: "Under pressure",
    bpm: 88,
    chords: ["Am", "Dm", "Em", "Am"],
    voicings: [
      [45, 52, 57, 60],
      [50, 57, 62, 65],
      [40, 52, 55, 59],
      [45, 52, 57, 60],
    ],
    temperature: 0.85,
    density: 0.65,
  },
  crisis: {
    label: "Debt crisis",
    bpm: 100,
    chords: ["Am", "Dm", "E7", "Am"],
    voicings: [
      [45, 52, 57, 60],
      [50, 57, 62, 65],
      [40, 52, 56, 62],
      [45, 52, 57, 60],
    ],
    temperature: 0.95,
    density: 0.85,
  },
  victory: {
    label: "Celebration",
    bpm: 88,
    chords: ["C", "F", "G", "C"],
    voicings: [
      [48, 55, 60, 64],
      [41, 53, 57, 60],
      [43, 55, 59, 62],
      [48, 55, 60, 64],
    ],
    temperature: 0.85,
    density: 0.75,
  },
};

// The model only receives this musical brief, never player names or deal text.
export function primer(mood: Mood) {
  const pitches = MOODS[mood].voicings[0];
  return {
    quantizationInfo: { stepsPerQuarter: 4 },
    totalQuantizedSteps: 16,
    notes: [0, 1, 2, 3].map((i) => ({
      pitch: pitches[i] + 12,
      quantizedStartStep: i * 4,
      quantizedEndStep: i * 4 + 3,
    })),
  };
}

export function sanitizeNotes(
  notes: {
    pitch?: number | null;
    quantizedStartStep?: number | null;
    quantizedEndStep?: number | null;
  }[],
): Note[] {
  return notes
    .filter(
      (n) =>
        Number.isFinite(n.pitch) &&
        Number.isFinite(n.quantizedStartStep) &&
        Number.isFinite(n.quantizedEndStep),
    )
    .map((n) => ({
      pitch: Math.max(48, Math.min(83, Math.round(n.pitch!))),
      start: Math.max(0, Math.round(n.quantizedStartStep!)),
      end: Math.min(64, Math.round(n.quantizedEndStep!)),
    }))
    .filter((n) => n.end > n.start && n.start < 64)
    .sort((a, b) => a.start - b.start)
    .slice(0, 128);
}

export function ambientPhrase(mood: Mood): Phrase {
  return {
    mood,
    notes: MOODS[mood].voicings.flatMap((chord, bar) =>
      [0, 6, 12].map((step, i) => ({
        pitch: chord[(i + bar) % 4] + 12,
        start: bar * 16 + step,
        end: bar * 16 + step + 3,
      })),
    ),
  };
}
