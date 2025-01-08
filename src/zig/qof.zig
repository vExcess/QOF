// NON FUNCTIONAL - DO NOT USE!

const std = @import("std");

const vexlib = @import("./vexlib.zig");
const Math = vexlib.Math;
const As = vexlib.As;
const Map = vexlib.Map;
const Array = vexlib.Array;
const Uint8Array = vexlib.Uint8Array;
const Float32Array = vexlib.Float32Array;
const String = vexlib.String;
const Int = vexlib.Int;
const Float = vexlib.Float;

pub const VERT = 0;
pub const QUAD = 1;
pub const HOLE = 2;

const FLOAT_SIZE = 3;
const pow2_8 = Math.pow(2, 16);
// encode a float into 3 bytes
fn encodeFloat(n: f64) [3]u8 {
    const neg = n < 0;
    n = Math.abs(n);
    var sig = 0;
    while (n > 1) {
        n /= 2;
        sig += 1;
    }
    const val = (n * pow2_8).toInt();
    return [_]u8{ sig | (if (neg) 128 else 0), val >> 8, val & 255 };
}
// decode 3 bytes into a float
fn decodeFloat(bytes: [3]u8) f64 {
    return As.f64(As.u32(bytes[1] << As.u32(8)) | As.u32(bytes[2])) / As.f64(pow2_8) * Math.pow(As.f64(2), As.f64(As.u32(bytes[0]) & As.u32(127))) * (if (bytes[0] > 127) As.f64(-1) else As.f64(1));
}

fn sortKerningRows(arr: Array(Array(String))) Array(Array(String)) {
    var row1Chars = {};
    var row2Chars = {};
    var i = 0;
    while (i < arr.length) : (i += 1) {
        row1Chars[arr[i][0]] = 0;
        row2Chars[arr[i][1]] = 0;
    }
    if (row1Chars.keys.length < row2Chars.keys.length) {
        // arr.sort((a, b) { return a[0].charCodeAt(0) - b[0].charCodeAt(0); });
    } else {
        // arr.sort((a, b) { return a[1].charCodeAt(0) - b[1].charCodeAt(0); });
    }
    return arr;
}

const GlyphInfo = struct { index1: i32, index2: i32, width: f64 };

fn decodeFloatAndMoveDecodePtr(bytes: *const Uint8Array, idx: *usize) f64 {
    const buff3 = [3]u8{ bytes.get(As.u32(idx.*)), bytes.get(As.u32(idx.* + 1)), bytes.get(As.u32(idx.* + 2)) };
    const float = decodeFloat(buff3);
    idx.* += FLOAT_SIZE;
    return float;
}

fn decodeShortAndMovePtr(bytes: *const Uint8Array, idx: *usize) u16 {
    const val = As.u16((As.u32(bytes.get(As.u32(idx.*))) << As.u32(8)) | As.u32(As.u32(bytes.get(As.u32(idx.* + As.u32(1)))) + As.u32(1)));
    idx.* += 2;
    return val;
}

fn decodeCharCodeAndMoveDecodePtr(bytes: *const Uint8Array, idx: *usize) u16 {
    if (bytes.get(idx) < 128) {
        const val = bytes.get(As.u32(idx.*));
        idx.* += 1;
        return val;
    } else {
        const val = ((bytes.get(As.u32(idx.*)) & (Math.pow(2, 7) - 1)) << 8) | bytes.get(As.u32(idx.*) + 1);
        idx.* += 2;
        return val;
    }
}

fn writeFloat(file: *Uint8Array, num: f64) void {
    const bytes = encodeFloat(num);
    file.append(bytes[0]);
    file.append(bytes[1]);
    file.append(bytes[2]);
}

fn writeShort(file: *Uint8Array, num: u16) void {
    // store short in big endian
    file.append(num >> 8);
    file.append(num & (Math.pow(2, 8) - 1));
}

fn writeCharCode(file: *Uint8Array, num: u16) void {
    // store code in big endian
    if (num < 128) {
        file.add(num);
    } else {
        file.append((num >> 8) | 128);
        file.append(num & (Math.pow(2, 8) - 1));
    }
}

pub const QOFont = struct {
    name: String = undefined,
    version: i32 = 0,
    ascent: f64 = 0,
    descent: f64 = 0,
    glyphs: Array(Array(f64)) = undefined,
    characterMap: Map(i32, Array(f64)) = undefined,
    kerning: Map(String, f64) = undefined,
    weight: i32 = 400,
    italic: bool = false,

    pub fn fromBytes(bytes: []u8) QOFont {
        var idx: usize = 3;

        // len and version are in the same byte
        const nameLen = bytes[idx] & (Math.pow(2, 6) - 1);
        const version = bytes[idx] >> 6;
        idx += 1;

        // read name
        var name = String.alloc(nameLen);
        var i: u32 = 0;
        while (i < nameLen) : (i += 1) {
            name.concat(bytes[idx]);
            idx += 1;
        }

        const italicWeight = bytes[idx];
        idx += 1;
        const weight = (italicWeight & (Math.pow(2, 7) - 1)) * 100;
        const italic = italicWeight >> 7 == 1;

        // font ascent and descent
        const ascent = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);
        const descent = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);

        // min and max character width
        const minW = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);
        const maxW = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);

        // min and max vector x coordinate
        const pXMin = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);
        const pXMax = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);

        // min and max vector y coordinate
        const pYMin = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);
        const pYMax = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);

        // the padding of the last byte of the commands section
        const cmdPad = bytes[idx];
        idx += 1;

        // the number of rows in the character map table
        const charMapNumRows = decodeShortAndMovePtr(&Uint8Array.using(bytes), &idx);

        // decode character map table
        var characterMap: Map(i32, Array(f64)) = {};
        var charCodes: Array(u32) = Array(u32).alloc(128);
        var glyphIndexes1: Array(u32) = Array(u32).alloc(128);
        var glyphIndexes2: Array(u32) = Array(u32).alloc(128);
        var glyphWidths: Array(f64) = Array(f64).alloc(128);
        while (charCodes.length < charMapNumRows) {
            charCodes.add(decodeCharCodeAndMoveDecodePtr(&Uint8Array.using(bytes), &idx));
        }
        while (glyphIndexes1.length < charMapNumRows) {
            glyphIndexes1.add(decodeCharCodeAndMoveDecodePtr(&Uint8Array.using(bytes), &idx));
        }
        while (glyphIndexes2.length < charMapNumRows) {
            glyphIndexes2.add(decodeCharCodeAndMoveDecodePtr(&Uint8Array.using(bytes), &idx));
        }
        while (glyphWidths.length < charMapNumRows) {
            glyphWidths.add(minW + bytes.get(idx) / 255 * (maxW - minW));
            idx += 1;
        }
        i = 0;
        while (i < charMapNumRows) : (i += 1) {
            characterMap[charCodes[i]] = [3]f64{ As.f64(glyphIndexes1[i]), As.f64(glyphIndexes2[i]), glyphWidths[i] };
        }

        // get the number of glyphs in the font
        // const glyphsLen = decodeShortAndMovePtr(&Uint8Array.using(bytes), &idx);

        // array the store all glyphs
        var glyphs: Array(Array(f64)) = Array(Array(f64)).alloc(128);
        // array that stores the glyph currently being decoded
        var currGlyph: Array(f64) = Array(f64).alloc(16);
        // how many bytes the commands section occupies
        const endOff = decodeShortAndMovePtr(&Uint8Array.using(bytes), &idx);
        // store index of start of glyph data
        const startI = idx;
        // idx will store the index of the current commands being decoded
        // pIdx stores the index of the parameters for the current command being decoded
        const pStartIdx = startI + endOff;
        var pIdx = pStartIdx;
        const GLYPH_SEPERATOR = 3; // glyphs are seperated by binary 11
        const PAIRS_PER_BYTE = 4;
        var counter = 0;
        while (idx < pStartIdx) {
            // decode each byte into 4 potential commands
            // potential because some could be padding
            const seg = [_]u8{ bytes[idx] >> 6, (bytes[idx] >> 4) & 3, (bytes[idx] >> 2) & 3, bytes[idx] & 3 };
            // if we've reached the end of the glyphs data and the padding isn't a whole byte
            // set the pad to the commandPadding instead of 0
            const pad = idx == pStartIdx - 1 and if (cmdPad != PAIRS_PER_BYTE) cmdPad else 0;
            // loop through all potential commands except the ones that are padding
            var j = 0;
            while (j < seg.length - pad) : (j += 1) {
                if (seg[j] == GLYPH_SEPERATOR) {
                    // if the command is a glyph seperator store the
                    // current glyph and create a new array for the next glyph
                    glyphs.add(currGlyph);
                    currGlyph = Array(f64).alloc(16);
                } else {
                    // push the command to the glyph data
                    currGlyph.add(As.f64(seg[j]));
                    // push the relevant paramters to the glyph data
                    // unmap the vertex coordinates from a byte to their original range
                    if (seg[j] == VERT) {
                        const a = Math.map(bytes.get(pIdx), 0, 255, pXMin, pXMax);
                        pIdx += 1;
                        const b = Math.map(bytes.get(pIdx), 0, 255, pYMin, pYMax);
                        pIdx += 1;
                        counter += 2;
                        currGlyph.append(a);
                        currGlyph.append(b);
                    } else if (seg[j] == QUAD) {
                        const a = Math.map(bytes.get(pIdx), 0, 255, pXMin, pXMax);
                        pIdx += 1;
                        const b = Math.map(bytes.get(pIdx), 0, 255, pYMin, pYMax);
                        pIdx += 1;
                        const c = Math.map(bytes.get(pIdx), 0, 255, pXMin, pXMax);
                        pIdx += 1;
                        const d = Math.map(bytes.get(pIdx), 0, 255, pYMin, pYMax);
                        pIdx += 1;
                        counter += 4;
                        currGlyph.append(a);
                        currGlyph.append(b);
                        currGlyph.append(c);
                        currGlyph.append(d);
                    }
                }
            }
            idx += 1;
        }

        var kerning: Map(String, f64) = Map(String, f64).alloc();

        idx = pIdx;
        const minKern = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);
        const maxKern = decodeFloatAndMoveDecodePtr(&Uint8Array.using(bytes), &idx);

        const numKernTables = bytes.get(idx);
        idx += 1;
        i = 0;
        while (i < numKernTables) : (i += 1) {
            const numRows = bytes.get(idx);
            idx += 1;
            const kernAmount = Math.map(bytes.get(idx), 0, 255, minKern, maxKern);
            idx += 1;
            var ch1s = Array(String).alloc(numRows);
            var j = 0;
            while (j < numRows) : (j += 1) {
                ch1s[j] = String.allocFrom(decodeCharCodeAndMoveDecodePtr(&Uint8Array.using(bytes), &idx));
            }
            j = 0;
            while (j < numRows) : (j += 1) {
                const ch2 = String.allocFrom(decodeCharCodeAndMoveDecodePtr(&Uint8Array.using(bytes), &idx));
                kerning[ch1s[j] + ch2] = kernAmount;
            }
        }

        return QOFont{
            .name = name,
            .weight = weight,
            .italic = italic,
            .version = version,
            .ascent = ascent,
            .descent = descent,
            .glyphs = glyphs,
            .characterMap = characterMap,
            .kerning = kerning,
        };
    }

    pub fn toBytes(self: *QOFont) Uint8Array {
        // stores min and max x and y coordinates of glyph vector points
        var pXMin = Math.Infinity(f64);
        var pXMax = -Math.Infinity(f64);
        var pYMin = Math.Infinity(f64);
        var pYMax = -Math.Infinity(f64);

        // stores glyphs as pairs of commands and parameters
        // [commands, parameters, commands, parameters, ...]
        var intermediate = Array(Array(f64)).alloc(0);

        // loop through all glyphs
        var g = 0;
        while (g < self.glyphs.length) : (g += 1) {
            const glyph = self.glyphs[g];

            // commands and parameters for each glyph
            var commands = Array(f64).alloc(2);
            var parameters = Array(f64).alloc(2);

            // loop through glyph data
            {
                var i = 0;
                while (i < glyph.length) {
                    var shape = glyph[i];

                    // if shape is hole, add it to commands, and move to next item
                    if (shape == HOLE) {
                        commands.add(HOLE);
                        i += 1;
                        shape = glyph[i];
                    }

                    // split shape into command and parameters
                    commands.add(shape);
                    if (shape == VERT) {
                        parameters.append(glyph[i + 1]);
                        parameters.append(glyph[i + 2]);
                        i += 3;
                    } else if (shape == QUAD) {
                        parameters.append(glyph[i + 1]);
                        parameters.append(glyph[i + 2]);
                        parameters.append(glyph[i + 3]);
                        parameters.append(glyph[i + 4]);
                        i += 5;
                    }
                }
            }

            // find the min and max of parameters (glyph vector points)
            var j = 0;
            while (j < parameters.length) : (j += 2) {
                const xPos = parameters[j];
                const yPos = parameters[j + 1];
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
            intermediate.append(commands);
            intermediate.append(parameters);
        }

        // bitpack all commands into a binary string
        var allCmdsBin = String.alloc(0);
        // loop through all glyph commands
        var i = 0;
        while (i < intermediate.length) : (i += 2) {
            const cmds = intermediate[i];
            // append the commands for each glyph as pairs of bits
            var j = 0;
            while (j < cmds.length) : (j += 1) {
                allCmdsBin.append(cmds[j].toString(2).padStart(2, "0"));
            }
            // seperate glyph commands with 11
            allCmdsBin.append("11");
        }

        // flattens character map into an array
        const CHAR_MAP_ROW_LEN = 4;
        var charMapTable = Array(f64).alloc(self.characterMap.keys.len * 4);
        var minW = Math.Infinity(f64);
        var maxW = 0.0;
        // loop through each character code in the characterMap
        i = 0;
        while (i < self.characterMap.keys.len) : (i += 1) {
            const chCode = self.characterMap.keys.get(i);
            const glyphInfo_inner = self.glyphInfo(chCode);
            // store the data in the flat array
            charMapTable.append(As.f64(chCode));
            charMapTable.append(As.f64(glyphInfo_inner.index1));
            charMapTable.append(As.f64(glyphInfo_inner.index2));
            charMapTable.append(glyphInfo_inner.width);

            // calculate the min and max width of the characters
            if (glyphInfo_inner.width < minW) {
                minW = glyphInfo_inner.width;
            }
            if (glyphInfo_inner.width > maxW) {
                maxW = glyphInfo_inner.width;
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
        var reOrderedTable = Array(f64).alloc(charMapTable.len);
        i = 0;
        while (i < charMapTable.length) : (i += CHAR_MAP_ROW_LEN) {
            reOrderedTable.add(charMapTable[i]);
        }
        i = 1;
        while (i < charMapTable.length) : (i += CHAR_MAP_ROW_LEN) {
            reOrderedTable.add(charMapTable[i]);
        }
        i = 2;
        while (i < charMapTable.length) : (i += CHAR_MAP_ROW_LEN) {
            reOrderedTable.add(charMapTable[i]);
        }
        i = 3;
        while (i < charMapTable.length) : (i += CHAR_MAP_ROW_LEN) {
            reOrderedTable.add((Math.map(charMapTable[i], minW, maxW, 0, 255)).round());
        }
        charMapTable = reOrderedTable;

        // reorder {"${char1}${char2}": kernValue} to {kernValue: [[char1, char2], ...]}
        var kernTables: Map(f64, Array([2]String)) = {};
        i = 0;
        while (i < self.kerning.keys.len) : (i += 1) {
            const pair = self.kerning.keys.get(i);
            const val = self.kerning[pair];
            if (kernTables[val] == null)
                kernTables[val] = Array([2]String).alloc(2);
            kernTables[val].?.append(pair[0]);
            kernTables[val].?.append(pair[1]);
        }

        var maxKern = -Math.Infinity(f64);
        var minKern = Math.Infinity(f64);
        var kernCharFreq = {};
        var kernTableCount = 0;
        var j = 0;
        while (j < self.kernTables.keys.len) : (j += 1) {
            const kernValStr = self.kernTables.keys.get(j);
            // sort kern tables for maximum compressability
            const kernTable = sortKerningRows(kernTables[kernValStr]);

            // sum character frequency
            i = 0;
            while (i < kernTable.length) : (i += 1) {
                const ch1 = kernTable[i][0];
                if (!kernCharFreq[ch1]) {
                    kernCharFreq[ch1] = 1;
                } else {
                    kernCharFreq[ch1] += 1;
                }
                const ch2 = kernTable[i][1];
                if (!kernCharFreq[ch2]) {
                    kernCharFreq[ch2] = 1;
                } else {
                    kernCharFreq[ch2] += 1;
                }
            }

            // find min and max kern
            const kernVal = kernValStr;
            if (kernVal > maxKern)
                maxKern = kernVal;
            if (kernVal < minKern)
                minKern = kernVal;

            // count number of kern tables
            kernTableCount += 1;
        }

        // start file with the code points for "QOF"
        var file = Uint8Array.alloc(2048);
        file.append(81);
        file.append(79);
        file.append(70);

        // write font version and font name
        const nameLen = Math.min(63, self.name.length);
        file.add((self.version << 6) | nameLen);
        i = 0;
        while (i < nameLen) : (i += 1) {
            file.add(self.name[i].charCodeAt(0));
        }

        // write weight and italic flag
        file.add((self.weight / 100).round() | ((if (self.italic) 1 else 0) << 7));

        // ascent
        writeFloat(&file, self.ascent);
        // descent
        writeFloat(&file, self.descent);

        // min width
        writeFloat(&file, minW);
        // max width
        writeFloat(&file, maxW);

        // param x min
        writeFloat(&file, pXMin);
        // param x max
        writeFloat(&file, pXMax);

        // param y min
        writeFloat(&file, pYMin);
        // param y max
        writeFloat(&file, pYMax);

        // store the padding of the last byte of the stored commands
        const fr = allCmdsBin.length / 8;
        const fractionOfByteUsed = fr - fr.toInt();
        const PAIRS_PER_BYTE = 4;
        const pairsUsed = fractionOfByteUsed * 4;
        // store number of pairs not used in the byte
        file.add(PAIRS_PER_BYTE - pairsUsed.toInt());

        // write the number of rows in the charMapTable
        const numCharMapTableRows = (charMapTable.length / CHAR_MAP_ROW_LEN).toInt();
        writeShort(&file, numCharMapTableRows);

        // write the charMap table
        // write charCodes
        i = 0;
        while (i < numCharMapTableRows) : (i += 1) {
            writeCharCode(&file, charMapTable[i]);
        }
        // write glyphIndexes1
        i = 0;
        while (i < numCharMapTableRows) : (i += 1) {
            writeCharCode(&file, charMapTable[numCharMapTableRows + i]);
        }
        // write glyphIndexes2
        i = 0;
        while (i < numCharMapTableRows) : (i += 1) {
            writeCharCode(&file, charMapTable[numCharMapTableRows * 2 + i]);
        }
        // write glyph widths
        i = 0;
        while (i < numCharMapTableRows) : (i += 1) {
            file.add(charMapTable[numCharMapTableRows * 3 + i]);
        }

        // glyphs len
        writeShort(&file, self.glyphs.length);

        // store how many bytes are required to store the commands
        writeShort(&file, (allCmdsBin.length / 8).ceil());

        // write all commands to file as bytes
        // pad end of last byte with 0's if the binary commands
        // are not a width that is a multiple of 8 bits
        {
            i = 0;
            while (i < allCmdsBin.length) {
                const slc = allCmdsBin.slice(i, i + 8).padRight(8, "0");
                file.add(Int.parse(slc, 2));
                i += 8;
            }
        }

        // loop through all glyphs
        i = 0;
        while (i < intermediate.length) : (i += 2) {
            const params = intermediate[i + 1];
            // loop through the vector points for each glyph
            j = 0;
            while (j < params.length) : (j += 2) {
                // map each x and y coord between the min and
                // max x and y coordinates of all glyph vector points
                // then write the x and y coords to the file
                file.add(Math.round(Math.map(params[j], pXMin, pXMax, 0, 255)));
                file.add(Math.round(Math.map(params[j + 1], pYMin, pYMax, 0, 255)));
            }
        }

        // write kern min/max
        if (minKern == Math.Infinity(f64)) {
            writeFloat(0);
            writeFloat(0);
        } else {
            writeFloat(minKern);
            writeFloat(maxKern);
        }

        // write the number of kern tables
        file.add(kernTableCount);

        // loop through all kern tables
        j = 0;
        while (j < self.kernTables.keys.len) : (j += 1) {
            const kernVal = self.kernTables.keys.get(j);

            const table = kernTables[kernVal];
            const mappedKernVal = (Math.map(kernVal, minKern, maxKern, 0, 255)).round();

            // write number of table rows
            file.add(table.length);

            // write kern amount
            file.add(mappedKernVal);

            // write pairs by a column at a time
            i = 0;
            while (i < table.length) : (i += 1) {
                writeCharCode(table[i][0].charCodeAt(0));
            }
            i = 0;
            while (i < table.length) : (i += 1) {
                writeCharCode(table[i][1].charCodeAt(0));
            }
        }

        // verify that the file only contains bytes
        i = 0;
        while (i < file.length) : (i += 1) {
            if (file[i] < 0 or file[i] > 255) {
                @panic("QOFont.toBytes --- byte overflow $i, ${file[i]}");
            }
        }

        return file;
    }

    fn glyphInfo(self: *QOFont, charCode: i32) GlyphInfo {
        const info = self.characterMap[charCode];
        if (info != null) {
            return GlyphInfo(info[0].toInt(), info[1].toInt(), info[2]);
        }
        return GlyphInfo(0, 0, 1);
    }
};

const BoundingBox = struct {
    minX: f64,
    maxX: f64,
    minY: f64,
    maxY: f64,
};

// https://iquilezles.org/articles/bezierbbox/
fn bboxBezier(p0x: f64, p0y: f64, p1x: f64, p1y: f64, p2x: f64, p2y: f64) BoundingBox {
    var miX = Math.min(p0x, p2x);
    var miY = Math.min(p0y, p2y);
    var maX = Math.max(p0x, p2x);
    var maY = Math.max(p0y, p2y);

    if (p1x < miX or p1x > maX or p1y < miY or p1y > maY) {
        const tx = Math.constrain((p0x - p1x) / (p0x - 2.0 * p1x + p2x), 0.0, 1.0);
        const ty = Math.constrain((p0y - p1y) / (p0y - 2.0 * p1y + p2y), 0.0, 1.0);
        const sx = 1.0 - tx;
        const sy = 1.0 - ty;
        const qx = sx * sx * p0x + 2.0 * sx * tx * p1x + tx * tx * p2x;
        const qy = sy * sy * p0y + 2.0 * sy * ty * p1y + ty * ty * p2y;
        miX = Math.min(miX, qx);
        miY = Math.min(miY, qy);
        maX = Math.max(maX, qx);
        maY = Math.max(maY, qy);
    }

    return BoundingBox(miX, maX, miY, maY);
}

const TextMetrics = struct {
    fontWidth: f64,
    actualBoundingBoxLeft: f64,
    actualBoundingBoxRight: f64,
    actualBoundingBoxAscent: f64,
    actualBoundingBoxDescent: f64,
    fontBoundingBoxAscent: f64,
    fontBoundingBoxDescent: f64,
    actualWidth: f64,
    actualHeight: f64,
};

pub fn measureText(txt: String, myFont: QOFont, sz: i32) TextMetrics {
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
    var offY = Math.Infinity(f64);
    // stores the lowest (greatest) y coord of the rendered text relative to origin
    var offEndY = 0.0;

    const spaceRenderWidth = myFont.glyphInfo(32).width * sz;

    var t = 0;
    while (t < txt.length) : (t += 1) {
        if (txt.charAt(t) == '\n') {
            continue;
        }
        const glyphInfo = myFont.glyphInfo(txt.charCodeAt(t));
        const glyph = myFont.glyphs[glyphInfo.index1];

        // store the bounding box of the glyph
        var minX = Math.Infinity(f64);
        var maxX = -1.0;
        var minY = Math.Infinity(f64);
        var maxY = -1.0;

        // process glyph
        var i = 0;
        var lastVertX = 0.0;
        var lastVertY = 0.0;
        while (i < glyph.length) {
            var shape = glyph[i];
            if (shape == HOLE) {
                i += 1;
                shape = glyph[i];
            }

            if (shape == VERT) {
                const xPos = glyph[i + 1] * sz;
                const yPos = glyph[i + 2] * sz;

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
                const cpxPos = glyph[i + 1] * sz;
                const cpyPos = glyph[i + 2] * sz;
                const xPos = glyph[i + 3] * sz;
                const yPos = glyph[i + 4] * sz;

                const bounds = bboxBezier(lastVertX, lastVertY, cpxPos, cpyPos, xPos, yPos);

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
        const renderWidth = glyphInfo.width * sz;
        fontWidth += renderWidth;

        // accumulate y min and maxes
        if (minY != Math.Infinity(f64) and minY < offY) {
            offY = minY;
        }
        if (maxY != -1 and maxY > offEndY) {
            offEndY = maxY;
        }

        // store left most glyphs minX
        if (t == 0) {
            offX = minX;
        }

        // store padding of rightmost glyph
        if (txt.charAt(t) != ' ') {
            endOffX = renderWidth - maxX;
        } else {
            // add the width of whitespace
            endOffX += spaceRenderWidth;
        }
    }

    // compute scaled ascent and descent
    const ascent = myFont.ascent * sz;
    const descent = myFont.descent * sz;

    const actualBoundingBoxLeft = if (offX == Math.Infinity(f64)) 0.0 else offX;
    const actualBoundingBoxRight = if (endOffX == -Math.Infinity(f64)) 0.0 else fontWidth - endOffX;
    const actualBoundingBoxAscent = -offY;
    const actualBoundingBoxDescent = offEndY;

    // return font metrics
    return TextMetrics{ .fontWidth = fontWidth, .actualBoundingBoxLeft = actualBoundingBoxLeft, .actualBoundingBoxRight = actualBoundingBoxRight, .actualBoundingBoxAscent = actualBoundingBoxAscent, .actualBoundingBoxDescent = actualBoundingBoxDescent, .fontBoundingBoxAscent = ascent, .fontBoundingBoxDescent = descent, .actualWidth = actualBoundingBoxRight - actualBoundingBoxLeft, .actualHeight = actualBoundingBoxAscent + actualBoundingBoxDescent };
}

pub const Font = QOFont;
