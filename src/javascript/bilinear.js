// jshint ignore: start
background(255, 255, 255);
for (var x = 0; x < 200; x++) {
    for (var y = 0; y < 200; y++) {
        stroke(random(255));
        point(x, y);
    }
}

stroke(0, 0, 0);
point(0, 0);
stroke(100);
point(1, 0);
stroke(100);
point(0, 1);
stroke(0);
point(1, 1);

stroke(255, 0, 0);
point(0, 0);
stroke(255, 255, 0);
point(1, 0);
stroke(0, 0, 0);
point(0, 1);
stroke(0, 0, 255);
point(1, 1);

var tex = get(0, 0, 100, 100);
tex = get(0, 0, 3, 3);

function bilinearColorComponent(texPix, p1, p2, p3, p4, subTx, subTy, offset) {
    var r1 = texPix[p1 + offset];
    var r2 = texPix[p2 + offset];
    var r3 = texPix[p3 + offset];
    var r4 = texPix[p4 + offset];
    var ra = lerp(r1, r2, subTx);
    var rb = lerp(r3, r4, subTx);
    return lerp(ra, rb, subTy);
}

function putBilinearImageData(imgData, xPos, yPos, w, h) {
    var texPix = imgData.data;
    for (var x = 0; x < w; x++) {
        for (var y = 0; y < h; y++) {
            // [0, 1]
            var destU = x / (w - 1);
            var destV = y / (h - 1);
            
            // [-0.5, texWidth-0.5)
            var texU = destU * imgData.width - 0.5;
            var texV = destV * imgData.height - 0.5;
            
            // [0, texWidth-1]
            var iTexU = texU|0;
            var iTexV = texV|0;
            
            // [0, texWidth-1]
            var rightXPos = iTexU+1;
            if (rightXPos === imgData.width) {
                rightXPos--;
            }
            
            // [0, texHeight-1]
            var downYPos = iTexV+1;
            if (downYPos === imgData.height) {
                downYPos--;
            }
            
            var TL = (iTexU + iTexV * imgData.width) << 2;
            var TR = (rightXPos + iTexV * imgData.width) << 2;
            var BL = (iTexU + downYPos * imgData.width) << 2;
            var BR = (rightXPos + downYPos * imgData.width) << 2;
            
            // console.log(texU, iTexU, texU - iTexU)
            var subTx = texU - iTexU;
            var subTy = texV - iTexV;
            
            if (subTx < 0) {
                subTx = 0;
            }
            
            if (subTy < 0) {
                subTy = 0;
            }
            
            var r = bilinearColorComponent(texPix, TL, TR, BL, BR, subTx, subTy, 0);
            var g = bilinearColorComponent(texPix, TL, TR, BL, BR, subTx, subTy, 1);
            var b = bilinearColorComponent(texPix, TL, TR, BL, BR, subTx, subTy, 2);

            stroke(r, g, b);
            point(xPos + x, yPos + y);
        }
    }
}

enableContextMenu();

function gridify(imgData, div) {
    var grid = [];
    for (var y = 0; y < imgData.height; y++) {
        var row = [];
        for (var x = 0; x < imgData.width; x++) {
            var d = imgData.data[(x + y * imgData.width) << 2];
            row.push((d / div).toFixed(2));
        }
        grid.push(row);
    }
    return grid.join("\n");
}

console.log(gridify(tex.imageData, 1));

putBilinearImageData(tex.imageData, 0, 0, 100, 100);
console.log(gridify(get(0, 0, 5, 5).imageData, 1));

draw = function() {
    stroke(255, 0, 0);
    noFill();
    background(255, 255, 255);
    putBilinearImageData(tex.imageData, 50, 50, 300, 300);
    
    // draw = function() {};
    if (keyIsPressed) {
        background(255, 255, 255);
        image(tex, 50, 50, 300, 300);
    }
    
};


