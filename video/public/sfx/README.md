# مكتبة المؤثرات الصوتية (696 صوت)

كلها من **Kenney** (www.kenney.nl) برخصة **CC0**: مجانية للاستخدام الشخصي والتجاري، والإشارة لـ Kenney اختيارية.
انجمعت عن طريق مستودع soundcn (MIT). أصوات World of Warcraft اللي فيه **ما انضافت** لأنها ملك Blizzard ومو مجانية.

| الحزمة | العدد | فيها |
|---|---|---|
| impact | 130 | ضربات معدن وخشب وزجاج، لكمات، خطوات |
| interface | 100 | نقرات، تأكيد، خطأ، فتح وإغلاق، تمرير |
| voiceover | 92 | تعليق إنجليزي: go، ready، winner، game over، أرقام… |
| jingles | 85 | مقاطع قصيرة: 8-bit، hit، pizzicato، sax، steel |
| scifi | 73 | ليزر، محركات، طاقة، انفجارات |
| digital | 63 | أصوات رقمية وألعاب: power-up، zap، phaser |
| casino | 54 | عملات، رقائق، أوراق لعب، نرد |
| rpg | 52 | سيوف، أبواب، كتب، جلد، معادن |
| voiceover-fighter | 47 | تعليق بأسلوب ألعاب القتال: fight، round، K.O… |

## الاستخدام

```tsx
import { Audio } from "@remotion/media";
import { sfx } from "../sfx";

<Audio src={sfx("impact", "impactmetal-heavy-000")} />
```

الأسماء كلها في `src/sfx/catalog.ts` (والمحرر يكمّلها لك). لتجربة أي صوت: افتح **Library/SfxPreview** في Studio وغيّر pack و name.
لو ضفت أو حذفت ملفات هنا: `npm run sfx:catalog`.
