// يولّد التعليق الصوتي من src/Teaser/voiceover.json إلى public/voiceover/<id>.mp3
// المحركات بالترتيب: ElevenLabs (ELEVEN_KEY) ثم Azure (AZURE_TTS_KEY + AZURE_TTS_REGION).
// السطر اللي ما تغيّر نصه ما ينعاد توليده (يوفّر رصيد ElevenLabs). --force يعيد الكل.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const outDir = new URL("public/voiceover/", root);
const manifestUrl = new URL("manifest.json", outDir);
const script = JSON.parse(readFileSync(new URL("src/Teaser/voiceover.json", root), "utf8"));

const env = (k) => (process.env[k] || "").trim();
const ELEVEN_VOICE = env("ELEVEN_VOICE") || "2bnoa3wtrtcUW41TrSJM"; // Mohammed Almansari (صوت المذيع في الموقع)
const ELEVEN_MODEL = env("ELEVEN_MODEL") || "eleven_multilingual_v2";
const AZURE_VOICE = env("AZURE_TTS_VOICE") || "ar-SA-HamedNeural";
const FORCE = process.argv.includes("--force");

const engines = [];
if (env("ELEVEN_KEY")) engines.push({ name: `elevenlabs:${ELEVEN_VOICE}:${ELEVEN_MODEL}`, run: eleven });
if (env("AZURE_TTS_KEY") && env("AZURE_TTS_REGION")) engines.push({ name: `azure:${AZURE_VOICE}`, run: azure });

async function eleven(line, i, lines) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVEN_VOICE)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": env("ELEVEN_KEY"), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: line.text,
        model_id: ELEVEN_MODEL,
        language_code: "ar",
        // السياق يخلّي النبرة متصلة بين السطور
        previous_text: lines[i - 1]?.text,
        next_text: lines[i + 1]?.text,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 0.92 },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

const xmlEsc = (s) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

async function azure(line) {
  const text = xmlEsc(line.text).replace(/\.\./g, '<break time="350ms"/>');
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${AZURE_VOICE}"><prosody rate="-10%" pitch="-4%">${text}</prosody></voice></speak>`;
  const res = await fetch(`https://${env("AZURE_TTS_REGION")}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env("AZURE_TTS_KEY"),
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
      "User-Agent": "masro7-teaser",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

const duration = (file) =>
  Number(
    execFileSync("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      cwd: root,
    })
      .toString()
      .trim(),
  );

mkdirSync(outDir, { recursive: true });
const old = existsSync(manifestUrl) ? JSON.parse(readFileSync(manifestUrl, "utf8")) : {};
const manifest = {};
let generated = 0;
const failed = [];

const lines = script.lines;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const file = new URL(`${line.id}.mp3`, outDir);
  const prev = old[line.id];
  const hash = createHash("sha1").update(line.text).digest("hex").slice(0, 12);

  if (!FORCE && prev && existsSync(file) && prev.hash === hash) {
    manifest[line.id] = prev;
    continue;
  }
  if (!engines.length) {
    if (prev && existsSync(file)) manifest[line.id] = prev;
    console.warn(`تخطي ${line.id}: ما فيه مفتاح ElevenLabs ولا Azure`);
    continue;
  }

  let done = false;
  for (const engine of engines) {
    try {
      writeFileSync(file, await engine.run(line, i, lines));
      manifest[line.id] = { duration: duration(file.pathname), hash, engine: engine.name };
      console.log(`✓ ${line.id} (${engine.name}) ${manifest[line.id].duration.toFixed(2)}s`);
      generated++;
      done = true;
      break;
    } catch (e) {
      console.warn(`✗ ${line.id} عبر ${engine.name}: ${e.message}`);
    }
  }
  if (!done) {
    failed.push(line.id);
    if (prev && existsSync(file)) manifest[line.id] = prev; // نخلي النسخة القديمة لو فيه
  }
}

writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + "\n");
console.log(`${generated} سطر جديد، ${Object.keys(manifest).length}/${lines.length} جاهزة`);
if (failed.length) {
  console.error(`فشل: ${failed.join("، ")}`);
  process.exitCode = 1;
}
