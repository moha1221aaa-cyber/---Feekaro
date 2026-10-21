# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i --loglevel=error
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## تيزر دوري بنو مسروح للنخبة

```bash
cd video
npm i
npm run dev   # يفتح Remotion Studio، اختر LeagueTeaser
```

النصوص والألوان والتصنيفات ومستوى الصوت تتعدل من لوحة Props يمين الـ Studio.

### التعليق الصوتي (فصحى)

النص المشكول في `src/Teaser/voiceover.json`. بعد أي تعديل:

```bash
ELEVEN_KEY=... npm run voiceover        # أو AZURE_TTS_KEY=... AZURE_TTS_REGION=...
```

على GitHub يتولّد لحاله لو أسرار `ELEVEN_KEY` أو `AZURE_TTS_KEY` و `AZURE_TTS_REGION` موجودة في إعدادات المستودع.

موسيقى خاصة (اختياري): حط `music.mp3` في `public/` وتحل محل موسيقى البرنامج.
