{
    const VERT = 0;
    const QUAD = 1;
    const HOLE = 2;

    let bitmapCache = {};

    function renderGlyph(ctx, glyph, x, y, sz) {
        // render the glyph
        let i = 0;
        let isShapeStart = true;
        var startX = 0;
        var startY = 0;
        while (i < glyph.length) {
            let shape = glyph[i];
            if (shape === HOLE) {
                i++;
                if (!isShapeStart) {
                    isShapeStart = true;
                    ctx.closePath();
                    ctx.fill();
                }
                // hole shapes are white
                ctx.fillStyle = "rgb(255, 255, 255)";
            }
            
            if (isShapeStart) {
                // non hole shapes are black
                if (shape !== HOLE) {
                    ctx.fillStyle = "rgb(0, 0, 0)";
                }
                ctx.beginPath();
            }
            
            // draw each shape command
            shape = glyph[i];
            if (shape === VERT) {
                const xPos = x + glyph[i+1] * sz;
                const yPos = y + glyph[i+2] * sz;
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
                const cpxPos = x + glyph[i+1] * sz;
                const cpyPos = y + glyph[i+2] * sz;
                const xPos = x + glyph[i+3] * sz;
                const yPos = y + glyph[i+4] * sz;
                ctx.quadraticCurveTo(cpxPos, cpyPos, xPos, yPos);

                // if (xPos === startX && yPos === startY) {
                //     isShapeStart = true;
                //     ctx.fill();
                //     i += 5;
                //     continue;
                // }
                
                i += 5;
            }
    
            if (isShapeStart) {
                isShapeStart = false;
            }
            
            // fill glyph if we've reached the end of the glyph data
            if (i === glyph.length) {
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    function cacheGlyph(char, font, sz) {
        const glyphInfo = font.glyphInfo(char.charCodeAt(0));
        const glyph = font.glyphs[glyphInfo.index1];

        const metrics = QOF.measureText(char, font, sz);

        const cacheKey = font.name + " " + sz + " " + char;
        if (metrics.actualWidth === 0 || metrics.actualHeight === 0) {
            bitmapCache[cacheKey] = null;
        } else {
            let canvas = document.createElement("canvas");
            canvas.width = Math.round(metrics.actualWidth + 1);
            canvas.height = Math.round(metrics.actualHeight + 1);
            let ctx = canvas.getContext("2d");

            canvas.style.border = "1px solid red";
            canvas.style.padding = "0px";
            document.body.append(canvas);

            const x = metrics.actualBoundingBoxLeft;
            const y = metrics.actualBoundingBoxAscent;
            
            renderGlyph(ctx, glyph, -x, y, sz);

            // create grayscale bitmap of glyph
            let imgData;
            if (canvas.width === 0 || canvas.height === 0) {
                imgData = [];
            } else {
                imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
            let pix = imgData.data;
            let usedPixLen = pix.length;
            let usedCanvasHeight = canvas.height;

            // console.log(char, Math.abs(canvas.height - metrics.actualHeight))
            if (canvas.height - metrics.actualHeight > 0.3) {
                canvas.style.border = "1px solid blue";
            }

            let cacheBitmap = new Uint8Array(usedPixLen / 4);
            for (let i = 0; i < usedPixLen; i += 4) {
                if (pix[i] === 0) {
                    if (pix[i+3] > 0) {
                        pix[i] = 255 - pix[i+3];
                    } else {
                        // pixel is transparent so set it to background color
                        pix[i] = 255;
                    }
                }
                cacheBitmap[i / 4] = pix[i];
            }

            bitmapCache[cacheKey] = {
                bitmap: cacheBitmap,
                box: [x, y, canvas.width, usedCanvasHeight]
            };
        }
    }

    function compositePixel(pixels, idx, r, g, b, a) {
        const nA = a / 255.0;
        const oR = pixels[idx] * (1.0 - nA);
        const oG = pixels[idx+1] * (1.0 - nA);
        const oB = pixels[idx+2] * (1.0 - nA);
        
        const nR = r * nA;
        const nG = g * nA;
        const nB = b * nA;

        pixels[idx  ] = oR + nR;
        pixels[idx+1] = oG + nG;
        pixels[idx+2] = oB + nB;
    }

    function renderBitmapGlyph(dest, bitmap, bitmapWidth, clr) {
        let pix = dest.data;
        // if (clr[3] === 255) {
        //     for (let i = 0; i < pix.length; i += 4) {
        //         const dx = (i >> 2) % dest.width;
        //         const dy = ((i >> 2) / dest.width)|0;
        //         const dIdx = ((dx|0) + (dy|0) * dest.width) << 2;
        //         const bIdx = (dx*2 + dy*2 * bitmapWidth) << 0;
        //         // console.log(bIdx, bitmap.length)
        //         if (bitmap[bIdx] !== 255) {
        //             if (bitmap[bIdx] === 0) {
        //                 pix[dIdx] = clr[0];
        //                 pix[dIdx+1] = clr[1];
        //                 pix[dIdx+2] = clr[2];
        //             } else {
        //                 compositePixel(pix, dIdx, clr[0], clr[1], clr[2], 255-bitmap[bIdx]);
        //             }
        //         }
        //         // pix[dIdx] = dx * 20;
        //         // pix[dIdx+1] = dy * 20;
        //         // pix[dIdx+2] = 0;
        //     }
        // } else {
        //     // for (let i = 0; i < pix.length; i += 4) {
        //     //     const bIdx = i / 4;
        //     //     if (bitmap[bIdx] !== 255) {
        //     //         compositePixel(pix, i, clr[0], clr[1], clr[2], clr[3]-(bitmap[bIdx]/255*clr[3]));
        //     //     }
        //     // }
        // }
        if (clr[3] === 255) {
            for (let i = 0; i < pix.length; i += 4) {
                const bIdx = i / 4;
                if (bitmap[bIdx] !== 255) {
                    if (bitmap[bIdx] === 0) {
                        pix[i] = clr[0];
                        pix[i+1] = clr[1];
                        pix[i+2] = clr[2];
                    } else {
                        compositePixel(pix, i, clr[0], clr[1], clr[2], 255-bitmap[bIdx]);
                    }
                }
            }
        } else {
            for (let i = 0; i < pix.length; i += 4) {
                const bIdx = i / 4;
                if (bitmap[bIdx] !== 255) {
                    compositePixel(pix, i, clr[0], clr[1], clr[2], clr[3]-(bitmap[bIdx]/255*clr[3]));
                }
            }
        }
    }

    function renderText(ctx, txt, x, y, myFont, sz, clr, wrapWidth) {
        // split the text into lines and loop through each line
        const lines = txt.split("\n");
        for (let l = 0; l < lines.length; l++) {
            const line = lines[l];
            const wordWidths = line.split(" ").map((word) => QOF.measureText(word, myFont, sz).fontWidth);
            let wordIdx = 0;

            // the offset from origin of the current glyph
            let xOff = 0;
            // loop through all characters in each line
            for (let t = 0; t < line.length; t++) {
                let char = line.charAt(t);
                const glyphInfo = myFont.glyphInfo(char.charCodeAt(0));

                if (glyphInfo.index1 === 0) {
                    char = "\x00";
                }

                const cacheKey = myFont.name + " " + sz + " " + char;
                if (bitmapCache[cacheKey] === undefined) {
                    cacheGlyph(char, myFont, sz);
                }

                // apply word wrapping
                if (char === " ") {
                    wordIdx++;
                } else if (t > 0 && line[t-1] === " " && xOff + wordWidths[wordIdx] > wrapWidth) {
                    xOff = 0;
                    y += (myFont.ascent + myFont.descent) * sz * 1.2;
                }
                
                // render the glyph
                if (bitmapCache[cacheKey] !== null) {
                    const cachedData = bitmapCache[cacheKey];
                    const bitmap = cachedData.bitmap;
                    const cacheXOff = cachedData.box[0];
                    const cacheYOff = cachedData.box[1]; 
                    const cacheWidth = cachedData.box[2];
                    const cacheHeight = cachedData.box[3];

                    // apply kerning
                    const kern = myFont.kerning[line.charAt(t-1) + char];
                    if (kern !== undefined) {
                        xOff += kern * sz;
                    }

                    const xPos = Math.round(x + xOff + cacheXOff);
                    let yPos = y - cacheYOff + 1; // +1 for canvas height pad
                    if (yPos + cacheHeight < Math.round(y)) {
                        yPos = Math.ceil(yPos);
                    } else {
                        yPos = yPos | 0;
                    }
                    
                    ctx.strokeStyle = "rgba(255, 0, 0, 100)"
                    // ctx.strokeRect(xPos, yPos, cacheWidth, cacheHeight);
                    
                    if (cacheWidth !== 0 && cacheHeight !== 0) {
                        let imgData = ctx.getImageData(xPos, yPos, cacheWidth, cacheHeight);
                        renderBitmapGlyph(imgData, bitmap, cacheWidth, clr);
                        ctx.putImageData(imgData, xPos, yPos);
                    }

                    const glyph = myFont.glyphs[glyphInfo.index1];
                    // renderGlyph(ctx, glyph, x + xOff, y, sz);
                }
                
                // update glyph x offset
                xOff += glyphInfo.width * sz;
            }
            
            // update glyph y position
            y += (myFont.ascent + myFont.descent) * sz * 1.2;
        }
    }

    QOF.renderText = renderText;
}
