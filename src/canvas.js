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
        cx.clearRect(leftOffset - 10, 0, 20, playCanvas.height)
        cx.beginPath();
        cx.moveTo(leftOffset, topOffset);
        cx.lineTo(leftOffset, length);
        cx.stroke();
       
       
    }


    port.onmessage = e => {

        if(e.data.playCanvas){
            playCanvas = e.data.playCanvas;
            playCtx = playCanvas.getContext('2d');
        }

        else if (e.data.resize){
            const d = e.data.resize;
            if (d.type === 'playhead'){
                playCanvas.width = Math.round(d.width);
                playCanvas.height = Math.round(d.height);
                drawPlayhead(playCtx, lastpp, TOP_OFFSET, d.height - TOP_OFFSET);

            }
        }
        
        else if (e.data.tick){
            const pixelPosition = e.data.tick / e.data.fpp;
            drawPlayhead(playCtx, pixelPosition, TOP_OFFSET, playCanvas.height - TOP_OFFSET);
            lastpp = pixelPosition;
            
        }
    }
};

