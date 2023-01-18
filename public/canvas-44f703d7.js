onconnect = e => {
    
    const port = e.ports[0];
    const TOP_OFFSET = 10;
    
    let playCanvas = null;
    let playCtx = null;
    
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
    };


    port.onmessage = e => {

        if(e.data.playCanvas){
            playCanvas = e.data.playCanvas;
            playCtx = playCanvas.getContext('2d');
        }


        else if (e.data.leftCanvas);


        else if (e.data.resize){
            
            const d = e.data.resize;
            if (d.type === 'playhead'){
                playCanvas.width = Math.round(d.width);
                playCanvas.height = Math.round(d.height);
                drawPlayhead(playCtx, lastpp, TOP_OFFSET, d.height - TOP_OFFSET);
            }
            
            else if (d.type === 'leftArea');
        
        }

        else if (e.data.addMeter);
        
        else if (e.data.tick){
            // let frame = e.data.tick - 0;
            // if (frame < 0){
            //     frame = 0
            // }

            const pixelPosition = Math.round(e.data.tick / e.data.fpp);
            console.log(e.data, pixelPosition);
            drawPlayhead(playCtx, pixelPosition, TOP_OFFSET, playCanvas.height - TOP_OFFSET);
            lastpp = pixelPosition;
        }
    };
};
//# sourceMappingURL=canvas-44f703d7.js.map
