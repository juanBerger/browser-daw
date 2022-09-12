console.log(window.OffscreenCanvas)

const canvas = document.getElementById('canvas');
const workerCanvas = canvas.transferControlToOffscreen();
const renderWorker = new Worker('renderWorker.js')
renderWorker.postMessage({offCanvas: workerCanvas}, [workerCanvas])
