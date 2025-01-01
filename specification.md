# QOF Specification
The specification tells you how to interpret the QOF file format. It also tells you restrictions that the file must follow. The specification tells you how to parse the items, but to understand how to store the file for use and how to use it read the documentation.

## Custom Float Representation
QOF stores floats using 3 bytes. The most significant bit of the first byte is the sign bit where `1` is negative and `0` is positive. The remaining 7 bits of the first byte store the exponent of the float. The second byte stores the more significant half of the mantissa. The third byte stores the less significant half of the mantissa. Encoding/Decoding floats can be done by the following code:
```js
function encodeFloat(n) {
    var neg = n < 0;
    n = Math.abs(n);
    var sig = 0;
    while (n > 1) {
        n /= 2;
        sig++;
    }
    var val = n * pow2_8 | 0;
    return [sig | (neg ? 128 : 0), val >> 8, val & 255];
}

function decodeFloat(bytes) {
    return ((bytes[1] << 8) | bytes[2]) / pow2_8 * Math.pow(2, bytes[0] & 127) * (bytes[0] > 127 ? -1 : 1);
}
```

## Custom Short Representation
Shorts are stored using 2 bytes where the most significant half of the short is stored in the first byte. Shorts cannot be negative.

## Custom Char/GlyphIndex Representation
Characters are stored using either 1 or 2 bytes. 1 byte is used if the character code is less than 128 (the character is an ASCII value). Otherwise the character is stored using 2 bytes. Where the first byte stores the more significant half of the character code and the second byte stores the less significant half of the character code. If the character is stored using 2 bytes then the 1st bit of the 1st byte is set to `1` to denote the character as a 2 byte character. Otherwise the 1st bit of the 1st byte is `0` to denote the character as a single byte character. Glyph indices are stored using the same format as characters.

## Special Requirements
- The max font name length is 63 ASCII characters
- The font must contain a null character at glyph index 0
- There can't be more than 32768 glyphs
- If there is no kerning information `minKern` and `maxKern` must be set to `0`

# Other Infos
- Characters not included in the font are rendered as the null character

## Byte Descriptions
| Byte | Description |
| --- | --- |
| 0 | Must be 81 (the ASCII code for 'Q') |
| 1 | Must be 79 (the ASCII code for 'O') |
| 2 | Must be 70 (the ASCII code for 'F') |
| 3 | The 2 most significant bits are the file version number (must be 0). The remaining 6 bits is the `fontNameLength` which is the length of the font name. |
| the next `fontNameLength` bytes | ASCII values representing the font name |
| the next byte | The most significant bit is a flag where `1` means the font is italic and `0` means the font is not italic. The remaining bits store the font weight divided by 100 (if the font weight is 900 the remaining bits store the value 9). Valid font weight values are 1 to 9 inclusive. |
| the next 3 bytes | The font ascent as a custom float |
| the next 3 bytes | The font descent as a custom float |
| the next 3 bytes | The `minGlyphWidth` as a custom float |
| the next 3 bytes | The `maxGlyphWidth` as a custom float |
| the next 3 bytes | The `minParameterX` value as a custom float |
| the next 3 bytes | The `maxParameterX` value as a custom float |
| the next 3 bytes | The `minParameterY` value as a custom float |
| the next 3 bytes | The `maxParameterY` value as a custom float |
| the next byte | The number of command pairs not used in the last byte of the commands section of the file. This value is the `commandPadding` |
| the next 2 bytes | A short which is the `charMapTableRowsCount` which is the number of rows in the character map table |
| the next `charMapTableRowsCount` chars worth of bytes | The character codes of the character map table (the first column of the table). Because characters are stored using variable width encoding the length of the section is not known without parsing the entire section |
| the next `charMapTableRowsCount` chars worth of bytes | The 1st glyph indices of the character map table (the second column of the table). Because glyph indices are stored using variable width encoding the length of the section is not known without parsing the entire section |
| the next `charMapTableRowsCount` chars worth of bytes | The 2nd glyph indices of the character map table (the third column of the table). Because glyph indices are stored using variable width encoding the length of the section is not known without parsing the entire section |
| the next `charMapTableRowsCount` bytes | The widths of the characters (the fourth column of the character table). Each width value is stored as a byte where the original value has been mapped from between `minGlyphWidth` and `maxGlyphWidth` to between `0` and `255`  |
| the next 2 bytes | Short representing the number of glyphs the font contains |
| the next 2 bytes | Short named `numCommandBytes` representing the number of bytes needed to store the commands section of the file |
| the next `numCommandBytes` bytes | Stores the commands used to create the glyphs. Each pair of bits in each byte represents a command. `0` is a VERTEX, `1` is a QUADRATIC_CURVE, `2` is a HOLE, and `3` represents the end of the commands for the current glyph. The last (least significant bits) `commandPadding` pairs of the last byte are ignored because they are padding |
| the next (number of parameters needed for the commands parsed above)*2 bytes | Store the parameters for the glyph commands. Each parameter is a pair of bytes where the first byte is the X coordinate mapped from between `minParameterX` and `maxParameterX` to between 0 and 255. The second byte is the Y coordinate mapped from between `minParameterY` and `maxParameterY` to between 0 and 255. VERTEX commands have 1 pair of coordinates. QUADRATIC_CURVE commands have 2 pairs of coordinates. HOLE commands have no parameters. |
| the next 3 bytes | The `minKernAmount` as a custom float. If the font contains no kerning information default to 0 |
| the next 3 bytes | The `maxKernAmount` as a custom float. If the font contains no kerning information default to 0  |
| the next byte | The `kernTableCount` which is the number of kern tables there are |
| the remaining bytes | Stores all the kern tables. Each kern table entry begins with a byte `kernTableLength` which is the number of rows in the kern table. The next byte stores the kern amount mapped from between `minKernAmount` and `maxKernAmount` to between `0` and `255`. All entries in the kern table use the same kern amount. Next, there are `kernTableLength` number of custom encoded characters which is the first column of the kern table. These characters are the first of the characters in the kerning pairs. Lastly, there are `kernTableLength` number of custom encoded characters which is the second column of the kern table. These characters are the second characters in the kerning pairs |