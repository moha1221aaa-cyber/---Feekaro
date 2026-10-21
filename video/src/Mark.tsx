/* الشعار بحلقة ذهبية + عنوان وسطر تحته، يدخلون بالترتيب (transform و opacity بس) */
import type React from "react";
import { Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EXPO, fontFamily } from "./theme";

const MarkInner: React.FC<{ readonly title: string; readonly sub: string; readonly outSeconds: number }> = ({ title, sub, outSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = (delay: number) => {
    const t = interpolate(frame - delay * fps, [0, 0.7 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(...EXPO) });
    const out = interpolate(frame, [outSeconds * fps, (outSeconds + 0.35) * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return { opacity: t * out, transform: `translateY(${(1 - t) * 40}px) scale(${0.94 + t * 0.06})` };
  };
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 36, direction: "rtl", fontFamily }}>
      <Img src={staticFile("logo.png")} style={{ width: 320, height: 320, borderRadius: "50%", border: `10px solid ${C.gold}`, ...rise(0) }} />
      <div style={{ color: "#fff", fontSize: 112, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, textAlign: "center", ...rise(0.15) }}>{title}</div>
      <div style={{ color: C.gold2, fontSize: 52, fontWeight: 700, textAlign: "center", ...rise(0.3) }}>{sub}</div>
    </div>
  );
};

export const Mark = Interactive.create({
  Component: MarkInner,
  layout: "absolute-fill",
  schema: {
    title: { type: "string", default: "", description: "العنوان" },
    sub: { type: "string", default: "", description: "السطر الثاني" },
    outSeconds: { type: "number", default: 2, description: "متى يطلع (ثواني)", hiddenFromList: false },
  },
});
