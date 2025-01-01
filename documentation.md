# Documentation
I'm only providing one documentation for all implementation languages because each implementation should be almost the same.

## Syntax
Array\<TYPE> means an array containing items of given type  
Array[INT] means the array is of length of the given int  
String[INT] means the string is of length of the given int  

## QOF
THe namespace that the library is under. The `QOF` namespace contains `QOFont`, `measureText`, and `renderText`.

## QOFont Class/Struct
The Font class for QOF
### Properties
`name`: String --- the name of the font  

`version`: int --- the format version (0)  

`ascent`: float --- the text ascent of the font  

`descent`: float --- the text descent of the font  

`glyphs`: Array\<Array\<float>> --- Array of glyph data. Each glyph data array stores the commands and arguments to render the glyph e.g. [VERTEX, 0.5, 0.5, QUADRATIC_CURVE, 0.1, 0.2, 0.3, 0.4 ...] where VERTEX would be replaced with 0.0, and QUADRATIC_CURVE with 1.0  

`characterMap`: Map\<int, Array[3]\<float>> --- The int is the character code. The array stores [glyph1Index, glyph2Index, characterWidth]  

`kerning`: Map\<String[2], float> --- The string is the pair of characters for the kerning pair definition. The float is the kern amount where the kern amount is the amount of shift applied to the second character in the kerning pair. A negative kern amount shifts the character left while a positive amount shifts the character right.  

`weight`: int --- The weight of the font. Must be 100, 200, 300, 400, 500, 600, 700, 800, or 900  

`italic`: bool -- true means the font is italic. false means the font is not italic

### Static Methods
`fromBytes(bytes: Array<int>) -> QOFont` --- Takes an array of bytes and parses it into a QOFont object

### Non-Static Methods
`toBytes() -> Array<int>` Converts the QOFont object to an array of bytes (the .QOF file)  

`glyphInfo(charCode: int) -> { index1: int, index2: int, width: float }` --- returns the glyphInfo for a given character code. `index1` is the first index in the `glyphs` array required to render the character. `index2` is the second index in the glyphs array required to render the character. If only 1 glyph is required to render the character `index2` is 0 (which points to the null glyph). `width` is the width of the character

## measureText
Measures a string of text for a given QOF font and font size and returns text metrics
### Parameters
`txt`: String --- the text to measure  
`myFont`: QOFont --- the font to use  
`sz`: int --- the size to measure the font at  

### Return Value
```ts
{
    // the font width of txt
    fontWidth: float,

    // horizontal distance from the origin to the left side of the actual bounding rectangle of the given text in pixels; positive numbers indicating a distance going left from the origin.
    actualBoundingBoxLeft: float,

    // horizontal distance from the origin to the right side of the actual bounding rectangle of the given text in pixels.
    actualBoundingBoxRight: float,

    // vertical distance from the baseline to the top of the actual bounding rectangle of the given text
    actualBoundingBoxAscent: float,

    // vertical distance from the baseline to the bottom of the actual bounding rectangle of the given text
    actualBoundingBoxDescent: float,

    // vertical distance from the baseline to the top of the font bounding rectangle of the given text
    fontBoundingBoxAscent: float,

    // vertical distance from the baseline to the bottom of the font bounding rectangle of the given text
    fontBoundingBoxDescent: float,

    // the width of the actual bounding rectangle of the given text
    actualWidth: float,

    // the height of the actual bounding rectangle of the given text
    actualHeight: float
}
```

## renderText
Renders a string of text to a graphics context (language dependent) for a given QOF font and font size

### Parameters
`ctx`: LanguageDependentGraphicsContext --- the graphics content (depends on language)  
`txt`: String --- the text to measure  
`x`: int --- the x coordinate of the leftmost point of the text baseline  
`y`: int --- the y coordinate of the text baseline
`myFont`: QOFont --- the font to use  
`sz`: int --- the size to measure the font at  
`clr`: Array[4]\<int> --- color as RGBA where each item is a byte
`wrapWidth`: int --- if the rendered text reaches this width, the text will be split and rendered on a new line

### Return Value
void
