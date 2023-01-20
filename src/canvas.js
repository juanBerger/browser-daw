onconnect = e => {
    
    const port = e.ports[0];
    const TOP_OFFSET = 10;
    
    let playCanvas = null;
    let playCtx = null;

    let leftCanvas = null;
    let leftCtx = null;
    
    let lastpp = 0;


    const drawPlayhead = (cx, leftOffset, topOffset, length) => {
        
        cx.strokeStyle = "rgba(212, 73, 243, 0.635)";
        cx.lineWidth = 3;
        cx.lineCap = 'round';
        cx.clearRect(0, 0, playCanvas.width, playCanvas.height);
        cx.beginPath();
        cx.moveTo(leftOffset, topOffset);
        cx.lineTo(leftOffset, length);
        cx.stroke();  
    }


    // const drawMeter = (cx, leftCanvas, topOffset) => {

    //     const meterWidth = 7;
    //     const xOffset = leftCanvas.width - (meterWidth + 2);
        
    //     cx.fillStyle = 'blue';
    //     cx.fillRect(xOffset, 0, meterWidth, 120);
        
    //     // let grd = cx.createLinearGradient(0, 0, 100, 100)
    //     // grd.addColorStop(0, 'green');
    //     // grd.addColorStop(0.5, 'yellow');
    //     // cx.fillStyle = grd
    //     // cx.beginPath();
    //     // cx.rect(0, 0, leftCanvas.width, leftCanvas.height)
    //     // console.log('drawMeter')
    // }


    port.onmessage = e => {

        if(e.data.playCanvas){
            playCanvas = e.data.playCanvas;
            playCtx = playCanvas.getContext('2d');
        }


        else if (e.data.leftCanvas){
            //leftCanvas = e.data.leftCanvas;
            //leftCtx = leftCanvas.getContext('2d');
        }


        else if (e.data.resize){
            
            const d = e.data.resize;
            if (d.type === 'playhead'){
                playCanvas.width = Math.round(d.width);
                playCanvas.height = Math.round(d.height);
                drawPlayhead(playCtx, lastpp, TOP_OFFSET, d.height - TOP_OFFSET);
            }
            
            else if (d.type === 'leftArea'){
                
                // leftCanvas.width = Math.round(d.width);
                // leftCanvas.height = Math.round(d.height);
                // drawMeter(leftCtx, leftCanvas);

            }
        
        }

        else if (e.data.addMeter){

        }
        
        else if (e.data.tick){
            const pixelPosition = Math.round(e.data.tick / e.data.fpp);
            drawPlayhead(playCtx, pixelPosition, TOP_OFFSET, playCanvas.height - TOP_OFFSET);
            lastpp = pixelPosition;
        }

        // else if (e.data.snap){
            
        //     const pixelPosition = Math.round(e.data.snap);
        //     drawPlayhead(playCtx, pixelPosition, TOP_OFFSET, playCanvas.height - TOP_OFFSET);
        //     lastpp = pixelPosition;
        // }
    }
};

 