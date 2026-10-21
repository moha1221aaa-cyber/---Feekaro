/* أشرطة ألوان الدوري تمسح الإطار (نفس الفاصل في tv.js): تدخل من اليمين، تثبت، وتطلع يسار */
import type React from "react";
import { Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, IO } from "./theme";

const BandsInner: React.FC<{ readonly holdSeconds: number }> = ({ holdSeconds }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const inEnd = 0.45 * fps, outStart = inEnd + holdSeconds * fps, outEnd = outStart + 0.45 * fps;
  const x = (delay: number) => interpolate(frame - delay, [0, inEnd, outStart, outEnd], [width, 0, 0, -width], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(...IO),
  });
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: C.blue, transform: `translateX(${x(0)}px)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: "38%", height: 18, background: C.gold, transform: `translateX(${x(2)}px)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "30%", background: C.deep, transform: `translateX(${x(4)}px)` }} />
    </>
  );
};

export const Bands = Interactive.create({
  Component: BandsInner,
  layout: "absolute-fill",
  schema: { holdSeconds: { type: "number", default: 1, description: "مدة الثبات (ثواني)", hiddenFromList: false } },
});
