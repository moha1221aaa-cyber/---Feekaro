import { Composition } from "remotion";
import { Opening } from "./Opening";
import { Countdown, Finale, Ignition, LogoReveal, Symbols, Tagline } from "./scenes/Scenes";

const base = { width: 1080, height: 1920, fps: 30 } as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="MasroOpening" component={Opening} durationInFrames={900} {...base} />
    <Composition id="Ignition" component={Ignition} durationInFrames={120} {...base} />
    <Composition id="Tagline" component={Tagline} durationInFrames={150} {...base} />
    <Composition id="Symbols" component={Symbols} durationInFrames={180} {...base} />
    <Composition id="Countdown" component={Countdown} durationInFrames={180} {...base} />
    <Composition id="LogoReveal" component={LogoReveal} durationInFrames={180} {...base} />
    <Composition id="Finale" component={Finale} durationInFrames={90} {...base} />
  </>
);
