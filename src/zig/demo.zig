const std = @import("std");

const vexlib = @import("./vexlib.zig");
const Array = vexlib.Array;
const Map = vexlib.Map;
const String = vexlib.String;
const print = vexlib.print;
const println = vexlib.println;

const QOF = @import("./qof.zig");

const VERT = QOF.VERT;
const QUAD = QOF.QUAD;
const HOLE = QOF.HOLE;

const CachedGlyphData = struct {
    bitmap: Array(i32),
    box: Array(i32),
};

var bitmapCache: Map(String, CachedGlyphData) = {};

var myFont: QOF.Font = undefined;

const sampleText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. á, é, í, ó, ú, ü, ñ, ¿, ¡";

pub fn main() !void {
    // setup allocator
    var generalPurposeAllocator = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = generalPurposeAllocator.allocator();
    vexlib.init(&allocator);

    const buffer = try std.fs.cwd().readFileAlloc(allocator, "../../Open Sans.qof", 1024 * 32);

    const fileBytes = buffer;
    const font = QOF.Font.fromBytes(fileBytes);
    print("name: ");
    println(font.name);
    print("version: ");
    println(font.version);
    print("ascent: ");
    println(font.ascent);
    print("descent: ");
    println(font.descent);
    print("glyphs: ");
    println(font.glyphs);
    print("characterMap: ");
    println(font.characterMap);
    print("kerning: ");
    println(font.kerning);
    print("weight: ");
    println(font.weight);
    print("italic: ");
    println(font.italic);
    myFont = font;
}
