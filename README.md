<p align="center">
  <img src="public/logo.svg" alt="simpleFontMaker" width="520">
</p>

A browser tool for drawing fonts by hand and exporting them as TTF files.

I made this for myself. I wanted to turn my handwriting into a font and every tool i found for that was paid. So i made this.

It is not a professional font editor. It does not do kerning, hinting, ligatures or any of that (yet). It takes your drawings and gives you a TTF you can install and use. That is it.

## Running It

https://mmd-marcelo.github.io/simpleFontMaker/

No install, no account. Everything runs in the browser and saves to localStorage. Nothing is sent anywhere.

## How To Use It

The right way to use this is with a proper image editor.

Download the glyph template from the app. Open it in Photoshop, GIMP, Krita, Procreate, or whatever you have that supports layers. Put the template on the bottom layer and use it as a guide for where the baseline, cap height and x-height are. Draw your letter on a new layer on top. When you are done, hide or delete the template layer and export only your drawing layer as a PNG with a transparent background.

Then upload that PNG to the glyph slot in the app.

This gives you the best result because you can use whatever brush, pressure sensitivity, or drawing tablet you already have. The template just keeps things consistent across characters.

For the lazy, there is also a built-in editor directly in the browser. It has a round brush, square brush, calligraphy brush, bucket fill, lasso fill and an eraser. It works. It is not going to replace a real drawing app but it gets the job done if you do not want to leave the browser.

## What You Get

- Draw or upload each character individually
- Built-in editor with brush tools, lasso fill, undo, zoom
- Text preview with proportional letter spacing
- Adjust spacing globally or per character
- Export as TTF

## What You Do Not Get

- Kerning
- Ligatures
- OpenType features
- Hinting
- Anything a professional type foundry would need

## Building Locally

```bash
npm install
npm run dev
```

```bash
npm run build
```

Output goes to `dist/`. If you fork it and change the repo name, update the `base` field in `vite.config.js` to match.

## Project Structure

```
src/
  components/     editor toolbar, drawing canvas, panels
  lib/            font building, path tracing, SVG parsing
  pages/          project list, glyph editor, text preview
  store/          state
```
