import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CLAMP,
  COLORS,
  GoldDust,
  RoyalBackground,
  Vignette,
  goldText,
  reem,
  tajawal,
} from "../theme";
import { Bell, Books, Question, Stopwatch } from "./Icons";

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const center: React.CSSProperties = {
  justifyContent: "center",
  alignItems: "center",
  direction: "rtl",
};

/* 1 — شاشة سودا، جزيئات ذهبية تتجمع وضوء يكوّن النص */
const IgnitionInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gather = interpolate(frame, [0.3 * fps, 2.8 * fps], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.55, 0, 0.2, 1),
  });
  const core = interpolate(
    frame,
    [1.5 * fps, 2.9 * fps, 3.2 * fps],
    [0, 1, 0.35],
    CLAMP,
  );
  const textIn = interpolate(frame, [2.7 * fps, 3.3 * fps], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ background: "#000", ...center }}>
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [1 * fps, 4 * fps], [0, 0.8], CLAMP),
          background: `radial-gradient(circle at 50% 50%, rgba(14,42,122,0.8), transparent 60%)`,
        }}
      />
      {new Array(110).fill(0).map((_, i) => {
        const a = random(`a${i}`) * Math.PI * 2;
        const d = 500 + random(`d${i}`) * 900;
        const delay = random(`t${i}`) * 0.35;
        const g = Math.min(1, Math.max(0, (gather - delay) / (1 - delay)));
        const r = d * (1 - g);
        const swirl = a + g * 1.6;
        const size = 3 + random(`z${i}`) * 7;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 540 + Math.cos(swirl) * r * 0.7,
              top: 960 + Math.sin(swirl) * r,
              width: size,
              height: size,
              borderRadius: "50%",
              background: COLORS.goldLight,
              boxShadow: `0 0 ${size * 4}px ${COLORS.gold}`,
              opacity:
                interpolate(frame, [0, 0.4 * fps], [0, 1], CLAMP) *
                (1 - g * 0.85),
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          opacity: core,
          scale: interpolate(core, [0, 1], [0.2, 1]),
          background: `radial-gradient(circle, rgba(247,224,138,0.95) 0%, rgba(212,175,55,0.45) 18%, rgba(212,175,55,0) 60%)`,
        }}
      />
      <div
        style={{
          fontFamily: reem,
          fontSize: 190,
          fontWeight: 700,
          ...goldText,
          opacity: textIn,
          scale: interpolate(textIn, [0, 1], [1.25, 1], { easing: ease }),
          filter: `blur(${(1 - textIn) * 16}px) drop-shadow(0 0 30px rgba(212,175,55,0.8))`,
        }}
      >
        النخبة
      </div>
    </AbsoluteFill>
  );
};
export const Ignition = Interactive.create({
  Component: IgnitionInner,
  layout: "absolute-fill",
  schema: {},
});

/* 2 — "16 متسابق... مقعد واحد في القمة" كلمة كلمة */
const Word: React.FC<{ at: number; children: string; big?: boolean }> = ({
  at,
  children,
  big,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 14], [0, 1], {
    ...CLAMP,
    easing: ease,
  });
  return (
    <span
      style={{
        display: "inline-block",
        margin: "0 14px",
        opacity: p,
        translate: `0px ${(1 - p) * 50}px`,
        filter: `blur(${(1 - p) * 12}px)`,
        fontSize: big ? 190 : 104,
        ...(big ? goldText : { color: "#F3F0E4" }),
      }}
    >
      {children}
    </span>
  );
};

const TaglineInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = interpolate(frame, [2.3 * fps, 3.3 * fps], [0, 1], {
    ...CLAMP,
    easing: ease,
  });
  return (
    <AbsoluteFill style={{ ...center, flexDirection: "column" }}>
      <RoyalBackground />
      <GoldDust count={40} opacity={0.7} />
      <div
        style={{
          fontFamily: reem,
          fontWeight: 700,
          textAlign: "center",
          padding: "0 90px",
          lineHeight: 1.25,
        }}
      >
        <div>
          <Word at={0.2 * fps} big>
            16
          </Word>
          <Word at={0.8 * fps}>متسابق...</Word>
        </div>
        <div
          style={{
            width: 640 * line,
            height: 4,
            margin: "40px auto",
            background: `linear-gradient(90deg, transparent, ${COLORS.gold}, transparent)`,
            boxShadow: `0 0 20px ${COLORS.gold}`,
          }}
        />
        <div>
          <Word at={1.9 * fps}>مقعد</Word>
          <Word at={2.3 * fps}>واحد</Word>
          <Word at={2.7 * fps}>في</Word>
        </div>
        <div style={{ marginTop: 10 }}>
          <Word at={3.2 * fps} big>
            القمة
          </Word>
        </div>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};
export const Tagline = Interactive.create({
  Component: TaglineInner,
  layout: "absolute-fill",
  schema: {},
});

/* 3 — رموز المسابقة: جرس، ساعة، كتب، علامة استفهام + سرعة / معرفة / ذكاء */
const Beat: React.FC<{
  from: number;
  to: number;
  children: React.ReactNode;
}> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= to) return null;
  const p = interpolate(frame, [from, from + 10], [0, 1], {
    ...CLAMP,
    easing: ease,
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 480,
        width: 560,
        height: 560,
        scale:
          interpolate(frame, [from, to], [1.2, 0.95]) *
          interpolate(p, [0, 1], [0.6, 1]),
        rotate: `${interpolate(frame, [from, to], [-6, 4])}deg`,
        opacity: p,
        filter: `drop-shadow(0 0 40px rgba(212,175,55,0.7))`,
      }}
    >
      {children}
    </div>
  );
};

const Label: React.FC<{ from: number; to: number; text: string }> = ({
  from,
  to,
  text,
}) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= to) return null;
  const p = interpolate(frame, [from, from + 9], [0, 1], {
    ...CLAMP,
    easing: ease,
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 1170,
        fontFamily: reem,
        fontWeight: 700,
        fontSize: 200,
        ...goldText,
        opacity: p * interpolate(frame, [to - 6, to], [1, 0], CLAMP),
        scale: interpolate(p, [0, 1], [1.5, 1]),
      }}
    >
      {text}
    </div>
  );
};

const SymbolsInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cuts = [0, 1 * fps, 2 * fps, 4 * fps];
  const flash = Math.max(
    ...cuts.map((c) =>
      interpolate(frame, [c, c + 2, c + 9], [0, 0.85, 0], CLAMP),
    ),
  );
  return (
    <AbsoluteFill style={center}>
      <RoyalBackground />
      <AbsoluteFill
        style={{
          rotate: `${frame * 0.4}deg`,
          scale: 1.6,
          opacity: 0.35,
          background: `repeating-conic-gradient(from 0deg at 50% 50%, rgba(212,175,55,0.35) 0deg 4deg, transparent 4deg 18deg)`,
          maskImage:
            "radial-gradient(circle at 50% 50%, black 0%, transparent 55%)",
        }}
      />
      <GoldDust count={50} />
      <Beat from={0} to={1 * fps}>
        <Bell />
      </Beat>
      <Beat from={1 * fps} to={2 * fps}>
        <Stopwatch
          progress={interpolate(frame, [1 * fps, 2 * fps], [0, 1], CLAMP)}
        />
      </Beat>
      <Beat from={2 * fps} to={4 * fps}>
        <Books />
      </Beat>
      <Beat from={4 * fps} to={6 * fps}>
        <Question />
      </Beat>
      <Label from={0} to={2 * fps} text="سرعة" />
      <Label from={2 * fps} to={4 * fps} text="معرفة" />
      <Label from={4 * fps} to={6 * fps} text="ذكاء" />
      <Vignette />
      <AbsoluteFill
        style={{ background: COLORS.goldLight, opacity: flash * 0.5 }}
      />
    </AbsoluteFill>
  );
};
export const Symbols = Interactive.create({
  Component: SymbolsInner,
  layout: "absolute-fill",
  schema: {},
});

/* 4 — عد تنازلي 3 2 1 */
const Digit: React.FC<{ from: number; len: number; n: string }> = ({
  from,
  len,
  n,
}) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= from + len) return null;
  const t = frame - from;
  const p = interpolate(t, [0, 12], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.2, 1.4, 0.4, 1),
  });
  const out = interpolate(t, [len - 10, len], [1, 0], CLAMP);
  const ring = interpolate(t, [0, 30], [0, 1], { ...CLAMP, easing: ease });
  return (
    <AbsoluteFill style={center}>
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 1000,
          borderRadius: "50%",
          scale: 0.3 + ring * 1.1,
          opacity: (1 - ring) * 0.9,
          border: `6px solid ${COLORS.gold}`,
          boxShadow: `0 0 60px ${COLORS.gold}, inset 0 0 60px ${COLORS.gold}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          opacity: interpolate(t, [0, 4, 30], [0, 1, 0.25], CLAMP),
          background: `radial-gradient(circle, rgba(212,175,55,0.45) 0%, transparent 60%)`,
        }}
      />
      <div
        style={{
          fontFamily: tajawal,
          fontWeight: 800,
          fontSize: 760,
          lineHeight: 1,
          ...goldText,
          filter: `drop-shadow(0 0 ${40 + (1 - ring) * 60}px rgba(212,175,55,0.9))`,
          scale:
            interpolate(p, [0, 1], [2.2, 1]) *
            interpolate(t, [12, len], [1, 0.9], CLAMP),
          opacity: p * out,
        }}
      >
        {n}
      </div>
    </AbsoluteFill>
  );
};

const CountdownInner = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <RoyalBackground glow={0.7} />
      <GoldDust count={30} opacity={0.6} />
      <Digit from={0} len={2 * fps} n="3" />
      <Digit from={2 * fps} len={2 * fps} n="2" />
      <Digit from={4 * fps} len={2 * fps} n="1" />
      <Vignette />
    </AbsoluteFill>
  );
};
export const Countdown = Interactive.create({
  Component: CountdownInner,
  layout: "absolute-fill",
  schema: {},
});

/* 5 — ظهور الشعار بلمعة ذهبية */
const LogoRevealInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0, 1.6 * fps], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.2, 1.1, 0.3, 1),
  });
  const shine = (at: number) =>
    interpolate(frame, [at, at + 0.9 * fps], [-0.4, 1.4], CLAMP);
  const s1 = shine(1.6 * fps);
  const s2 = shine(4 * fps);
  const flash = interpolate(frame, [0, 3, 16], [1, 1, 0], CLAMP);
  return (
    <AbsoluteFill style={center}>
      <RoyalBackground />
      <AbsoluteFill
        style={{
          rotate: `${-frame * 0.25}deg`,
          scale: 1.8,
          opacity: 0.4 * p,
          background: `repeating-conic-gradient(from 0deg at 50% 50%, rgba(212,175,55,0.4) 0deg 3deg, transparent 3deg 15deg)`,
          maskImage:
            "radial-gradient(circle at 50% 50%, black 0%, transparent 50%)",
        }}
      />
      <GoldDust count={70} />
      <div
        style={{
          position: "relative",
          width: 760,
          height: 760,
          scale:
            interpolate(p, [0, 1], [0.4, 1]) *
            interpolate(frame, [1.6 * fps, 6 * fps], [1, 1.06], CLAMP),
          opacity: p,
          filter: `blur(${(1 - p) * 20}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            rotate: `${frame * 1.2}deg`,
            background: `conic-gradient(${COLORS.goldDeep}, ${COLORS.goldLight}, ${COLORS.gold}, ${COLORS.goldDeep}, ${COLORS.goldLight}, ${COLORS.goldDeep})`,
            boxShadow: `0 0 90px rgba(212,175,55,0.75)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 18,
            borderRadius: "50%",
            overflow: "hidden",
            background: COLORS.navy,
          }}
        >
          <Img
            src={staticFile("logo.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              scale: 1.12,
            }}
          />
          {[s1, s2].map((s, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(115deg, transparent ${s * 100 - 18}%, rgba(247,224,138,0.75) ${s * 100}%, transparent ${s * 100 + 18}%)`,
                mixBlendMode: "screen",
              }}
            />
          ))}
        </div>
      </div>
      <Vignette />
      <AbsoluteFill
        style={{ background: COLORS.goldLight, opacity: flash * 0.6 }}
      />
    </AbsoluteFill>
  );
};
export const LogoReveal = Interactive.create({
  Component: LogoRevealInner,
  layout: "absolute-fill",
  schema: {},
});

/* 6 — الشاشة الأخيرة */
const FinaleInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = (at: number) =>
    interpolate(frame, [at, at + 0.6 * fps], [0, 1], {
      ...CLAMP,
      easing: ease,
    });
  const t1 = a(0);
  const t2 = a(0.5 * fps);
  const t3 = a(1.1 * fps);
  return (
    <AbsoluteFill
      style={{ ...center, flexDirection: "column", textAlign: "center" }}
    >
      <RoyalBackground />
      <GoldDust count={60} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: `6px solid ${COLORS.gold}`,
            boxShadow: `0 0 50px rgba(212,175,55,0.6)`,
            marginBottom: 70,
            opacity: t1,
          }}
        />
        <div
          style={{
            fontFamily: reem,
            fontWeight: 700,
            fontSize: 122,
            lineHeight: 1.3,
            padding: "0 80px",
            ...goldText,
            opacity: t1,
            translate: `0px ${(1 - t1) * 40}px`,
          }}
        >
          دوري بنو مسروح للنخبة
        </div>
        <div
          style={{
            fontFamily: tajawal,
            fontWeight: 800,
            fontSize: 70,
            color: "#F3F0E4",
            letterSpacing: interpolate(t2, [0, 1], [22, 8]),
            direction: "ltr",
            marginTop: 24,
            opacity: t2,
          }}
        >
          MASRO7 LEAGUE
        </div>
        <div
          style={{
            width: 520 * t2,
            height: 3,
            margin: "50px 0",
            background: `linear-gradient(90deg, transparent, ${COLORS.gold}, transparent)`,
          }}
        />
        <div
          style={{
            fontFamily: reem,
            fontWeight: 700,
            fontSize: 96,
            ...goldText,
            opacity: t3 * (0.75 + 0.25 * Math.sin(frame / 5)),
            scale: interpolate(t3, [0, 1], [0.8, 1]),
          }}
        >
          الافتتاح قريباً
        </div>
      </div>
      <Vignette />
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: interpolate(frame, [2.7 * fps, 3 * fps], [0, 0.6], CLAMP),
        }}
      />
    </AbsoluteFill>
  );
};
export const Finale = Interactive.create({
  Component: FinaleInner,
  layout: "absolute-fill",
  schema: {},
});
