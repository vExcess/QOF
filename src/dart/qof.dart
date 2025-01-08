import 'dart:math' as Math;

double abs(double n) {
    return n < 0 ? -n : n;
}

var QOF;

const VERT = 0;
const QUAD = 1;
const HOLE = 2;

const FLOAT_SIZE = 3;
final pow2_8 = Math.pow(2, 16);
// encode a float into 3 bytes
List<int> encodeFloat(double n) {
    final neg = n < 0;
    n = abs(n);
    var sig = 0;
    while (n > 1) {
        n /= 2;
        sig++;
    }
    final val = (n * pow2_8).toInt();
    return [sig | (neg ? 128 : 0), val >> 8, val & 255];
}
// decode 3 bytes into a float
double decodeFloat(List<int> bytes) {
    return ((bytes[1] << 8) | bytes[2]) / pow2_8 * Math.pow(2, bytes[0] & 127) * (bytes[0] > 127 ? -1 : 1);
}

double map(num v, num istart, num istop, num ostart, num ostop) {
    return ostart + (ostop - ostart) * ((v - istart) / (istop - istart));
}

int ipow(int a, int b) {
    return Math.pow(a, b).toInt();
}

num constrain(num n, num mi, num ma) {
    if (n < mi)
        return mi;
    if (n > ma)
        return ma;
    return n;
}

List<List<String>> sortKerningRows(List<List<String>> arr) {
    var row1Chars = {};
    var row2Chars = {};
    for (var i = 0; i < arr.length; i++) {
        row1Chars[arr[i][0]] = 0;
        row2Chars[arr[i][1]] = 0;
    }
    if (row1Chars.keys.length < row2Chars.keys.length) {
        arr.sort((a, b) { return a[0].codeUnitAt(0) - b[0].codeUnitAt(0); });
    } else {
        arr.sort((a, b) { return a[1].codeUnitAt(0) - b[1].codeUnitAt(0); });
    }
    return arr;
}

class GlyphInfo {
    late int index1;
    late int index2;
    late double width;
    GlyphInfo(this.index1, this.index2, this.width);
}

class QOFont {
    String name = "";
    int version = 0;
    double ascent = 0;
    double descent = 0;
    List<List<double>> glyphs = [];
    Map<int, List<double>> characterMap = {};
    Map<String, double> kerning = {};
    int weight = 400;
    bool italic = false;

    static QOFont fromBytes(List<int> bytes) {
        var idx = 3;

        // len and version are in the same byte
        final nameLen = bytes[idx] & (ipow(2, 6)-1);
        final version = bytes[idx] >> 6;
        idx++;

        // read name
        var name = "";
        for (var i = 0; i < nameLen; i++) {
            name += String.fromCharCode(bytes[idx++]);
        }

        final italicWeight = bytes[idx++];
        final weight = (italicWeight & (ipow(2, 7)-1)) * 100;
        final italic = italicWeight >> 7 == 1;

        double decodeFloatAndMoveDecodePtr() {
            final float = decodeFloat(bytes.sublist(idx, idx + FLOAT_SIZE));
            idx += FLOAT_SIZE;
            return float;
        }

        int decodeShortAndMovePtr() {
            final val = (bytes[idx] << 8) | bytes[idx + 1];
            idx += 2;
            return val;
        }

        int decodeCharCodeAndMoveDecodePtr() {
            if (bytes[idx] < 128) {
                return bytes[idx++];
            } else {
                final val = ((bytes[idx] & (ipow(2,7)-1)) << 8) | bytes[idx + 1];
                idx += 2;
                return val;
            }
        }
        
        // font ascent and descent
        final ascent = decodeFloatAndMoveDecodePtr();
        final descent = decodeFloatAndMoveDecodePtr();
    
        // min and max character width
        final minW = decodeFloatAndMoveDecodePtr();
        final maxW = decodeFloatAndMoveDecodePtr();

        // min and max vector x coordinate
        final pXMin = decodeFloatAndMoveDecodePtr();
        final pXMax = decodeFloatAndMoveDecodePtr();

        // min and max vector y coordinate
        final pYMin = decodeFloatAndMoveDecodePtr();
        final pYMax = decodeFloatAndMoveDecodePtr();

        // the padding of the last byte of the commands section
        final cmdPad = bytes[idx++];
        
        // the number of rows in the character map table
        final charMapNumRows = decodeShortAndMovePtr();

        // decode character map table
        Map<int, List<double>> characterMap = {};
        List<int> charCodes = [];
        List<int> glyphIndexes1 = [];
        List<int> glyphIndexes2 = [];
        List<double> glyphWidths = [];
        while (charCodes.length < charMapNumRows) {
            charCodes.add(decodeCharCodeAndMoveDecodePtr());
        }
        while (glyphIndexes1.length < charMapNumRows) {
            glyphIndexes1.add(decodeCharCodeAndMoveDecodePtr());
        }
        while (glyphIndexes2.length < charMapNumRows) {
            glyphIndexes2.add(decodeCharCodeAndMoveDecodePtr());
        }
        while (glyphWidths.length < charMapNumRows) {
            glyphWidths.add(minW + bytes[idx++] / 255 * (maxW - minW));
        }
        for (var i = 0; i < charMapNumRows; i++) {
            characterMap[charCodes[i]] = [glyphIndexes1[i].toDouble(), glyphIndexes2[i].toDouble(), glyphWidths[i]];
        }

        // get the number of glyphs in the font
        final glyphsLen = decodeShortAndMovePtr();

        // array the store all glyphs
        List<List<double>> glyphs = [];
        // array that stores the glyph currently being decoded
        List<double> currGlyph = [];
        // how many bytes the commands section occupies
        final endOff = decodeShortAndMovePtr();
        // store index of start of glyph data
        final startI = idx;
        // idx will store the index of the current commands being decoded
        // pIdx stores the index of the parameters for the current command being decoded
        final pStartIdx = startI + endOff;
        var pIdx = pStartIdx;
        final GLYPH_SEPERATOR = 3; // glyphs are seperated by binary 11
        final PAIRS_PER_BYTE = 4;
        var counter = 0;
        while (idx < pStartIdx) {
            // decode each byte into 4 potential commands
            // potential because some could be padding
            final seg = [
                bytes[idx] >> 6,
                (bytes[idx] >> 4) & 3,
                (bytes[idx] >> 2) & 3,
                bytes[idx] & 3
            ];
            // if we've reached the end of the glyphs data and the padding isn't a whole byte
            // set the pad to the commandPadding instead of 0
            final pad = idx == pStartIdx-1 && cmdPad != PAIRS_PER_BYTE ? cmdPad : 0;
            // loop through all potential commands except the ones that are padding
            for (var j = 0; j < seg.length - pad; j++) {
                if (seg[j] == GLYPH_SEPERATOR) {
                    // if the command is a glyph seperator store the
                    // current glyph and create a new array for the next glyph
                    glyphs.add(currGlyph);
                    currGlyph = [];
                } else {
                    // push the command to the glyph data
                    currGlyph.add(seg[j].toDouble());
                    // push the relevant paramters to the glyph data
                    // unmap the vertex coordinates from a byte to their original range
                    if (seg[j] == VERT) {
                        final a = map(bytes[pIdx++], 0, 255, pXMin, pXMax);
                        final b = map(bytes[pIdx++], 0, 255, pYMin, pYMax);
                        counter +=2;
                        currGlyph.addAll([a, b]);
                    } else if (seg[j] == QUAD) {
                        final a = map(bytes[pIdx++], 0, 255, pXMin, pXMax);
                        final b = map(bytes[pIdx++], 0, 255, pYMin, pYMax);
                        final c = map(bytes[pIdx++], 0, 255, pXMin, pXMax);
                        final d = map(bytes[pIdx++], 0, 255, pYMin, pYMax);
                        counter+=4;
                        currGlyph.addAll([a, b, c, d]);
                    }
                }
            }
            idx++;
        }

        Map<String, double> kerning = {};

        idx = pIdx;
        final minKern = decodeFloatAndMoveDecodePtr();
        final maxKern = decodeFloatAndMoveDecodePtr();

        final numKernTables = bytes[idx++];
        for (var i = 0; i < numKernTables; i++) {
            final numRows = bytes[idx++];
            final kernAmount = map(bytes[idx++], 0, 255, minKern, maxKern);
            var ch1s = List.filled(numRows, "");
            for (var j = 0; j < numRows; j++) {
                ch1s[j] = String.fromCharCode(decodeCharCodeAndMoveDecodePtr());
            }
            for (var j = 0; j < numRows; j++) {
                final ch2 = String.fromCharCode(decodeCharCodeAndMoveDecodePtr());
                kerning[ch1s[j] + ch2] = kernAmount;
            }
        }

        // return the decoded font object
        var outFont = new QOFont();
        outFont.name = name;
        outFont.weight = weight;
        outFont.italic = italic;
        outFont.version = version;
        outFont.ascent = ascent;
        outFont.descent = descent;
        outFont.glyphs = glyphs;
        outFont.characterMap = characterMap;
        outFont.kerning = kerning;
        return outFont;
    }

    List<int> toBytes() {
        // stores min and max x and y coordinates of glyph vector points
        var pXMin = double.infinity;
        var pXMax = double.negativeInfinity;
        var pYMin = double.infinity;
        var pYMax = double.negativeInfinity;

        // stores glyphs as pairs of commands and parameters
        // [commands, parameters, commands, parameters, ...]
        var intermediate = [];

        // loop through all glyphs
        for (var g = 0; g < this.glyphs.length; g++) {
            final glyph = this.glyphs[g];
            
            // commands and parameters for each glyph
            var commands = [];
            var parameters = [];

            // loop through glyph data
            {var i = 0; while (i < glyph.length) {
                var shape = glyph[i];

                // if shape is hole, add it to commands, and move to next item
                if (shape == HOLE) {
                    commands.add(HOLE);
                    i++;
                    shape = glyph[i];
                }

                // split shape into command and parameters
                commands.add(shape);
                if (shape == VERT) {
                    parameters.addAll([glyph[i+1], glyph[i+2]]);
                    i += 3;
                } else if (shape == QUAD) {
                    parameters.addAll([glyph[i+1], glyph[i+2], glyph[i+3], glyph[i+4]]);
                    i += 5;
                }
            }}
            
            // find the min and max of parameters (glyph vector points)
            for (var j = 0; j < parameters.length; j += 2) {
                final xPos = parameters[j];
                final yPos = parameters[j+1];
                if (xPos < pXMin) {
                    pXMin = xPos;
                }
                if (xPos > pXMax) {
                    pXMax = xPos;
                }
                if (yPos < pYMin) {
                    pYMin = yPos;
                }
                if (yPos > pYMax) {
                    pYMax = yPos;
                }
            }
            
            // store commands and parameters
            intermediate.addAll([commands, parameters]);
        }
        
        // bitpack all commands into a binary string
        var allCmdsBin = "";
        // loop through all glyph commands
        for (var i = 0; i < intermediate.length; i += 2) {
            final cmds = intermediate[i];
            // append the commands for each glyph as pairs of bits
            for (var j = 0; j < cmds.length; j++) {
                allCmdsBin += cmds[j].toString(2).padStart(2, "0");
            }
            // seperate glyph commands with 11
            allCmdsBin += "11";
        }
        
        // flattens character map into an array
        final CHAR_MAP_ROW_LEN = 4;
        var charMapTable = [];
        var minW = double.infinity;
        var maxW = 0.0;
        // loop through each character code in the characterMap
        for (final chCode in this.characterMap.keys) {
            final glyphInfo = this.glyphInfo(chCode);
            // store the data in the flat array
            charMapTable.addAll([chCode, glyphInfo.index1, glyphInfo.index2, glyphInfo.width]);

            // calculate the min and max width of the characters
            if (glyphInfo.width < minW) {
                minW = glyphInfo.width;
            }
            if (glyphInfo.width > maxW) {
                maxW = glyphInfo.width;
            }
        }

        // reorder charMapTable from
        // [charCode, glyphIndex, glyphWidth, charCode, glyphIndex, glyphWidth, ...]
        // to
        // [
        //      charCode, charCode, ..., 
        //      glyphIndex1, glyphIndex1, ..., 
        //      glyphIndex2, glyphIndex2, ..., 
        //      glyphWidth, glyphWidth, ...
        // ]
        var reOrderedTable = [];
        for (var i = 0; i < charMapTable.length; i += CHAR_MAP_ROW_LEN) {
            reOrderedTable.add(charMapTable[i]);
        }
        for (var i = 1; i < charMapTable.length; i += CHAR_MAP_ROW_LEN) {
            reOrderedTable.add(charMapTable[i]);
        }
        for (var i = 2; i < charMapTable.length; i += CHAR_MAP_ROW_LEN) {
            reOrderedTable.add(charMapTable[i]);
        }
        for (var i = 3; i < charMapTable.length; i += CHAR_MAP_ROW_LEN) {
            reOrderedTable.add((map(charMapTable[i], minW, maxW, 0, 255)).round());
        }
        charMapTable = reOrderedTable;

        // reorder {"${char1}${char2}": kernValue} to {kernValue: [[char1, char2], ...]}
        Map<double, List<List<String>>> kernTables = {};
        for (final pair in this.kerning.keys) {
            final val = this.kerning[pair];
            if (kernTables[val] == null)
                kernTables[val as double] = [];
            kernTables[val]?.add([pair[0], pair[1]]);    
        }
        
        var maxKern = double.negativeInfinity;
        var minKern = double.infinity;
        var kernCharFreq = {};
        var kernTableCount = 0;
        for (final kernValStr in kernTables.keys) {
            // sort kern tables for maximum compressability
            final kernTable = sortKerningRows(kernTables[kernValStr] as List<List<String>>);

            // sum character frequency
            for (var i = 0; i < kernTable.length; i++) {
                final ch1 = kernTable[i][0];
                if (!kernCharFreq[ch1]) {
                    kernCharFreq[ch1] = 1;
                } else {
                    kernCharFreq[ch1]++;
                }
                final ch2 = kernTable[i][1];
                if (!kernCharFreq[ch2]) {
                    kernCharFreq[ch2] = 1;
                } else {
                    kernCharFreq[ch2]++;
                }
            }

            // find min and max kern
            final kernVal = kernValStr;
            if (kernVal > maxKern)
                maxKern = kernVal;
            if (kernVal < minKern)
                minKern = kernVal;

            // count number of kern tables
            kernTableCount++;
        }
        
        // start file with the code points for "QOF"
        var file = [81,79,70];

        // write font version and font name
        final nameLen = Math.min(63, this.name.length);
        file.add((this.version << 6) | nameLen);
        for (var i = 0; i < nameLen; i++) {
            file.add(this.name[i].codeUnitAt(0));
        }

        // write weight and italic flag
        file.add((this.weight / 100).round() | ((this.italic ? 1 : 0) << 7));

        void writeFloat(double num) {
            final bytes = encodeFloat(num);
            file.addAll([bytes[0], bytes[1], bytes[2]]);
        }

        void writeShort(int num) {
            // store short in big endian
            file.addAll([num >> 8, num & (ipow(2, 8)-1)]);
        }
        
        void writeCharCode(int num) {
            // store code in big endian
            if (num < 128) {
                file.add(num);
            } else {
                file.addAll([(num >> 8) | 128, num & (ipow(2, 8)-1)]);
            }
        }
        
        // ascent
        writeFloat(this.ascent);
        // descent
        writeFloat(this.descent);
        
        // min width
        writeFloat(minW);
        // max width
        writeFloat(maxW);
        
        // param x min
        writeFloat(pXMin);
        // param x max
        writeFloat(pXMax);
        
        // param y min
        writeFloat(pYMin);
        // param y max
        writeFloat(pYMax);
        
        // store the padding of the last byte of the stored commands
        final fr = allCmdsBin.length / 8;
        final fractionOfByteUsed = fr - fr.toInt();
        final PAIRS_PER_BYTE = 4;
        final pairsUsed = fractionOfByteUsed * 4;
        // store number of pairs not used in the byte
        file.add(PAIRS_PER_BYTE - pairsUsed.toInt());
        
        // write the number of rows in the charMapTable
        final numCharMapTableRows = (charMapTable.length / CHAR_MAP_ROW_LEN).toInt();
        writeShort(numCharMapTableRows);

        // write the charMap table
        // write charCodes
        for (var i = 0; i < numCharMapTableRows; i++) {
            writeCharCode(charMapTable[i]);
        }
        // write glyphIndexes1
        for (var i = 0; i < numCharMapTableRows; i++) {
            writeCharCode(charMapTable[numCharMapTableRows + i]);
        }
        // write glyphIndexes2
        for (var i = 0; i < numCharMapTableRows; i++) {
            writeCharCode(charMapTable[numCharMapTableRows*2 + i]);
        }
        // write glyph widths
        for (var i = 0; i < numCharMapTableRows; i++) {
            file.add(charMapTable[numCharMapTableRows*3 + i]);
        }
        
        // glyphs len
        writeShort(this.glyphs.length);
        
        // store how many bytes are required to store the commands
        writeShort((allCmdsBin.length / 8).ceil());
        
        // write all commands to file as bytes
        // pad end of last byte with 0's if the binary commands
        // are not a width that is a multiple of 8 bits
        {var i = 0; while (i < allCmdsBin.length) {
            final slc = allCmdsBin.substring(i, i + 8).padRight(8, "0");
            file.add(int.parse(slc, radix: 2));
            i += 8;
        }}
        
        // loop through all glyphs
        for (var i = 0; i < intermediate.length; i += 2) {
            final params = intermediate[i+1];
            // loop through the vector points for each glyph
            for (var j = 0; j < params.length; j += 2) {
                // map each x and y coord between the min and
                // max x and y coordinates of all glyph vector points
                // then write the x and y coords to the file
                file.add((map(params[j], pXMin, pXMax, 0, 255)).round());
                file.add((map(params[j+1], pYMin, pYMax, 0, 255)).round());
            }
        }
        
        // write kern min/max
        if (minKern == double.infinity) {
            writeFloat(0);
            writeFloat(0);
        } else {
            writeFloat(minKern);
            writeFloat(maxKern);
        }

        // write the number of kern tables
        file.add(kernTableCount);

        // loop through all kern tables
        for (final kernVal in kernTables.keys) {
            final table = kernTables[kernVal] as List<List<String>>;
            final mappedKernVal = (map(kernVal, minKern, maxKern, 0, 255)).round();
            
            // write number of table rows
            file.add(table.length);
            
            // write kern amount
            file.add(mappedKernVal);
            
            // write pairs by a column at a time
            for (var i = 0; i < table.length; i++) {
                writeCharCode(table[i][0].codeUnitAt(0));
            }
            for (var i = 0; i < table.length; i++) {
                writeCharCode(table[i][1].codeUnitAt(0));
            }
        }
        
        // verify that the file only contains bytes
        for (var i = 0; i < file.length; i++) {
            if (file[i] < 0 || file[i] > 255) {
                print("QOFont.toBytes --- byte overflow $i, ${file[i]}");
            }
        }
        
        return file;
    }

    GlyphInfo glyphInfo(int charCode) {
        final info = this.characterMap[charCode];
        if (info != null) {
            return GlyphInfo(info[0].toInt(), info[1].toInt(), info[2]);
        }
        return GlyphInfo(0, 0, 1);
    }
}

class BoundingBox {
    late double minX;
    late double maxX;
    late double minY;
    late double maxY;
    BoundingBox(this.minX, this.maxX, this.minY, this.maxY);
}

// https://iquilezles.org/articles/bezierbbox/
BoundingBox bboxBezier(double p0x, double p0y, double p1x, double p1y, double p2x, double p2y) {
    var miX = Math.min(p0x, p2x);
    var miY = Math.min(p0y, p2y);
    var maX = Math.max(p0x, p2x);
    var maY = Math.max(p0y, p2y);
    
    if (p1x < miX || p1x > maX || p1y < miY || p1y > maY) {
        final tx = constrain((p0x-p1x)/(p0x-2.0*p1x+p2x), 0.0, 1.0);
        final ty = constrain((p0y-p1y)/(p0y-2.0*p1y+p2y), 0.0, 1.0);
        final sx = 1.0 - tx;
        final sy = 1.0 - ty;
        final qx = sx*sx*p0x + 2.0*sx*tx*p1x + tx*tx*p2x;
        final qy = sy*sy*p0y + 2.0*sy*ty*p1y + ty*ty*p2y;
        miX = Math.min(miX, qx);
        miY = Math.min(miY, qy);
        maX = Math.max(maX, qx);
        maY = Math.max(maY, qy);
    }
    
    return BoundingBox(miX, maX, miY, maY);
}

class TextMetrics {
    late double fontWidth;
    late double actualBoundingBoxLeft;
    late double actualBoundingBoxRight;
    late double actualBoundingBoxAscent;
    late double actualBoundingBoxDescent;
    late double fontBoundingBoxAscent;
    late double fontBoundingBoxDescent;
    late double actualWidth;
    late double actualHeight;

    TextMetrics({
        required double fontWidth,
        required double actualBoundingBoxLeft,
        required double actualBoundingBoxRight,
        required double actualBoundingBoxAscent,
        required double actualBoundingBoxDescent,
        required double fontBoundingBoxAscent,
        required double fontBoundingBoxDescent,
        required double actualWidth,
        required double actualHeight,
    }) {
        this.fontWidth = fontWidth;
        this.actualBoundingBoxLeft = actualBoundingBoxLeft;
        this.actualBoundingBoxRight = actualBoundingBoxRight;
        this.actualBoundingBoxAscent = actualBoundingBoxAscent;
        this.actualBoundingBoxDescent = actualBoundingBoxDescent;
        this.fontBoundingBoxAscent = fontBoundingBoxAscent;
        this.fontBoundingBoxDescent = fontBoundingBoxDescent;
        this.actualWidth = actualWidth;
        this.actualHeight = actualHeight;
    }
}

TextMetrics measureText(txt, myFont, sz) {
    // stores the "theoretical" width of the text
    // theoretical because some glyphs do not take up the full width they are given
    // and other glyphs extend outside of the width they are given
    var fontWidth = 0.0;

    // how many pixels left of the origin does the text protrude
    var offX = 0.0;
    // how many pixels of padding does the rightmost glyph have from 
    // the right edge of the theoretical width box
    var endOffX = 0.0;
    // stores the highest (least) y coord of the rendered text relative to origin
    var offY = double.infinity;
    // stores the lowest (greatest) y coord of the rendered text relative to origin
    var offEndY = 0.0;
    
    final spaceRenderWidth = myFont.glyphInfo(32).width * sz;
    
    for (var t = 0; t < txt.length; t++) {
        if (txt[t] == "\n") {
            continue;
        }
        final glyphInfo = myFont.glyphInfo(txt.codeUnitAt(t));
        final glyph = myFont.glyphs[glyphInfo.index1];

        // store the bounding box of the glyph
        var minX = double.infinity;
        var maxX = -1.0;
        var minY = double.infinity;
        var maxY = -1.0;
        
        // process glyph
        var i = 0;
        var lastVertX = 0.0;
        var lastVertY = 0.0;
        while (i < glyph.length) {
            var shape = glyph[i];
            if (shape == HOLE) {
                i++;
                shape = glyph[i];
            }
            
            if (shape == VERT) {
                final xPos = glyph[i+1] * sz;
                final yPos = glyph[i+2] * sz;
                
                // compute min and max of vertex
                if (xPos < minX) {
                    minX = xPos;
                }
                if (xPos > maxX) {
                    maxX = xPos;
                }
                if (yPos < minY) {
                    minY = yPos;
                }
                if (yPos > maxY) {
                    maxY = yPos;
                }

                lastVertX = xPos;
                lastVertY = yPos;

                i += 3;
            } else if (shape == QUAD) {
                final cpxPos = glyph[i+1] * sz;
                final cpyPos = glyph[i+2] * sz;
                final xPos = glyph[i+3] * sz;
                final yPos = glyph[i+4] * sz;
                
                final bounds = bboxBezier(lastVertX, lastVertY, cpxPos, cpyPos, xPos, yPos);
                
                // compute min and max of vertex
                if (bounds.minX < minX) {
                    minX = bounds.minX;
                }
                if (bounds.maxX > maxX) {
                    maxX = bounds.maxX;
                }
                if (bounds.minY < minY) {
                    minY = bounds.minY;
                }
                if (bounds.maxY > maxY) {
                    maxY = bounds.maxY;
                }

                lastVertX = xPos;
                lastVertY = yPos;
                
                i += 5;
            }
        }
        
        // add scaled glyph width to theoretical width
        final renderWidth = glyphInfo.width * sz;
        fontWidth += renderWidth;
        
        // accumulate y min and maxes
        if (minY != double.infinity && minY < offY) {
            offY = minY;
        }
        if (maxY != -1 && maxY > offEndY) {
            offEndY = maxY;
        }
        
        // store left most glyphs minX
        if (t == 0) {
            offX = minX;
        }

        // store padding of rightmost glyph
        if (txt[t] != " ") {
            endOffX = renderWidth - maxX;
        } else {
            // add the width of whitespace
            endOffX += spaceRenderWidth;
        }
    }
    
    // compute scaled ascent and descent
    final ascent = myFont.ascent * sz;
    final descent = myFont.descent * sz;

    final actualBoundingBoxLeft = offX == double.infinity ? 0.0 : offX;
    final actualBoundingBoxRight = endOffX == double.negativeInfinity ? 0.0 : fontWidth - endOffX;
    final actualBoundingBoxAscent = -offY;
    final actualBoundingBoxDescent = offEndY;

    // return font metrics
    return TextMetrics(
        fontWidth: fontWidth,
        actualBoundingBoxLeft: actualBoundingBoxLeft,
        actualBoundingBoxRight: actualBoundingBoxRight,
        actualBoundingBoxAscent: actualBoundingBoxAscent,
        actualBoundingBoxDescent: actualBoundingBoxDescent,
        fontBoundingBoxAscent: ascent,
        fontBoundingBoxDescent: descent,
        actualWidth: actualBoundingBoxRight - actualBoundingBoxLeft,
        actualHeight: actualBoundingBoxAscent + actualBoundingBoxDescent
    );
}

typedef Font = QOFont;
