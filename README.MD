# QOF - The "Quite OK Font Format"
QOF is the simple vector font format and library. QOF isn't the most efficient, doesn't support advanced typography features, and doesn't produce the cleanest output (potentially will be solved in the future once subpixel font rendering is implemented), but it's lightweight and easy to use.

### Important Notes
The QOF binary format has reached the point where it should be stable and never change unless I have made some big oversight in the format. The renderer is functional, but is still work in progress and so it doesn't support multi-glyph per character rendering and doesn't use subpixel font rendering yet. The converter still requires big performance and output size optimizations. The font editor has not been started yet. Currently the only functioning implementation is the JavaScript one.

### How simple?
The TTF specification is 922,829 words long while the QOF specification is 1,158 words.  
Freetype is ~160,300 lines of code while my QOF implementation is ~700 lines of code.

## Resources
- [Online QOF Converter](https://vexcess.github.io/QOF/converter.html)
- [Online QOF Demo](https://vexcess.github.io/QOF/src/javascript/demo.html)
- [Documentation](https://github.com/vExcess/QOF/blob/main/documentation.md)
- [Specification](https://github.com/vExcess/QOF/blob/main/specification.md)

## Why?
So you want to encode and render fonts? the most fundamental task in creating a GUI. Lets look at your options:
- TTF (TrueType) - Very complicated font format created by Microsoft and Apple
- OTF (OpenType) - Even more complicated superset of TrueType
- EOT (Embedded OpenType) - A MTX compression wrapper around OTF
- WOFF (Web Open Font Format) - A zlib compression wrapper around TTF and OTF
- WOFF2 (Web Open Font Format 2) - A brotli compression wrapper around TTF and OTF
- PostScript Type 1 - Legacy format from Adobe that has been discontinued
- VFC (FontLab Format), FOG (Fontographer), VFB, glyphs - Proprietary formats used by FontLab Studio software
- VFJ (FontLab JSON Format), UFO (Unified Font Object), XFO (Extended Font Object), PHF (PhotoFont) - all these are XML or JSON based and are not compact

All of the above fonts fall into a category that eliminates it from being desirable to use. I want a font format that is
1) Trivial to implement (not TTF/OTF based, not an SDF font, not proprietary)
2) Compact (not XML/JSON based)
3) Scales well (not a bitmap font)

Because none of the existing font formats fit my wants I created my own font format affectionately named after my favorite image format [QOI](https://github.com/phoboslab/qoi).

## QOF Supported Features
- variable scaling because it is vector based
- basic horizontal kerning pairs
- nine possible font weights
- italics
- 2 glyphs per character

## QOF Excluded Features
The following features are rather complex and the goal of QOF is to be simple. If you need complex font features (such as if you are rendering Arabic instead of English) then use a complex font format such as TTF or OTF.
- contextual kerning
- vertical kerning
- 65,336 possible font weights
- ligatures
- small caps
- alternate glyphs
- right to left text
- vertical text
- collections
- more than 2 glyphs per character
- characters past char code 32,767

## Language Support
I am primarily creating this font format for my own use, but I hope it will be helpful to others as well. I am going to provide implementations in multiple popular languages. Ports to even more languages from the community are welcome.

## File Size
In order to be simple QOF doesn't have built in traditional compression. File sizes should be fairly small due to QOF's dense binary layout (a few dozen KB max), but if you need them smaller you can gzip your fonts and then ungzip them before use. From my testing gziping QOF fonts can reduce them to 55% of their original size.

## Automatic Font Converter
A font renderer's usefulness is directly correlated to the amount of fonts available to it. The number of fonts created for a renderer is directly correlated to the renderer's usefulness. We have a chicken and egg problem. Solution? I have created a program that can automatically convert other font types QOF. That's right! There's no need to find or manually create QOF fonts to use in your application. You can use nearly any existing TTF font by simple converting it to the simpler QOF format! Just beware of licensing issues as some fonts may not permit distributing derivative works. In addition my font converter works by analyzing bitmaps of the rendered font so with a few tweaks it could be used to automatically convert bitmap fonts to vector fonts.

## Font Editor
The automatic font converter will not reproduce the original font perfectly and there may be undesirable defects in the converted font. So I am also providing a QOF font editor where QOF fonts can be edited to perfection. The QOF editor will even provide the option to automatically compute kerning pairs. Fancy!

## TODO
- Create font editor
- Make font converter multithreaded for faster conversion time
- Add glyph recycling to font converter
- Add subpixel rendering support to font renderer
- Add multiple glyph rendering support to font renderer
- Add bilinear filter font scaling to font renderer (to render multiple font sizes from 1 cached glyph bitmap)
- Provide implementations for Python, Java, Zig (+ create C header for C compatability), Dart
