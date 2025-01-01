var QOF;
{
    const VERT = 0;
    const QUAD = 1;
    const HOLE = 2;

    const FLOAT_SIZE = 3;
    const pow2_8 = Math.pow(2, 16);
    // encode a float into 3 bytes
    function encodeFloat(n) {
        let neg = n < 0;
        n = Math.abs(n);
        let sig = 0;
        while (n > 1) {
            n /= 2;
            sig++;
        }
        let val = n * pow2_8 | 0;
        return [sig | (neg ? 128 : 0), val >> 8, val & 255];
    }
    // decode 3 bytes into a float
    function decodeFloat(bytes) {
        return ((bytes[1] << 8) | bytes[2]) / pow2_8 * Math.pow(2, bytes[0] & 127) * (bytes[0] > 127 ? -1 : 1);
    }

    function map(v, istart, istop, ostart, ostop) {
        return ostart + (ostop - ostart) * ((v - istart) / (istop - istart));
    }

    function constrain(n, mi, ma) {
        if (n < mi)
            return mi;
        if (n > ma)
            return ma;
        return n;
    }

    function sortKerningRows(arr) {
        let row1Chars = {};
        let row2Chars = {};
        for (let i = 0; i < arr.length; i++) {
            row1Chars[arr[i][0]] = 0;
            row2Chars[arr[i][1]] = 0;
        }
        if (Object.keys(row1Chars).length < Object.keys(row2Chars).length) {
            arr = arr.sort((a, b) => a[0].charCodeAt(0) - b[0].charCodeAt(0));
        } else {
            arr = arr.sort((a, b) => a[1].charCodeAt(0) - b[1].charCodeAt(0));
        }
        return arr;
    }

    class QOFont {
        name = "";
        version = 0;
        ascent = 0;
        descent = 0;
        glyphs = [];
        characterMap = {};
        kerning = {};
        weight = 400;
        italic = false;
    
        constructor() {
            
        }
    
        static fromBytes(bytes) {
            let idx = 3;

            // len and version are in the same byte
            const nameLen = bytes[idx] & (2**6-1);
            const version = bytes[idx] >> 6;
            idx++;

            // read name
            let name = "";
            for (let i = 0; i < nameLen; i++) {
                name += String.fromCharCode(bytes[idx++]);
            }

            const italicWeight = bytes[idx++];
            this.weight = (italicWeight & (2**7-1)) * 100;
            this.italic = italicWeight >> 7 === 1;

            function decodeFloatAndMoveDecodePtr() {
                const float = decodeFloat(bytes.slice(idx, idx + FLOAT_SIZE));
                idx += FLOAT_SIZE;
                return  float;
            }

            function decodeShortAndMovePtr() {
                const val = (bytes[idx] << 8) | bytes[idx + 1];
                idx += 2;
                return val;
            }

            function decodeCharCodeAndMoveDecodePtr() {
                if (bytes[idx] < 128) {
                    return bytes[idx++];
                } else {
                    const val = ((bytes[idx] & (2**7-1)) << 8) | bytes[idx + 1];
                    idx += 2;
                    return val;
                }
            }
            
            // font ascent and descent
            const ascent = decodeFloatAndMoveDecodePtr();
            const descent = decodeFloatAndMoveDecodePtr();
        
            // min and max character width
            const minW = decodeFloatAndMoveDecodePtr();
            const maxW = decodeFloatAndMoveDecodePtr();

            // min and max vector x coordinate
            const pXMin = decodeFloatAndMoveDecodePtr();
            const pXMax = decodeFloatAndMoveDecodePtr();

            // min and max vector y coordinate
            const pYMin = decodeFloatAndMoveDecodePtr();
            const pYMax = decodeFloatAndMoveDecodePtr();

            // the padding of the last byte of the commands section
            const cmdPad = bytes[idx++];
            
            // the number of rows in the character map table
            const charMapNumRows = decodeShortAndMovePtr();

            // decode character map table
            let characterMap = {};
            let charCodes = [];
            let glyphIndexes1 = [];
            let glyphIndexes2 = [];
            let glyphWidths = [];
            while (charCodes.length < charMapNumRows) {
                charCodes.push(decodeCharCodeAndMoveDecodePtr());
            }
            while (glyphIndexes1.length < charMapNumRows) {
                glyphIndexes1.push(decodeCharCodeAndMoveDecodePtr());
            }
            while (glyphIndexes2.length < charMapNumRows) {
                glyphIndexes2.push(decodeCharCodeAndMoveDecodePtr());
            }
            while (glyphWidths.length < charMapNumRows) {
                glyphWidths.push(minW + bytes[idx++] / 255 * (maxW - minW));
            }
            for (let i = 0; i < charMapNumRows; i++) {
                characterMap[charCodes[i]] = [glyphIndexes1[i], glyphIndexes2[i], glyphWidths[i]];
            }

            // get the number of glyphs in the font
            const glyphsLen = decodeShortAndMovePtr();

            // array the store all glyphs
            let glyphs = [];
            // array that stores the glyph currently being decoded
            let currGlyph = [];
            // how many bytes the commands section occupies
            const endOff = decodeShortAndMovePtr();
            // store index of start of glyph data
            const startI = idx;
            // idx will store the index of the current commands being decoded
            // pIdx stores the index of the parameters for the current command being decoded
            const pStartIdx = startI + endOff;
            let pIdx = pStartIdx;
            const GLYPH_SEPERATOR = 3; // glyphs are seperated by binary 11
            const PAIRS_PER_BYTE = 4;
            let counter = 0;
            while (idx < pStartIdx) {
                // decode each byte into 4 potential commands
                // potential because some could be padding
                const seg = [
                    bytes[idx] >> 6,
                    (bytes[idx] >> 4) & 3,
                    (bytes[idx] >> 2) & 3,
                    bytes[idx] & 3
                ];
                // if we've reached the end of the glyphs data and the padding isn't a whole byte
                // set the pad to the commandPadding instead of 0
                const pad = idx === pStartIdx-1 && cmdPad !== PAIRS_PER_BYTE ? cmdPad : 0;
                // loop through all potential commands except the ones that are padding
                for (let j = 0; j < seg.length - pad; j++) {
                    if (seg[j] === GLYPH_SEPERATOR) {
                        // if the command is a glyph seperator store the
                        // current glyph and create a new array for the next glyph
                        glyphs.push(currGlyph);
                        currGlyph = [];
                    } else {
                        // push the command to the glyph data
                        currGlyph.push(seg[j]);
                        // push the relevant paramters to the glyph data
                        // unmap the vertex coordinates from a byte to their original range
                        if (seg[j] === VERT) {
                            const a = map(bytes[pIdx++], 0, 255, pXMin, pXMax);
                            const b = map(bytes[pIdx++], 0, 255, pYMin, pYMax);
                            counter +=2;
                            currGlyph.push(a, b);
                        } else if (seg[j] === QUAD) {
                            const a = map(bytes[pIdx++], 0, 255, pXMin, pXMax);
                            const b = map(bytes[pIdx++], 0, 255, pYMin, pYMax);
                            const c = map(bytes[pIdx++], 0, 255, pXMin, pXMax);
                            const d = map(bytes[pIdx++], 0, 255, pYMin, pYMax);
                            counter+=4;
                            currGlyph.push(a, b, c, d);
                        }
                    }
                }
                idx++;
            }

            let kerning = {};

            idx = pIdx;
            const minKern = decodeFloatAndMoveDecodePtr();
            const maxKern = decodeFloatAndMoveDecodePtr();

            const numKernTables = bytes[idx++];
            for (let i = 0; i < numKernTables; i++) {
                const numRows = bytes[idx++];
                const kernAmount = map(bytes[idx++], 0, 255, minKern, maxKern);
                let ch1s = Array(numRows);
                for (let j = 0; j < numRows; j++) {
                    ch1s[j] = String.fromCharCode(decodeCharCodeAndMoveDecodePtr());
                }
                for (let j = 0; j < numRows; j++) {
                    const ch2 = String.fromCharCode(decodeCharCodeAndMoveDecodePtr());
                    kerning[ch1s[j] + ch2] = kernAmount;
                }
            }

            // return the decoded font object
            let outFont = new QOFont();
            outFont.name = name;
            outFont.version = version;
            outFont.ascent = ascent;
            outFont.descent = descent;
            outFont.glyphs = glyphs;
            outFont.characterMap = characterMap;
            outFont.kerning = kerning;
            return outFont;
        }

        toBytes() {
            // stores min and max x and y coordinates of glyph vector points
            let pXMin = Infinity;
            let pXMax = -Infinity;
            let pYMin = Infinity;
            let pYMax = -Infinity;

            // stores glyphs as pairs of commands and parameters
            // [commands, parameters, commands, parameters, ...]
            let intermediate = [];

            // loop through all glyphs
            for (let g = 0; g < this.glyphs.length; g++) {
                const glyph = this.glyphs[g];
                
                // commands and parameters for each glyph
                let commands = [];
                let parameters = [];

                // loop through glyph data
                {let i = 0; while (i < glyph.length) {
                    let shape = glyph[i];

                    // if shape is hole, add it to commands, and move to next item
                    if (shape === HOLE) {
                        commands.push(HOLE);
                        i++;
                        shape = glyph[i];
                    }

                    // split shape into command and parameters
                    commands.push(shape);
                    if (shape === VERT) {
                        parameters.push(glyph[i+1], glyph[i+2]);
                        i += 3;
                    } else if (shape === QUAD) {
                        parameters.push(glyph[i+1], glyph[i+2], glyph[i+3], glyph[i+4]);
                        i += 5;
                    }
                }}
                
                // find the min and max of parameters (glyph vector points)
                for (let j = 0; j < parameters.length; j += 2) {
                    const xPos = parameters[j];
                    const yPos = parameters[j+1];
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
                intermediate.push(commands, parameters);
            }
            
            // bitpack all commands into a binary string
            let allCmdsBin = "";
            // loop through all glyph commands
            for (let i = 0; i < intermediate.length; i += 2) {
                const cmds = intermediate[i];
                // append the commands for each glyph as pairs of bits
                for (let j = 0; j < cmds.length; j++) {
                    allCmdsBin += cmds[j].toString(2).padStart(2, "0");
                }
                // seperate glyph commands with 11
                allCmdsBin += "11";
            }
            
            // flattens character map into an array
            const CHAR_MAP_ROW_LEN = 4;
            let charMapTable = [];
            let minW = Infinity;
            let maxW = 0;
            // loop through each character code in the characterMap
            for (const chCode in this.characterMap) {
                const glyphInfo = this.glyphInfo(chCode);
                // store the data in the flat array
                charMapTable.push(Number(chCode), glyphInfo.index1, glyphInfo.index2, glyphInfo.width);

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
            let reOrderedTable = [];
            for (let i = 0; i < charMapTable.length; i += CHAR_MAP_ROW_LEN) {
                reOrderedTable.push(charMapTable[i]);
            }
            for (let i = 1; i < charMapTable.length; i += CHAR_MAP_ROW_LEN) {
                reOrderedTable.push(charMapTable[i]);
            }
            for (let i = 2; i < charMapTable.length; i += CHAR_MAP_ROW_LEN) {
                reOrderedTable.push(charMapTable[i]);
            }
            for (let i = 3; i < charMapTable.length; i += CHAR_MAP_ROW_LEN) {
                reOrderedTable.push(Math.round(map(charMapTable[i], minW, maxW, 0, 255)));
            }
            charMapTable = reOrderedTable;

            // reorder {"${char1}${char2}": kernValue} to {kernValue: [[char1, char2], ...]}
            let kernTables = {};
            for (const pair in this.kerning) {
                const val = this.kerning[pair];
                if (!kernTables[val])
                    kernTables[val] = [];
                kernTables[val].push([pair[0], pair[1]]);    
            }
           
            let maxKern = -Infinity;
            let minKern = Infinity;
            let kernCharFreq = {};
            let kernTableCount = 0;
            for (const kernValStr in kernTables) {
                // sort kern tables for maximum compressability
                const kernTable = sortKerningRows(kernTables[kernValStr]);

                // sum character frequency
                for (let i = 0; i < kernTable.length; i++) {
                    const ch1 = kernTable[i][0];
                    if (!kernCharFreq[ch1]) {
                        kernCharFreq[ch1] = 1;
                    } else {
                        kernCharFreq[ch1]++;
                    }
                    const ch2 = kernTable[i][1];
                    if (!kernCharFreq[ch2]) {
                        kernCharFreq[ch2] = 1;
                    } else {
                        kernCharFreq[ch2]++;
                    }
                }

                // find min and max kern
                const kernVal = Number(kernValStr);
                if (kernVal > maxKern)
                    maxKern = kernVal;
                if (kernVal < minKern)
                    minKern = kernVal;

                // count number of kern tables
                kernTableCount++;
            }
            
            // start file with the code points for "QOF"
            let file = [81,79,70];

            // write font version and font name
            const nameLen = Math.min(63, this.name.length);
            file.push((this.version << 6) | nameLen);
            for (let i = 0; i < nameLen; i++) {
                file.push(this.name[i].charCodeAt(0));
            }

            // write weight and italic flag
            file.push(Math.round(this.weight / 100) | ((this.italic ? 1 : 0) << 7));

            function writeFloat(num) {
                const bytes = encodeFloat(num);
                file.push(bytes[0], bytes[1], bytes[2]);
            }

            function writeShort(num) {
                // store short in big endian
                file.push(num >> 8, num & (2**8-1));
            }
            
            function writeCharCode(num) {
                // store code in big endian
                if (num < 128) {
                    file.push(num);
                } else {
                    file.push((num >> 8) | 128, num & (2**8-1));
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
            const fr = allCmdsBin.length / 8;
            const fractionOfByteUsed = fr - (fr | 0);
            const PAIRS_PER_BYTE = 4;
            const pairsUsed = fractionOfByteUsed * 4;
            // store number of pairs not used in the byte
            file.push(PAIRS_PER_BYTE - pairsUsed);
            
            // write the number of rows in the charMapTable
            const numCharMapTableRows = charMapTable.length / CHAR_MAP_ROW_LEN;
            writeShort(numCharMapTableRows);

            // write the charMap table
            // write charCodes
            for (let i = 0; i < numCharMapTableRows; i++) {
                writeCharCode(charMapTable[i]);
            }
            // write glyphIndexes1
            for (let i = 0; i < numCharMapTableRows; i++) {
                writeCharCode(charMapTable[numCharMapTableRows + i]);
            }
            // write glyphIndexes2
            for (let i = 0; i < numCharMapTableRows; i++) {
                writeCharCode(charMapTable[numCharMapTableRows*2 + i]);
            }
            // write glyph widths
            for (let i = 0; i < numCharMapTableRows; i++) {
                file.push(charMapTable[numCharMapTableRows*3 + i]);
            }
            
            // glyphs len
            writeShort(this.glyphs.length);
            
            // store how many bytes are required to store the commands
            writeShort(ceil(allCmdsBin.length / 8));
            
            // write all commands to file as bytes
            // pad end of last byte with 0's if the binary commands
            // are not a width that is a multiple of 8 bits
            {let i = 0; while (i < allCmdsBin.length) {
                const slc = allCmdsBin.slice(i, i + 8).padEnd(8, "0");
                file.push(parseInt(slc, 2));
                i += 8;
            }}
            
            // loop through all glyphs
            for (let i = 0; i < intermediate.length; i += 2) {
                const params = intermediate[i+1];
                // loop through the vector points for each glyph
                for (let j = 0; j < params.length; j += 2) {
                    // map each x and y coord between the min and
                    // max x and y coordinates of all glyph vector points
                    // then write the x and y coords to the file
                    file.push(Math.round(map(params[j], pXMin, pXMax, 0, 255)));
                    file.push(Math.round(map(params[j+1], pYMin, pYMax, 0, 255)));
                }
            }
            
            // write kern min/max
            if (minKern == Infinity) {
                writeFloat(0);
                writeFloat(0);
            } else {
                writeFloat(minKern);
                writeFloat(maxKern);
            }

            // write the number of kern tables
            file.push(kernTableCount);

            // loop through all kern tables
            for (const kernVal in kernTables) {
                const table = kernTables[kernVal];
                const mappedKernVal = round(map(kernVal, minKern, maxKern, 0, 255));
                
                // write number of table rows
                file.push(table.length);
                
                // write kern amount
                file.push(mappedKernVal);
                
                // write pairs by a column at a time
                for (let i = 0; i < table.length; i++) {
                    writeCharCode(table[i][0].charCodeAt(0));
                }
                for (let i = 0; i < table.length; i++) {
                    writeCharCode(table[i][1].charCodeAt(0));
                }
            }
            
            // verify that the file only contains bytes
            for (let i = 0; i < file.length; i++) {
                if (file[i] < 0 || file[i] > 255) {
                    console.log("!!!", i, file[i]);
                }
            }
            
            return new Uint8Array(file);
        }

        glyphInfo(charCode) {
            const info = this.characterMap[charCode];
            if (info) {
                return {
                    index1: info[0],
                    index2: info[1],
                    width: info[2]
                };
            }
            return {
                index1: 0,
                index2: 0,
                width: 1
            };
        }
    }
    
    // https://iquilezles.org/articles/bezierbbox/
    function bboxBezier(p0x, p0y, p1x, p1y, p2x, p2y) {
        let miX = Math.min(p0x, p2x);
        let miY = Math.min(p0y, p2y);
        let maX = Math.max(p0x, p2x);
        let maY = Math.max(p0y, p2y);
        
        if (p1x < miX || p1x > maX || p1y < miY || p1y > maY) {
            const tx = constrain((p0x-p1x)/(p0x-2.0*p1x+p2x), 0.0, 1.0);
            const ty = constrain((p0y-p1y)/(p0y-2.0*p1y+p2y), 0.0, 1.0);
            const sx = 1.0 - tx;
            const sy = 1.0 - ty;
            const qx = sx*sx*p0x + 2.0*sx*tx*p1x + tx*tx*p2x;
            const qy = sy*sy*p0y + 2.0*sy*ty*p1y + ty*ty*p2y;
            miX = Math.min(miX, qx);
            miY = Math.min(miY, qy);
            maX = Math.max(maX, qx);
            maY = Math.max(maY, qy);
        }
        
        return {
            minX: miX,
            maxX: maX, 
            minY: miY,
            maxY: maY
        };
    }

    function measureText(txt, myFont, sz) {
        // stores the "theoretical" width of the text
        // theoretical because some glyphs do not take up the full width they are given
        // and other glyphs extend outside of the width they are given
        let fontWidth = 0;

        // how many pixels left of the origin does the text protrude
        let offX = 0;
        // how many pixels of padding does the rightmost glyph have from 
        // the right edge of the theoretical width box
        let endOffX = 0;
        // stores the highest (least) y coord of the rendered text relative to origin
        let offY = Infinity;
        // stores the lowest (greatest) y coord of the rendered text relative to origin
        let offEndY = 0;
        
        const spaceRenderWidth = myFont.glyphInfo(32).width * sz;
        
        for (let t = 0; t < txt.length; t++) {
            if (txt[t] === "\n") {
                continue;
            }
            const glyphInfo = myFont.glyphInfo(txt.charCodeAt(t));
            const glyph = myFont.glyphs[glyphInfo.index1];

            // store the bounding box of the glyph
            let minX = Infinity;
            let maxX = -1;
            let minY = Infinity;
            let maxY = -1;
            
            // process glyph
            let i = 0;
            let lastVertX = 0;
            let lastVertY = 0;
            while (i < glyph.length) {
                let shape = glyph[i];
                if (shape === HOLE) {
                    i++;
                    shape = glyph[i];
                }
                
                if (shape === VERT) {
                    const xPos = glyph[i+1] * sz;
                    const yPos = glyph[i+2] * sz;
                    
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
                } else if (shape === QUAD) {
                    const cpxPos = glyph[i+1] * sz;
                    const cpyPos = glyph[i+2] * sz;
                    const xPos = glyph[i+3] * sz;
                    const yPos = glyph[i+4] * sz;
                    
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
            if (minY !== Infinity && minY < offY) {
                offY = minY;
            }
            if (maxY !== -1 && maxY > offEndY) {
                offEndY = maxY;
            }
            
            // store left most glyphs minX
            if (t === 0) {
                offX = minX;
            }

            // store padding of rightmost glyph
            if (txt[t] !== " ") {
                endOffX = renderWidth - maxX;
            } else {
                // add the width of whitespace
                endOffX += spaceRenderWidth;
            }
        }
        
        // compute scaled ascent and descent
        const ascent = myFont.ascent * sz;
        const descent = myFont.descent * sz;

        const actualBoundingBoxLeft = offX === Infinity ? 0 : offX;
        const actualBoundingBoxRight = endOffX === -Infinity ? 0 : fontWidth - endOffX;
        const actualBoundingBoxAscent = -offY;
        const actualBoundingBoxDescent = offEndY;

        // return font metrics
        return {
            fontWidth: fontWidth,
            actualBoundingBoxLeft,
            actualBoundingBoxRight,
            actualBoundingBoxAscent,
            actualBoundingBoxDescent,
            fontBoundingBoxAscent: ascent,
            fontBoundingBoxDescent: descent,
            actualWidth: actualBoundingBoxRight - actualBoundingBoxLeft,
            actualHeight: actualBoundingBoxAscent + actualBoundingBoxDescent
        };
    }

    QOF = {
        Font: QOFont,
        measureText
    };
}
