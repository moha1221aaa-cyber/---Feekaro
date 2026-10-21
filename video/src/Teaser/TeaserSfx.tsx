import { Audio } from "@remotion/media";
import { useVideoConfig } from "remotion";
import { sfx } from "../sfx";

// مؤثرات التيزر من مكتبة Kenney (public/sfx). التوقيت مطابق للمشاهد في Teaser.tsx:
// نقاط القطع 4، 9، 15، 21، 26 ث، والمشهد 3 يبدأ 262، و 4 يبدأ 442، و 5 يبدأ 622، و 6 يبدأ 772
export const TeaserSfx: React.FC<{ volume: number }> = ({ volume: v }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {/* 1: جرس مع الفلاش */}
      <Audio
        name="Bell (flash)"
        from={0.4 * fps}
        src={sfx("impact", "impactbell-heavy-000")}
        volume={0.7 * v}
      />

      {/* انتقالات: هبّة قبل كل قطع */}
      <Audio
        name="Swoosh 1"
        from={4 * fps - 14}
        src={sfx("scifi", "forcefield-000")}
        volume={0.35 * v}
      />
      <Audio
        name="Swoosh 2"
        from={9 * fps - 14}
        src={sfx("scifi", "forcefield-001")}
        volume={0.35 * v}
      />
      <Audio
        name="Swoosh 3"
        from={15 * fps - 14}
        src={sfx("scifi", "forcefield-002")}
        volume={0.35 * v}
      />
      <Audio
        name="Swoosh 4"
        from={21 * fps - 14}
        src={sfx("scifi", "forcefield-003")}
        volume={0.35 * v}
      />
      <Audio
        name="Swoosh 5"
        from={26 * fps - 14}
        src={sfx("scifi", "forcefield-004")}
        volume={0.35 * v}
      />

      {/* 2: علامة الاستفهام تطلع */}
      <Audio
        name="Question rise"
        from={4 * fps}
        src={sfx("digital", "phaserup1")}
        volume={0.4 * v}
      />

      {/* 3: كل بطاقة تستقر */}
      <Audio
        name="Card 1"
        from={262 + 16}
        src={sfx("interface", "glass-001")}
        volume={0.5 * v}
      />
      <Audio
        name="Card 2"
        from={262 + 23}
        src={sfx("interface", "glass-002")}
        volume={0.5 * v}
      />
      <Audio
        name="Card 3"
        from={262 + 30}
        src={sfx("interface", "glass-003")}
        volume={0.5 * v}
      />
      <Audio
        name="Card 4"
        from={262 + 37}
        src={sfx("interface", "glass-004")}
        volume={0.5 * v}
      />
      <Audio
        name="Card 5"
        from={262 + 44}
        src={sfx("interface", "glass-005")}
        volume={0.5 * v}
      />
      <Audio
        name="Card 6"
        from={262 + 51}
        src={sfx("interface", "glass-006")}
        volume={0.5 * v}
      />

      {/* 4: ضربة ثقيلة مع كل رقم */}
      <Audio
        name="Boom 3"
        from={442 + 9}
        src={sfx("scifi", "lowfrequency-explosion-001")}
        volume={0.8 * v}
      />
      <Audio
        name="Hit 3"
        from={442 + 9}
        src={sfx("impact", "impactmetal-heavy-000")}
        volume={0.7 * v}
      />
      <Audio
        name="Boom 2"
        from={442 + 54}
        src={sfx("scifi", "lowfrequency-explosion-001")}
        volume={0.8 * v}
      />
      <Audio
        name="Hit 2"
        from={442 + 54}
        src={sfx("impact", "impactmetal-heavy-001")}
        volume={0.7 * v}
      />
      <Audio
        name="Boom 1"
        from={442 + 99}
        src={sfx("scifi", "lowfrequency-explosion-000")}
        volume={0.9 * v}
      />
      <Audio
        name="Hit 1"
        from={442 + 99}
        src={sfx("impact", "impactmetal-heavy-002")}
        volume={0.8 * v}
      />

      {/* 5: الكأس يطلع ثم لمعة */}
      <Audio
        name="Trophy rise"
        from={622}
        src={sfx("digital", "powerup1")}
        volume={0.45 * v}
      />
      <Audio
        name="Trophy shine"
        from={622 + 1.6 * fps}
        src={sfx("impact", "impactbell-heavy-001")}
        volume={0.5 * v}
      />

      {/* 6: جنقل الشعار */}
      <Audio
        name="Logo jingle"
        from={772 + 10}
        src={sfx("jingles", "steel-steel04")}
        volume={0.6 * v}
      />
    </>
  );
};
