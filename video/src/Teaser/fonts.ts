import { loadFont as loadCairo } from "@remotion/google-fonts/Cairo";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadTajawal } from "@remotion/google-fonts/Tajawal";

export const cairo = loadCairo("normal", {
  weights: ["700", "900"],
  subsets: ["arabic", "latin"],
}).fontFamily;

export const tajawal = loadTajawal("normal", {
  weights: ["500", "700"],
  subsets: ["arabic"],
}).fontFamily;

export const cinzel = loadCinzel("normal", {
  weights: ["700"],
  subsets: ["latin"],
}).fontFamily;
