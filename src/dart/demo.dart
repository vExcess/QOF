import 'dart:io';
import './qof.dart' as QOF;

final VERT = QOF.VERT;
final QUAD = QOF.QUAD;
final HOLE = QOF.HOLE;

class CachedGlyphData {
    late List<int> bitmap;
    late List<int> box;
    CachedGlyphData(this.bitmap, this.box);
}

Map<String, CachedGlyphData> bitmapCache = {};

QOF.Font? myFont;

// void cacheGlyph(String char, QOF.Font font, int sz) {
//     final glyphInfo = font.glyphInfo(char.codeUnitAt(0));
//     final glyph = font.glyphs[glyphInfo.index1];

//     final metrics = QOF.measureText(char, font, sz);

//     final cacheKey = font.name + " " + sz.toString() + " " + char;
//     if (metrics.actualWidth == 0 || metrics.actualHeight == 0) {
//         // bitmapCache[cacheKey] = null;
//     } else {
//         final canvasWidth = (metrics.actualWidth + 1).round();
//         final canvasHeight = (metrics.actualHeight + 1).round();
//         var ctx = raylib.loadRenderTexture(canvasWidth, canvasHeight);

//         final x = metrics.actualBoundingBoxLeft;
//         final y = metrics.actualBoundingBoxAscent;
        
//         raylib.beginTextureMode(ryBinds.RenderTexture.fromRef(ctx));
//         renderGlyph(glyph, -x, y, sz);
//         raylib.endTextureMode();

//         // create grayscale bitmap of glyph
//         var imgData;
//         if (canvasWidth == 0 || canvasHeight == 0) {
//             imgData = [];
//         } else {
//             imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
//         }
//         var pix = imgData.data;
//         var usedPixLen = pix.length;
//         var usedCanvasHeight = canvasHeight;

//         var cacheBitmap = List.filled(usedPixLen / 4, 0);
//         for (var i = 0; i < usedPixLen; i += 4) {
//             if (pix[i] == 0) {
//                 if (pix[i+3] > 0) {
//                     pix[i] = 255 - pix[i+3];
//                 } else {
//                     // pixel is transparent so set it to background color
//                     pix[i] = 255;
//                 }
//             }
//             cacheBitmap[i >> 1] = pix[i];
//         }

//         bitmapCache[cacheKey] = CachedGlyphData(cacheBitmap, [x, y, canvasWidth, usedCanvasHeight]);
//     }
// }

// void renderText(ryBinds.Raylib ctx, String txt, num x, num y, QOF.Font myFont, int sz, List<int> clr, num wrapWidth) {
//     // split the text into lines and loop through each line
//     final lines = txt.split("\n");
//     for (var l = 0; l < lines.length; l++) {
//         final line = lines[l];
//         final wordWidths = line.split(" ").map((word) => QOF.measureText(word, myFont, sz).fontWidth).toList();
//         var wordIdx = 0;

//         // the offset from origin of the current glyph
//         var xOff = 0.0;
//         // loop through all characters in each line
//         for (var t = 0; t < line.length; t++) {
//             var char = line[t];
//             final glyphInfo = myFont.glyphInfo(char.codeUnitAt(0));

//             if (glyphInfo.index1 == 0) {
//                 char = "\x00";
//             }

//             final cacheKey = myFont.name + " " + sz.toString() + " " + char;
//             if (bitmapCache[cacheKey] == null) {
//                 // cacheGlyph(char, myFont, sz);
//             }

//             // apply word wrapping
//             if (char == " ") {
//                 wordIdx++;
//             } else if (t > 0 && line[t-1] == " " && xOff + wordWidths[wordIdx] > wrapWidth) {
//                 xOff = 0;
//                 y += (myFont.ascent + myFont.descent) * sz * 1.2;
//             }
            
//             // render the glyph
//             final cachedData = bitmapCache[cacheKey];
//             if (cachedData != null) {
//                 final bitmap = cachedData.bitmap;
//                 final cacheXOff = cachedData.box[0];
//                 final cacheYOff = cachedData.box[1]; 
//                 final cacheWidth = cachedData.box[2];
//                 final cacheHeight = cachedData.box[3];

//                 // apply kerning
//                 final kern = myFont.kerning[line[t-1] + char];
//                 if (kern != null) {
//                     xOff += kern * sz;
//                 }

//                 final xPos = (x + xOff + cacheXOff).round();
//                 var yPos = y - cacheYOff + 1; // +1 for canvas height pad
//                 if (yPos + cacheHeight < y.round()) {
//                     yPos = yPos.ceil();
//                 } else {
//                     yPos = yPos.toInt();
//                 }
                
//                 if (cacheWidth != 0 && cacheHeight != 0) {
//                     // var imgData = ctx.getImageData(xPos, yPos, cacheWidth, cacheHeight);
//                     // renderBitmapGlyph(imgData, bitmap, cacheWidth, clr);
//                     // ctx.putImageData(imgData, xPos, yPos);
//                 }

//                 final glyph = myFont.glyphs[glyphInfo.index1];
//                 renderGlyph(glyph, x + xOff, y, sz);
//             }
            
//             // update glyph x offset
//             xOff += glyphInfo.width * sz;
//         }
        
//         // update glyph y position
//         y += (myFont.ascent + myFont.descent) * sz * 1.2;
//     }
// }

final sampleText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. á, é, í, ó, ú, ü, ñ, ¿, ¡";

void render() {
	final fontSize = 26;

	// // clear background
    // raylib.drawRectangle(0, 0, 400, 600, ryBinds.Color(255, 255, 255, 255));

	// renderText(raylib, sampleText, 10, 40, myFont as QOF.Font, fontSize, [0, 0, 0, 255], 380);
}

void main() {
    File("../../Open Sans.qof").readAsBytes().then((buffer) {
        final fileBytes = buffer;
        QOF.Font font = QOF.Font.fromBytes(fileBytes);
        print("name: ${font.name}");
        print("version: ${font.version}");
        print("ascent: ${font.ascent}");
        print("descent: ${font.descent}");
        print("glyphs: ${font.glyphs.map((g) { return g.map((n) { return n.toStringAsFixed(2); }); }).toList()}");
        print("characterMap: ${font.characterMap}");
        print("kerning: ${font.kerning}");
        print("weight: ${font.weight}");
        print("italic: ${font.italic}");
        myFont = font;
        render();
    });
}
