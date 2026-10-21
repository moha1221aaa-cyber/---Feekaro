import voiceover from "./voiceover.json";

// أطوال المشاهد الأساسية (ث). المشهد يطول لحاله لو سطر التعليق فيه أطول
export const BASE_SECONDS = [4, 5, 6, 6, 5, 4];
export const T = 16; // طول الانتقال بالفريم

export type VoiceLine = { id: string; scene: number; at: number; text: string };
export type VoiceManifest = Record<
  string,
  { duration: number; hash: string; engine: string }
>;
export type VoiceCue = { id: string; from: number; durationInFrames: number };
export type Timeline = {
  sceneFrames: number[];
  starts: number[];
  voice: VoiceCue[];
};

export const VOICE_LINES: VoiceLine[] = voiceover.lines;

export const buildTimeline = (
  fps: number,
  manifest: VoiceManifest | null,
): Timeline => {
  const last = BASE_SECONDS.length - 1;
  const sceneFrames = BASE_SECONDS.map((s, i) => {
    const edge = i === 0 || i === last ? T / 2 : T;
    let frames = s * fps + edge;
    for (const l of VOICE_LINES) {
      const m = manifest?.[l.id];
      if (l.scene !== i || !m) continue;
      // الصوت يخلص قبل ما يبدأ الانتقال للمشهد اللي بعده، مع نفَس صغير
      const tail = i === last ? 0.9 * fps : 0.45 * fps + T;
      frames = Math.max(frames, Math.ceil((l.at + m.duration) * fps + tail));
    }
    return frames;
  });
  const starts = sceneFrames.map((_, i) =>
    sceneFrames.slice(0, i).reduce((a, f) => a + f - T, 0),
  );
  const voice = VOICE_LINES.filter((l) => manifest?.[l.id]).map((l) => ({
    id: l.id,
    from: starts[l.scene] + Math.round(l.at * fps),
    durationInFrames: Math.ceil(manifest![l.id].duration * fps) + 2,
  }));
  return { sceneFrames, starts, voice };
};

export const totalFrames = (t: Timeline) =>
  t.starts[t.starts.length - 1] + t.sceneFrames[t.sceneFrames.length - 1];
