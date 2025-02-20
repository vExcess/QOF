function wait(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

function loadFont(callback) {
    var styleEl = document.createElement("style");
    var fontImportsEl = document.getElementById("font-imports");
    styleEl.innerHTML = fontImportsEl.value;
    styleEl.onload = async function() {
        var progressEl = document.getElementById("progress");
        progressEl.innerHTML = "Importing CSS fonts...";
        var fontName = document.getElementById("font-name").value;
        
        // wait till font loaded
        while (true) {
            // have to check with spaces and without spaces to support all browsers
            var check1, check2;
            try {
                check1 = document.fonts.check("20px " + fontName);
            } catch {}
            try {
                check2 = document.fonts.check("20px " + fontName.replaceAll(" ", ""));
            } catch {}
            if (check1 || check2) {
                if (check2) {
                    // fontName = fontName.replaceAll(" ", "");
                    // document.getElementById("font-name").value = fontName;
                }
                break;
            }
            await wait(4);
        }
        
        var previewEl = document.getElementById("preview");
        var ctx = previewEl.getContext("2d");
        ctx.font = "20px " + fontName;
        // it takes a bit for it to register the font change
        // so wait an arbitrary amount of time
        setTimeout(function() {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, previewEl.width, previewEl.height);
            
            ctx.fillStyle = "black";
            ctx.fillText("the quick brown fox jumps over the lazy dog.", 10, 30);
            ctx.fillText("THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG?", 10, 60);
        }, 16);
        callback();
    };
    document.body.append(styleEl);
}

function ptEq(a, b) {
    return a[0] === b[0] && a[1] === b[1];
}

// https://www.khanacademy.org/computer-programming/i/5215448309563392
function plotLine(x1, y1, x2, y2) {
    x1 = x1 | 0;
    y1 = y1 | 0;
    x2 = x2 | 0;
    y2 = y2 | 0;
    
    var pts = [];
    var dx = Math.abs(x2 - x1); // Distance from x1 to x2
    var dy = Math.abs(y2 - y1); // Distance from y1 to y2
    var sx = (x1 < x2) ? 1 : -1; // Find if we're dealing with a positive or negative x slope
    var sy = (y1 < y2) ? 1 : -1; // Find if we're dealing with a positive or negative y slope
    var err = dx - dy; // Find whichever is longer the x length or the y length

    while(true) {
        // Set current pixel
        pts.push([x1, y1]);
        
        // If we reach the final point, break out of the loop
        if((x1 === x2) && (y1 === y2)) {
            break;
        }
        // Used for calculating step on x or y, whicever is bigger.
        var e2 = 2 * err;
        
        // If the x step comes first
        if(e2 > -dy) {
            err -= dy;
            x1 += sx;
        }
        // If the y step comes first.
        if(e2 < dx) {
            err += dx;
            y1 += sy;
        }
        // It's possible for both of these to be true, in which case we go diagonally.
    }
    
    return pts;
}

// https://stackoverflow.com/questions/31757501/pixel-by-pixel-b%C3%A9zier-curve
var plotQuadBezierSeg = function(x0, y0, x1, y1, x2, y2) {
    var pts = [];
    var sx = x2-x1, sy = y2-y1;
    var xx = x0-x1, yy = y0-y1, xy;         /* relative values for checks */
    var dx, dy, err, cur = xx*sy-yy*sx;                    /* curvature */

    if (sx*sx+sy*sy > xx*xx+yy*yy) { /* begin with longer part */ 
        x2 = x0; x0 = sx+x1; y2 = y0; y0 = sy+y1; cur = -cur;  /* swap P0 P2 */
    }  
    if (cur !== 0) {                                    /* no straight line */
        xx += sx; xx *= sx = x0 < x2 ? 1 : -1;           /* x step direction */
        yy += sy; yy *= sy = y0 < y2 ? 1 : -1;           /* y step direction */
        xy = 2*xx*yy; xx *= xx; yy *= yy;          /* differences 2nd degree */
        if (cur*sx*sy < 0) {                           /* negated curvature? */
            xx = -xx; yy = -yy; xy = -xy; cur = -cur;
        }
        dx = 4.0*sy*cur*(x1-x0)+xx-xy;             /* differences 1st degree */
        dy = 4.0*sx*cur*(y0-y1)+yy-xy;
        xx += xx; yy += yy; err = dx+dy+xy;                /* error 1st step */    
        do {                              
            pts.push([x0, y0]);
            if (x0 === x2 && y0 === y2) {
                return pts;  /* last pixel -> curve finished */
            }
            y1 = 2*err < dx;                  /* save value for test of y step */
            if (2*err > dy) { x0 += sx; dx -= xy; err += dy += yy; } /* x step */
            if (    y1    ) { y0 += sy; dy -= xy; err += dx += xx; } /* y step */
        } while (dy < dx );           /* gradient negates -> algorithm fails */
    }
    var temp = plotLine(x0, y0, x2, y2);
    for (var idk = 0; idk < temp.length; idk++) {
        pts.push(temp[idk]);
    }
    return pts;
};

var plotQuadBezier = function(x0, y0, x1, y1, x2, y2) {
    x0 = x0 | 0;
    y0 = y0 | 0;
    x1 = x1 | 0;
    y1 = y1 | 0;
    x2 = x2 | 0;
    y2 = y2 | 0;

    var allPts = [];
    /* plot any quadratic Bezier curve */
    var x = x0 - x1,
        y = y0 - y1;
    var t = x0 - 2 * x1 + x2,
        r;
    if (x * (x2 - x1) > 0) {
        /* horizontal cut at P4? */
        if (y * (y2 - y1) > 0) {/* vertical cut at P6 too? */
            if (Math.abs((y0 - 2 * y1 + y2) / t * x) > Math.abs(y)) {
                /* which first? */
                x0 = x2;
                x2 = x + x1;
                y0 = y2;
                y2 = y + y1; /* swap points */
            } /* now horizontal cut at P4 comes first */
        }
        t = (x0 - x1) / t;
        r = (1 - t) * ((1 - t) * y0 + 2.0 * t * y1) + t * t * y2; /* By(t=P4) */
        t = (x0 * x2 - x1 * x1) * t / (x0 - x1); /* gradient dP4/dx=0 */
        x = Math.floor(t + 0.5);
        y = Math.floor(r + 0.5);
        r = (y1 - y0) * (t - x0) / (x1 - x0) + y0; /* intersect P3 | P0 P1 */
        var temp = plotQuadBezierSeg(x0, y0, x, Math.floor(r + 0.5), x, y);
        for (var idk = 0; idk < temp.length; idk++) {
            allPts.push(temp[idk]);
        }
        r = (y1 - y2) * (t - x2) / (x1 - x2) + y2; /* intersect P4 | P1 P2 */
        x0 = x1 = x;
        y0 = y;
        y1 = Math.floor(r + 0.5); /* P0 = P4, P1 = P8 */
    }
    if ((y0 - y1) * (y2 - y1) > 0) {
        /* vertical cut at P6? */
        t = y0 - 2 * y1 + y2;
        t = (y0 - y1) / t;
        r = (1 - t) * ((1 - t) * x0 + 2.0 * t * x1) + t * t * x2; /* Bx(t=P6) */
        t = (y0 * y2 - y1 * y1) * t / (y0 - y1); /* gradient dP6/dy=0 */
        x = Math.floor(r + 0.5);
        y = Math.floor(t + 0.5);
        r = (x1 - x0) * (t - y0) / (y1 - y0) + x0; /* intersect P6 | P0 P1 */
        var temp = plotQuadBezierSeg(x0, y0, Math.floor(r + 0.5), y, x, y);
        for (var idk = 0; idk < temp.length; idk++) {
            var has = false;
            for (var j = 0; j < allPts.length; j++) {
                if (ptEq(allPts[j], temp[idk])) {
                    has = true;
                    break;
                }
            }
            if (!has) {
                allPts.push(temp[idk]);
            }
        }
        r = (x1 - x2) * (t - y2) / (y1 - y2) + x2; /* intersect P7 | P1 P2 */
        x0 = x;
        x1 = Math.floor(r + 0.5);
        y0 = y1 = y; /* P0 = P6, P1 = P7 */
    }
    var temp = plotQuadBezierSeg(x0, y0, x1, y1, x2, y2); /* remaining part */
    for (var idk = 0; idk < temp.length; idk++) {
        var has = false;
        for (var j = 0; j < allPts.length; j++) {
            if (ptEq(allPts[j], temp[idk])) {
                has = true;
                break;
            }
        }
        if (!has) {
            allPts.push(temp[idk]);
        }
    }
    return allPts;
};

var VERT = 0;
var QUAD = 1;
var HOLE = 2;

var QOFont = QOF.Font;

var irFont = new QOFont();
irFont.glyphs.push([
    0, 0.125, 0.000,
    0, 0.125, -0.625,
    0, 0.625, -0.625,
    0, 0.625, 0.000,
    
    HOLE,
    0, 0.125+0.016, 0.000-0.016,
    0, 0.125+0.016, -0.625+0.016,
    0, 0.625-+0.016, -0.625+0.016,
    0, 0.625-+0.016, 0.000-0.016,    
]);


var scaleFactor = 6;

var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
canvas.width = canvas.height = 600*2;
canvas.style.transform = "scale(0.5) translate(-50%, -50%)";
var DL = Drawlite(canvas);
var { pushMatrix, popMatrix, random, scale, font, background, 
    fill, rect, noFill, stroke, strokeWeight, line, textAscent, 
    textDescent, text, loadPixels, updatePixels, get, map, dist, pow, 
    round, abs, ceil } = DL;
var width = get.width;
var height = get.height;
var println = console.log;
var print = null;

DL.enableContextMenu();
DL.nosmooth();

function getIdx(x, y) {
    return (x + y * width) << 2;
}

var pixels;
var offsets = [
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
];
function findPath(x, y) {
    var i = getIdx(x, y);
    pixels[i] = 0;
    pixels[i+1] = 0;
    pixels[i+2] = 0;
    
    for (var j = 0; j < offsets.length; j++) {
        var off = offsets[j];
        var nextX = x + off[0];
        var nextY = y + off[1];
        if (pixels[getIdx(nextX, nextY)] === 255) {
            return [nextX, nextY];
        }
    }

    // bug fix for chromium: for some reason I have to look 1 pixel further
    // issue doesn't appear in firefox
    for (var j = 0; j < offsets.length; j++) {
        var off = offsets[j];
        var nextX = x + off[0] * 2;
        var nextY = y + off[1] * 2;
        if (pixels[getIdx(nextX, nextY)] === 255) {
            return [nextX, nextY];
        }
    }
    
    // i = getIdx(nextX, nextY);
    //         pixels[i] = 0;
    //         pixels[i+1] = 0;
    //         pixels[i+2] = 0;
    return null;
}

function findStart() {
    for (var i = 0; i < pixels.length; i += 4) {
        var x = (i >> 2) % width;
        var y = ((i >> 2) / width) | 0;
        if (pixels[i] === 255) {
            return [x, y];
        }
    }
    return null;
}

function renderVerts(verts) {
    var controlPts = [];
    
    var i = 0;
    var isShapeStart = true;
    var startX = 0;
    var startY = 0;
    
    while (i < verts.length) {
        var shape = verts[i];
        if (shape === HOLE) {
            i++;
            isShapeStart = true;
            ctx.fill();
            ctx.fillStyle = "rgb(0, 0, 0)";
        }
        
        if (isShapeStart) {
            if (shape !== HOLE) {
                ctx.fillStyle = "rgb(255, 255, 255)";
            }
            ctx.beginPath();
        }
        
        shape = verts[i];
        if (shape === VERT) {
            var xPos = 50 + verts[i+1] * 100;
            var yPos = 100 + verts[i+2] * 100;
            if (isShapeStart) {
                startX = xPos;
                startY = yPos;
                ctx.moveTo(xPos, yPos);
            } else {
                ctx.lineTo(xPos, yPos);
                
                if (xPos === startX && yPos === startY) {
                    isShapeStart = true;
                    ctx.fill();
                    i += 3;
                    continue;
                }
            }
            
            i += 3;
        } else if (shape === QUAD) {
            var cpxPos = 50 + verts[i+1] * 100;
            var cpyPos = 100 + verts[i+2] * 100;
            var xPos = 50 + verts[i+3] * 100;
            var yPos = 100 + verts[i+4] * 100;
            ctx.quadraticCurveTo(cpxPos, cpyPos, xPos, yPos);
            
            i += 5;
        }
        
        if (isShapeStart) {
            isShapeStart = false;
        }
        
        if (i === verts.length) {
            ctx.fill();
        }
    }

    controlPts.forEach(function(a) {
        stroke(0);
        strokeWeight(1);
        point(a[0], a[1]);
        strokeWeight(0.2);
    })
}

// https://www.khanacademy.org/computer-programming/i/4824691184599040
function nearestPointOnLine(ax, ay, bx, by) {
    var dx = bx - ax;  /* Vector from A to B (run) */
    var dy = by - ay;  /* ... (rise) */
    var mag2 = dx*dx + dy*dy;  /* Squared distance between A and B */
    
    /* Find and return the nearest point on line AB to point P. */
    var nearest = function(px, py) {
        var a2pX = px - ax;  /* Vector from A to P */
        var a2pY = py - ay;
        var a2pDota2b = a2pX*dx + a2pY*dy;  /* AP ⦁ AB */
        var t = a2pDota2b / mag2;  /* Parametric distance from A to THE point */
        return {
            x: ax + dx*t,
            y: ay + dy*t 
        };
    };
    
    return nearest;
}

function getPathPlot(path) {
    var origPts = [];
    for (var i = 0; i < path.length; i++) {
        var temp = plotLine(path[i][0], path[i][1], path[i][2], path[i][3]);
        for (var idk = 0; idk < temp.length; idk++) {
            var back1 = origPts[origPts.length - 1];
            var pt = temp[idk];
            if (!back1 || !ptEq(back1, pt)) {
                origPts.push(temp[idk]);
            }
        }
    }
    // check for duplicates
    var tempMap = {};
    for (var i = 0; i < origPts.length - 1; i++) {
        if (ptEq(origPts[i], origPts[i + 1])) {
            println("DUP!!!");
        }
    }
    return origPts;
}

function vectorize() {
    loadPixels();
    pixels = get.imageData.data;
    
    // find edges
    var cache = pixels.slice();
    for (var i = 0; i < cache.length; i += 4) {
        var x = (i >> 2) % width;
        var y = ((i >> 2) / width) | 0;
        if (
            x > 1 && x < width - 1 && y > 1 && y < height - 1 &&
            cache[i] < 1 && (
                cache[getIdx(x - 1, y)] >= 1 ||
                cache[getIdx(x + 1, y)] >= 1 ||
                cache[getIdx(x, y - 1)] >= 1 ||
                cache[getIdx(x, y + 1)] >= 1
            )
        ) {
            pixels[i] = 255;
            pixels[i+1] = 255;
            pixels[i+2] = 255;
        } else {
            pixels[i] = 0;
            pixels[i+1] = 0;
            pixels[i+2] = 0;
        }
    }
    
    var paths = [];
    
    // trace paths
    var start = findStart();
    while (start !== null) {
        var path = [];
        var next = findPath(start[0], start[1]);
        while (next !== null) {
            path.push([start[0], start[1], next[0], next[1]]);
            start = next;
            next = findPath(start[0], start[1]);
        }
        if (path.length > 0) {
            paths.push(path);
        }
        start = findStart();
    }
    
    function lnSlope(ln) {
        var x1 = ln[0];
        var y1 = ln[1];
        var x2 = ln[2];
        var y2 = ln[3];
        return (y2 - y1) / (x2 - x1);
    }
    
    // function idxSlope(i1, i2) {
    //     var x1 = path[i1][0];
    //     var y1 = path[i1][1];
    //     var x2 = path[i2][2];
    //     var y2 = path[i2][3];
    //     return (y2 - y1) / (x2 - x1);
    // }
    
    // initial line join
    for (var p = 0; p < paths.length; p++) {
        var path = paths[p];
        for (var i = 0; i < path.length - 1; i++) {
            var slope1 = lnSlope(path[i]);
            var slope2 = lnSlope(path[i+1]);
            
            if (slope1 === slope2 || Math.abs(slope1 - slope2) < 0.00001) {
                path[i] = [
                    path[i][0], path[i][1],
                    path[i+1][0], path[i+1][1],
                ];
                path.splice(i + 1, 1);
                i--;
            }
        }
    }
    
    function lnAtan2(ln) {
        var x1 = ln[0];
        var y1 = ln[1];
        var x2 = ln[2];
        var y2 = ln[3];
        return Math.atan2(y2 - y1, x2 - x1);
    }
    
    // join lines
    for (var p = 0; p < paths.length; p++) {
        var path = paths[p];
        for (var i = 0; i < path.length - 1; i++) {
            var slope1 = lnAtan2(path[i]);
            var slope2 = lnAtan2(path[i+1]);
            
            var nI = i + 2;
            while (nI + 1 < path.length && Math.abs(lnAtan2(path[nI]) - slope1) < 0.00001 && Math.abs(lnAtan2(path[nI+1]) - slope2) < 0.00001) {
                var distFind = nearestPointOnLine(
                    path[i][0], path[i][1],
                    path[nI+1][2], path[nI+1][3]
                );
                var leave = false;
                for (var j = i + 1; j < nI+1; j++) {
                    var closest = distFind(path[j][0], path[j][1]);
                    var d = dist(path[j][0], path[j][1], closest.x, closest.y);
                    if (d > 1.5) {
                        leave = true;
                        break;
                    }
                }
                
                if (leave) {
                    break;
                }
                
                nI += 2;
            }
            nI -= 2;
            
            if (nI !== i) {
                path[i] = [
                    path[i][0], path[i][1],
                    path[nI+1][2], path[nI+1][3]
                ];
                path.splice(i + 1, nI - i + 1);
            }
        }
    }
    
    updatePixels();
    
    return paths;
}

function mergePathCurve(path, segStartIdx, segEndIdx, devFlag) {
    var finD = null;
    var opt;
    var currU;
    var l1;
    var l2;
    var error = 0.51;
    do {
        var origPts = getPathPlot(path.slice(segStartIdx, segEndIdx + 1));
        
        l1 = origPts[0];
        var f = origPts[Math.round(origPts.length / 2)];
        l2 = origPts[origPts.length - 1];

        function getCurveDist(u) {
            // [f – (1-u)^2 * p0 – u^2 * p2] / 2(1-u)u
            
            var sq_invu = (1-u) * (1-u);
            var sq_u = u * u;
            var cp = [
                (f[0] - sq_invu * l1[0] - sq_u * l2[0]) / (2*(1-u)*u),
                (f[1] - sq_invu * l1[1] - sq_u * l2[1]) / (2*(1-u)*u)
            ];
            
            stroke(255, 0, 0);
            var plotPts = plotQuadBezier(l1[0], l1[1], cp[0], cp[1], l2[0], l2[1]);
            
            // check for duplicates
            for (var i = 0; i < plotPts.length - 1; i++) {
                if (ptEq(plotPts[i], plotPts[i + 1])) {
                    println("DUP");
                }
            }
            
            
            var stdErr = 0;
            var biasX = 0;
            var biasY = 0;
            var numPts = Math.min(origPts.length, plotPts.length);
            for (var i = 0; i < numPts; i++) {
                var x1 = origPts[i][0];
                var y1 = origPts[i][1];
                var x2 = plotPts[i][0];
                var y2 = plotPts[i][1];
                
                var dx = x2 - x1;
                var dy = y2 - y1;
                var d = dx * dx + dy * dy;
                
                stdErr += d;
                biasX += dx;
                biasY += dy;
            }
            stdErr = Math.sqrt(stdErr / (numPts - 2));
            
            return {
                cp: cp,
                biasX: biasX,
                biasY: biasY,
                dist: stdErr,
                plotPts: plotPts
            };
        }
        
        var search = null;
        var scalething = 6;
        function doSearch(depth) {
            if (depth === 0) {
                search = [];
                for (var i = 0; i < 1; i += 1/5) {
                    currU = map(i, 0, 1, 0.3, 0.7);
                    var d1 = getCurveDist(currU);
                    search.push([currU, d1.dist]);
                    
                }
                search = search.sort(function(a, b) {
                    return a[1] - b[1];
                })
                
                var center = search[0];
                
                search = search.sort(function(a, b) {
                    return a[0] - b[0];
                })
                
                for (var i = 0; i < search.length; i++) {
                    if (ptEq(center, search[i])) {
                        var prev = Math.max(0, i - 1);
                        var next = Math.min(search.length - 1, i + 1);
                        search = search.slice(prev, next + 1);
                        break;
                    }
                }
                
                // for (var i = 0; i < search.length; i++) {
                //     noStroke();
                //     fill(0, 0, 255);
                //     rect(10 + search[i][0] * (1/0.003)*2, 250, 2, -search[i][1] * scalething)
                // }
            } else {
                var searchLen = search.length;
                for (var i = 0; i < 1; i += 1/5) {
                    var u = search[1][0];
                    var spread = 0.001;
                    currU = map(i, 0, 1, search[0][0]-spread, search[searchLen - 1][0]+spread);
                    if (currU !== u) {
                        var d1 = getCurveDist(currU);
                        search.push([currU, d1.dist]);
                    }
                }
                
                search = search.sort(function(a, b) {
                    return a[1] - b[1];
                })
                
                var center = search[0];
                
                search = search.sort(function(a, b) {
                    return a[0] - b[0];
                })
                
                for (var i = 0; i < search.length; i++) {
                    if (ptEq(center, search[i])) {
                        var prev = Math.max(0, i - 1);
                        var next = Math.min(search.length - 1, i + 1);
                        search = search.slice(prev, next + 1);
                        break;
                    }
                }
                
                if (devFlag) {
                    for (var i = 0; i < search.length; i++) {
                        noStroke();
                        
                        // else {
                        //     fill(0)
                        // }
                        fill(25+depth * 25, 25+depth * 25, 0);
                        if (depth === 3) {
                            fill(255);
                        } 
                        rect(10 + search[i][0] * (1/0.003)*2, 250, 4, -search[i][1] * scalething)
                    }
                }
            }
        }
        
        if (devFlag) {
            var currU = 0.01;
            var d1;
            do {
                d1 = getCurveDist(currU);
                currU += 0.003;
                noStroke();
                fill(255, 0, 0);
                rect(10 + currU * (1/0.003)*2, 250, 2, -d1.dist * scalething)
            } while (currU < 0.99);
        }
        
        var effort = 5;
        for (var i = 0; i < effort; i++) {
            doSearch(i);
        }
        search = search.sort(function(a, b) {
            return a[1] - b[1];
        })
        currU = search[0][0];
        
        do {
            opt = getCurveDist(currU);
            var next = getCurveDist(currU + 0.005);
            if (next.dist < opt.dist) {
                currU += 0.005;
            }
        } while (next.dist < opt.dist);
        
        if (finD === null || opt.dist < error) {
            finD = opt;
        }
        
        segEndIdx++;
    } while (
        segEndIdx < path.length &&
        dist(path[segEndIdx][0], path[segEndIdx][1], path[segEndIdx][2], path[segEndIdx][3]) < 5 &&
        opt.dist < error);
}

function calcQuadraticError(origPts, plotPts) {
    var stdErr = 0;
    for (var i = 0; i < plotPts.length; i++) {
        var x1 = plotPts[i][0];
        var y1 = plotPts[i][1];
        var minD = Infinity;
        var minJ = 0;
        for (var j = minJ; j < origPts.length; j++) {
            var x2 = origPts[j][0];
            var y2 = origPts[j][1];
            
            var dx = x2 - x1;
            var dy = y2 - y1;
            var d = dx * dx + dy * dy;
            if (d < minD) {
                minD = d;
                minJ = j;
                if (minD === 0) {
                    break;
                }
            }
        }
        stdErr += minD;
    }
    stdErr = Math.sqrt(stdErr / (plotPts.length - 2));
    return stdErr;
}

function tryQuadratic(origPts, u) {
    var l1 = origPts[0];
    var f = origPts[Math.round(origPts.length / 2)];
    var l2 = origPts[origPts.length - 1];
    
    // create quadratic curve
    // [f – (1-u)^2 * p0 – u^2 * p2] / 2(1-u)u
    var sq_invu = (1-u) * (1-u);
    var sq_u = u * u;
    var cp = [
        (f[0] - sq_invu * l1[0] - sq_u * l2[0]) / (2*(1-u)*u),
        (f[1] - sq_invu * l1[1] - sq_u * l2[1]) / (2*(1-u)*u)
    ];
    
    // plot quadratic curve
    var plotPts = plotQuadBezier(l1[0], l1[1], cp[0], cp[1], l2[0], l2[1]);
    // check for duplicates
    for (var i = 0; i < plotPts.length - 1; i++) {
        if (ptEq(plotPts[i], plotPts[i + 1])) {
            println("DUP");
        }
    }
    // println(plotPts)

    return {
        l1: l1,
        cp: cp,
        l2: l2,
        error: calcQuadraticError(origPts, plotPts)
    };
}

function curvify(path, segStartIdx, segEndIdx) {
    var currU = 0.5;
    var error = 0;
    
    var finalQuad = null;
    
    while (error < 1.0 && segEndIdx < path.length) {
        var origPts = getPathPlot(path.slice(segStartIdx, segEndIdx + 1));
        var quadratic = tryQuadratic(origPts, currU);
        error = quadratic.error;
        if (error < 1) {
            finalQuad = quadratic;
        } else {
            var minErr = Infinity;
            var minQuad = null;
            var minU = currU;
            var start = 0.1;
            var stop = 0.9;
            
            for (var i = 0; i < 10; i++) {
                var r1 = [start, (start + stop) / 2];
                var r2 = [(start + stop) / 2, stop];
            
                var tryU1 = (r1[0] + r1[1]) / 2;
                var tryQ1 = tryQuadratic(origPts, tryU1);
                
                var tryU2 = (r2[0] + r2[1]) / 2;
                var tryQ2 = tryQuadratic(origPts, tryU2);
                
                if (tryQ1.error < tryQ2.error) {
                    start = r1[0];
                    stop = r1[1];
                    if (tryQ1.error < minErr) {
                        minU = tryU1;
                        minQuad = tryQ1;
                        minErr = tryQ1.error;
                    }
                } else {
                    start = r2[0];
                    stop = r2[1];
                    if (tryQ2.error < minErr) {
                        minU = tryU2;
                        minQuad = tryQ2;
                        minErr = tryQ2.error;
                    }
                }
            }
            
            error = minErr;
            if (error < 1) {
                finalQuad = minQuad;
                currU = minU;
            }
        }
        segEndIdx++;
    }
    
    if (finalQuad !== null) {
        var l1 = finalQuad.l1;
        var cp = finalQuad.cp;
        var l2 = finalQuad.l2;

        path[segStartIdx] = [l1[0], l1[1], cp[0], cp[1], l2[0], l2[1]];
        path.splice(segStartIdx + 1, segEndIdx - segStartIdx-2);
    } else {
        return true;
    }
    
    return false;
}

function rect_rect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x1 > x2 + w2 || y1 + h1 < y2 || y1 > y2 + h2);
};

function pathBoundingBox(path) {
    var minX = Infinity;
    var maxX = -1;
    var minY = Infinity;
    var maxY = -1;
    
    for (var i = 0; i < path.length; i++) {
        var seg = path[i];
        for (var j = 0; j < seg.length; j += 2) {
            var xPos = seg[j];
            var yPos = seg[j + 1];
            
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
        }
    }
    
    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY
    };
}

function convertChar(fontName, size, ch) {
    font(fontName, size);
    pushMatrix();
        scale(scaleFactor);

        background(255);
        ctx.fillStyle = "rgb(0, 0, 0)";
        ctx.fillText(ch, 50, 100);
    popMatrix();
    
    var paths = vectorize();
    
    for (var p = 0; p < paths.length; p++) {
        var path = paths[p];
        var segStartIdx = 0;
        var segEndIdx = 1;

        while (segEndIdx < path.length) {
            curvify(path, segStartIdx, segEndIdx);
            
            segStartIdx++;
            segEndIdx = segStartIdx + 1;
        }
    }
    
    paths = paths.filter(p => p.length > 0)
    
    for (var p = 0; p < paths.length; p++) {
        var path = paths[p];
        var n0 = path[0];
        var ln = path[path.length - 1];
        ln[ln.length-1 - 1] = n0[0];
        ln[ln.length-1] = n0[1];
    }
    
    var verts = [];
    // println("#PATHS: " + paths.length)
    for (var p = 0; p < paths.length; p++) {
        var path = paths[p];
        if (p > 0) {
            for (var o = 0; o < p; o++) {
                var bb1 = pathBoundingBox(paths[o]);
                var bb2 = pathBoundingBox(paths[p]);
                if (rect_rect(
                    bb1.x, bb1.y, bb1.w, bb1.h,
                    bb2.x, bb2.y, bb2.w, bb2.h)
                ) {
                    const XA1 = bb1.x;
                    const XA2 = bb1.x + bb1.w;
                    const XB1 = bb2.x;
                    const XB2 = bb2.x + bb2.w;
                    const YA1 = bb1.y;
                    const YA2 = bb1.y + bb1.h;
                    const YB1 = bb2.y;
                    const YB2 = bb2.y + bb2.h;
                    const SI = Math.max(0, Math.min(XA2, XB2) - Math.max(XA1, XB1)) * Math.max(0, Math.min(YA2, YB2) - Math.max(YA1, YB1))
                    // const SA = bb1.w * bb1.h;
                    const SB = bb2.w * bb2.h;
                    const overlap = SI / SB;
                    if (overlap > 0.25) {
                        verts.push(HOLE);
                        break;
                    }
                }
            }
        }
        for (var i = 0; i < path.length - 0; i++) {
            var seg = path[i];
            if (seg.length === 4) {
                verts.push(VERT);
                verts.push((seg[0] * 1 / scaleFactor - 50) / size);
                verts.push((seg[1] * 1 / scaleFactor - 100) / size);
                
                verts.push(VERT);
                verts.push((seg[2] * 1 / scaleFactor - 50) / size);
                verts.push((seg[3] * 1 / scaleFactor - 100) / size);
            } else {
                if (i === 0) {
                    verts.push(VERT);
                    verts.push((seg[0] * 1 / scaleFactor - 50) / size);
                    verts.push((seg[1] * 1 / scaleFactor - 100) / size);
                }
                
                verts.push(QUAD);
                verts.push((seg[2] * 1 / scaleFactor - 50) / size);
                verts.push((seg[3] * 1 / scaleFactor - 100) / size);
                verts.push((seg[4] * 1 / scaleFactor - 50) / size);
                verts.push((seg[5] * 1 / scaleFactor - 100) / size);
            }
        }
    }
    
    var precision = 1000;
    for (var i = 0; i < verts.length; i++) {
        verts[i] = Math.round(verts[i] * precision) / precision;
    }
    
    return {
        paths: paths,
        verts: verts,
        fontAscent: textAscent(),
        fontDescent: textDescent(),
        metrics: ctx.measureText(ch)
    };
}

var convertBtn = document.getElementById("convert-button");

async function convertFont() {
    var fontName = document.getElementById("font-name").value;
    var progressEl = document.getElementById("progress");
    var ranges = [
        [32, 127],
    ];

    function checked(a) {
        return document.getElementById("ext-" + a).checked;
    }
    
    if (checked("ascii")) {
        ranges.push([128, 255]);
    }
    if (checked("latina")) {
        ranges.push([256, 383]);
    }
    if (checked("latinb")) {
        ranges.push([384, 591]);
    }

    // add additional ranges
    document.getElementById("ranges").value
        .split(",")
        .map(pair => pair.trim().split("-").map(Number))
        .forEach(range => {
            ranges.push(range);
        })

    let allChars = [];
    for (let r = 0; r < ranges.length; r++) {
        const start = ranges[r][0];
        const end = ranges[r][1];
        for (var i = start; i <= end; i++) {
            var ch = String.fromCharCode(i);
            if (!allChars.includes(ch)) {
                allChars.push(ch);
            }
        }
    }
    irFont.name = fontName;

    for (var i = 0; i < allChars.length; i++) {
        var ch = allChars[i];
        
        var renderSize = 100;
        var data = convertChar(fontName, renderSize, ch);
        var ascent = data.fontAscent;
        var descent = data.fontDescent;
        var metrics = data.metrics;
        var verts = data.verts;
        
        irFont.ascent = ascent / renderSize;
        irFont.descent = descent / renderSize;
        irFont.characterMap[ch.charCodeAt(0)] = [irFont.glyphs.length, 0, metrics.width / renderSize];
        irFont.glyphs.push(verts);
        
        progressEl.innerHTML = (i+1) + "/" + allChars.length + " (" + Math.round((i+1)/allChars.length*100) + "%)";
        
        await wait(4);
    }

    var kerningPairs = {};
    // find kerning
    for (var i = 0; i < allChars.length; i++) {
        for (var j = 0; j < allChars.length; j++) {
            var ch1 = allChars[i];
            var ch2 = allChars[j];
            var w1 = ctx.measureText(ch1).width;
            var w2 = ctx.measureText(ch2).width;
            var sum = (w1 + w2);
            var both = ctx.measureText(ch1 + ch2).width;
            var dist = Math.abs(both - sum);
            if (dist > 1) {
                var diff = both - sum;
                kerningPairs[ch1+ch2] = diff / renderSize; 
            }
        }
    }
    irFont.kerning = kerningPairs;
    
    println(irFont);

    var bytes = irFont.toBytes();
    var blob = new Blob([bytes], {
        type: "font/qof"
    });
    var blobUrl = URL.createObjectURL(blob);
    
    var outDiv = document.getElementById("out-div");
    outDiv.style.display = "block";
    var szEl = document.getElementById("qof-size");
    szEl.innerHTML = "Size: " + (bytes.length / 1024).toFixed(2) + " KB";

    var fontName = document.getElementById("font-name").value;
    
    var downloadBtn = outDiv.getElementsByTagName("button")[0];
    downloadBtn.addEventListener("click", function() {
        var a = document.createElement("a");
        a.href = blobUrl;
        a.download = fontName + ".qof";
        document.body.append(a);
        a.click();
        a.remove();
    });

    // var myFont = decodeFont(bytes);
    myFont = irFont;
    
    var previewEl = document.getElementById("preview");
    var bounds = previewEl.getBoundingClientRect();
    
    var renderCanvas = document.getElementById("rendered");
    renderCanvas.width = bounds.width;
    renderCanvas.height = bounds.height;
    
    var rDL = Drawlite(renderCanvas);
    rDL.enableContextMenu();
    rDL.pushMatrix();
        rDL.background(255);
        rDL.fill(255, 0, 0);
        QOF.renderText(rDL.ctx, "the quick brown fox jumps over the lazy dog.", 10, 30, myFont, 20, [0, 0, 0, 255]);
        QOF.renderText(rDL.ctx, "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG?", 10, 60, myFont, 20, [0, 0, 0, 255]);
    rDL.popMatrix();

    convertBtn.disabled = false;
}

function main() {
    var ch = "ü";
    var data = convertChar("serif", 100, ch);
    var ascent = data.fontAscent;
    var descent = data.fontDescent;
    var metrics = data.metrics;
    var verts = data.verts;
    
    println(metrics)

    background(255);
    pushMatrix();
        scale(scaleFactor);

        noFill();
        
        stroke(0, 0, 0);
        strokeWeight(0.2);
        rect(50, 0, metrics.width, 100);

        stroke(0, 255, 255);
        line(50, 100, 150, 100);
        line(50, 100-ascent, 150, 100-ascent);
        line(50, 100+descent, 150, 100+descent);
        
        background(0);
        renderVerts(verts);
    popMatrix();
    
    // ------------------------------------------
    
    var xOff = 315;
    // strokeWeight(1);
    // ctx.strokeStyle = "white";
    // ctx.beginPath();
    // for (var p = 0; p < paths.length; p++) {
    //     var path = paths[p];
    //     for (var i = 0; i < path.length; i++) {
    //         ctx.moveTo(xOff+ path[i][0], path[i][1]);
    //         ctx.lineTo(xOff+ path[i][2], path[i][3]);
    //     }
    // }
    // ctx.stroke();
    
    strokeWeight(5);
    var paths = data.paths;
    console.log(paths)
    for (var p = 0; p < paths.length; p++) {
        var path = paths[p];
        for (var i = 0; i < path.length; i++) {
            ctx.strokeStyle = "rgba(" + [random(255), random(255), random(255), 1] + ")";
            ctx.beginPath();
            if (path[i].length === 4) {
                ctx.moveTo(xOff+ path[i][0], path[i][1]);
                ctx.lineTo(xOff+ path[i][2], path[i][3]);
            } else {
                if (i > 0) {
                    var endLen = path[i-1].length - 2;
                    ctx.moveTo(xOff+ path[i-1][endLen], path[i-1][endLen+1]);
                } else {
                    ctx.moveTo(xOff+ path[i][0], path[i][1]);
                }
                ctx.quadraticCurveTo(xOff+ path[i][2], path[i][3], xOff+ path[i][4], path[i][5]);
            }
            ctx.stroke();
        }
    }
    
    font("serif", 600);
    fill(255);
    text(ch, 0, 385);
}

convertBtn.addEventListener("click", function() {
    loadFont(convertFont);
    convertBtn.disabled = true;
});

main();
