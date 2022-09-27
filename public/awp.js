
import { v5 as uuidv5 } from 'uuid';
import { _generateWaveForm, _wavParser, _castToFloat } from './file_utils.js'


class AWP extends AudioWorkletProcessor {

	constructor() { 
		
		super()
		
		this.canvasPort;
		this.tickBuffer = 10;

		this.port.onmessage = e => {
			
			if (e.data.playToggle){
				this.Transport.isPlaying = !this.Transport.isPlaying
				this.Transport.fpp = e.data.fpp;
			}

			else if (e.data.uiUpdate){
				this.Transport.timeLine.update(e.data.uiUpdate);
			}

			else if (e.data.file){
				const id = this.Files.add(e.data.file, e.data.filename)
				this.port.postMessage({id: id})
			}

			else if (e.data.addTrack >= 0){
				this.Tracks.add(e.data.addTrack)
			}

			else if (e.data.getWaveform != null){
				let response = null;
				if (e.data.getWaveform in this.Files.files){
					response = this.Files.files[e.data.getWaveform]
				}
				
				this.port.postMessage({setWaveform: response.waveform})
			}


			else if (e.data.clear){
				//this.Transport.removeMetas(e.data.clear.clipId)
				//this.Files.removeMeta(e.data.clear.fileId, e.data.clear.clipId)

			}

			else if (e.data.canvasPort){
				this.canvasPort = e.data.canvasPort;	
			}

			else if (e.data.resize){
				this.canvasPort.postMessage(e.data)
			}

		}
		
		this.Files = {

			files: {},
			NAMESPACE: 'd176d515-5974-40b9-b5c0-1b21800f1684',

			add(audioBuffer , filename){
				
				let fileId = uuidv5(filename, this.NAMESPACE)

				if (fileId in this.files){
					console.warn('File already in the bin')
					return fileId
				}
				
				else {
					
					//use wav parser util to check data type
					const byteView = new Uint8Array(audioBuffer)
					const parsedHeader = _wavParser(byteView)
					const audio = new Int16Array(byteView.buffer.slice(parsedHeader.dataStart, parsedHeader.dataEnd))
					const waveform = _generateWaveForm(audio, 'int16')
					const floatAudio = _castToFloat(audio);


					this.files[fileId] = {
						audio: floatAudio,
						waveform: waveform, //{points: [points], sampleLength: len, height: height, density: density, channels: channels}
						playbackOffset: 0,
					}
					
					console.log(filename, fileId)
					return fileId

				}
			}

		}

		this.Tracks = {
			
			tracks: {}, 
			
			add(trackId){
				
				const newTrack = {
					
					// left: new Float32Array(128),
					// right: new Float32Array(128), 
					gain: 1,
					muted: false
				}
				
				this.tracks[trackId] = newTrack;

			}
		
		}

		this.Transport = {
			
			isPlaying: false,
			fpp: 0,
			frameNumber: 0,
			timeLine: {
				
				maps: {}, //'foreign keys'
				
				update (uiUpdate, clear=false){
									
					let prev = this.data[uiUpdate.clipId];
					
					if (prev){
						const pSslot = prev.start - (prev.start % 128);
						const pEslot = prev.end - (prev.end % 128);
						delete this.maps[pSslot];
						delete this.maps[pEslot];
					}

					if (clear){
						delete this.data[uiUpdate.clipId];
						return
					}

					const start = uiUpdate.start;
					const startSlot = start - (start % 128);
					this.maps[startSlot] = uiUpdate.clipId;

					const end = uiUpdate.end;
					//const end = start + (filesObj.files[uiUpdate.fileId].audio.length / 2 - uiUpdate.trims[1])
					const endSlot = end - (end % 128);
					this.maps[endSlot] = uiUpdate.clipId;
				
					this.data[uiUpdate.clipId] = uiUpdate;

					console.log(this.maps, this.data);
				},

				data: {} //clipId: {uiUpdate}

			},

			stack: [],

			/*
				start: position * get(framesPerPixel),
				trims: [clipTrims[0], clipTrims[1]],
				trackId: trackId,
				fileId: fileId,
				clipId: clipId

			*/
			updateStack(){

				const clipId = this.timeLine.maps[this.frameNumber];
				
				if (clipId){

					const uiUpdate = this.timeLine.data[clipId];

					if (uiUpdate.start - this.frameNumber >= 0)
						this.stack.push(uiUpdate);
					
					else {
						
						for (const [i, s] of this.stack.entries()){
							if (s.clipId === uiUpdate.clipId){
								this.stack.slice(i, 1);
							}
						}

					}

				}

			},

			tick(frames){ this.frameNumber += frames; },
			snap(frameNumber){ this.frameNumber = frameNumber},

			//on playback stop
			clearStack(){
				this.stack = []; //consider keeping pointers or something for this....
				console.log('Cleared Transport Stack')
			},

		}
	}

	//each tick advances 128 frames when playback is started
	process (inputs, outputs, parameters) {
		
		if (this.Transport.isPlaying){			

			this.Transport.updateStack();
			
			const P = this.Transport.frameNumber;
			const channels = 2;
			const outputDevice = outputs[0];
			const outputL = outputDevice[0];
			const outputR = outputDevice[1];
			const frames = outputDevice[0].length;
			const stack = this.Transport.stack;
			const tracks = this.Tracks.tracks; //tracks: {trackId: {left: [typedArray], right: [typedArray], gain: number, muted: false}}

			//{start: start, end: end, trims: [trims], fileId: fileId, trackId: trackId}
			for (let i = 0; i < stack.length; i++){
				
				const entry = stack[i];
				const fileObj = this.Files.files[entry.fileId];
				const start = (entry.trims[0] + (P - entry.start)) * channels;
				const end = start + (frames * channels);
				
				
				const slice = fileObj.audio.subarray(start, end); //this should be 128 *  channels length
				// const offset = frames - (end - start); ////need this offset in case our slice does not fill a full 128 samples.
				// const trackL = tracks[entry.trackId].left;
				// const trackR = tracks[entry.trackId].right;

				const gain = tracks[entry.trackId].gain;
				
				for (let s = 0, frame = 0; s < slice.length; s++){
					if (s % 2 === 0){
						outputL[frame] += slice[s] * gain;
					}
						
					else{
						outputR[frame] += slice[s] * gain;
						frame++;
					}
				}

			}

			//only call this every x chunks?
			if (this.tickBuffer >= 10){
				this.tickBuffer = 0
				this.canvasPort.postMessage({tick: this.Transport.frameNumber, fpp: this.Transport.fpp}) //add computed RMS vlues for each channel for each track
			}
			
			this.Transport.tick(frames)
			this.tickBuffer++;
		}


		return true
	}
}
  
  registerProcessor('awp', AWP)


	// let fileObj = this.Files.files[e.data.trims.fileId] 

				// //proceed with update if the file exists (it should)
				// if (fileObj){ 

				// 	let clipId = e.data.trims.clipId
				// 	let prevMeta = fileObj.metas[clipId] //get previous meta for this clipID

				// 	//prepare new meta
				// 	let meta = e.data.trims.meta
				// 	meta.push(e.data.trims.clipId) //add clipId to meta
				// 	meta.push(e.data.trims.fileId) //add fileId to meta
				// 	meta.push(e.data.trims.trackId) //add trackId to meta

				// 	if (!this.Tracks.tracks[e.data.trims.trackId]){
				// 		console.log('Adding Ampliutude array')
				// 		this.Tracks.tracks[e.data.trims.trackId] = {amplitude: this.Tracks.genertateAmplitudeArray()}
				// 	}

				// 	//new meta -- -- -- -- -- -- -- -- //
				// 	//find this meta and replace it (if it exists) in 3 locations. Timeline, transport, files
					
				// 	this.Transport.syncMetaObjects(meta, prevMeta)
				// 	fileObj.metas[clipId] = meta
					
				// }






//   let metas = this.Transport.timeline[P]
// 			if (metas){
// 				metas.forEach(meta => this.Transport.stack.push(meta))
// 			}

// 			if (this.Transport.stack.length > 0){

// 				//run through 0 to 127
// 				for (let frame = 0; frame < frames; frame++){	

// 					P = this.Transport.frameNumber + frame


// 					for (const [index, meta] of this.Transport.stack.entries()){
					
// 						let fileObj = this.Files.files[meta[4]];
// 						let idx = P - meta[0];
// 						let ampliArray = this.Tracks.tracks[meta[5]].amplitude;
// 						ampliArray[frame] = 0; //clear any previous amplitude

// 						if (idx >= 0) {
						
// 							let channels = fileObj.waveform.channels
// 							idx += meta[1]

// 							if (idx > ((fileObj.audio.length / channels) - meta[2])){
// 								console.log('Item removed from transport stack');
// 								this.Transport.stack.splice(index, 1);
// 								continue;
// 							}
							
							
// 							for (let ch = 0; ch < channels; ch++){
// 								idx += ch          
// 								let sample = fileObj.audio[idx * channels] / 32768 //scale the value of idx to +/- playback speed
								
// 								if (ch === 0){
// 									let sq = sample * sample
// 									ampliArray[0] += sq
// 								}
								
// 								// if (sample > 0.99 || sample < -0.99){
// 								// 	console.log(sample)
// 								// }

// 								//this is for summing all tracks, but fails when we move clips around
// 								let prevValue = outputDevice[ch][frame]
// 								sample += prevValue
								
// 								sample > 1.0 ? sample = 1.0 : sample = sample
// 								sample < -1.0 ? sample = -1.0 : sample = sample

// 								outputDevice[ch][frame] = sample
// 							}

						
// 						}

// 					}


// for (const track in this.Tracks.tracks){
// 	let amp = this.Tracks.tracks[track].amplitude[0]
// 	let rms = Math.sqrt((1/128) * amp);
// 	//this.port.postMessage({amplitude: {track: track, amplitude: rms}})
// }




  


// snapSearch(Files){
// 	for (const entry in this.timeline){
// 		for (const [i, m] of this.timeline[entry].entries()){
// 			let fileObj = Files.files[m[4]];
// 			let channels = fileObj.waveform.channels
// 			if (this.frameNumber > m[0] && this.frameNumber < (fileObj.audio.length / channels) - m[2]){
				
// 				//see if it already exists in the transport stack, if not, add it
// 				for (const stackMeta of this.stack) {
// 					if (m[3] === stackMeta[3]){
// 						console.log('Already on the stack')
// 						return;
// 					}
// 				}

// 				console.log('Adding to stack')
// 				this.stack.push(m)

// 			}
		
// 		}

// 	}
// },

// removeMetas(clipId){
	
// 	for (const slot in this.timeline) {
// 		let metas = this.timeline[slot]
// 		for (const [i, m] of metas.entries()){
// 			if (m[3] === clipId){
// 				metas.splice(i, 1)
// 				console.log('Deleted clip removed from timeline slot(s)');
// 			}
// 		}
// 	}

// 	for (const [i, m] of this.stack.entries()){
// 		if (m[3] === clipId){
// 			this.stack.splice(i, 1)
// 			console.log('Deleted clip removed from transport stack');
// 		}
// 	}
// },

// syncMetaObjects(meta, prevMeta) {

// 	//if the meta is on the transport stack, update it
// 	for (const [i, m] of this.stack.entries()){
// 		if (m[3] === meta[3]){
// 			//console.log('Updating Existing Transport Stack Entry')
// 			this.stack[i] = meta
// 		}
// 	}


// 	//get the prev timeline slot of this meta (if there is one) and remove it from there
// 	if (prevMeta){
// 		let prevSlot = prevMeta[0] - (prevMeta[0] % 128)
// 		let slotMetas = this.timeline[prevSlot]
// 		if (slotMetas){
// 			for (const [i, m] of slotMetas.entries()){
// 				if (m[3] === meta[3]) { //if clipIds match
// 					slotMetas.splice(i, 1) //remove the old meta entry
// 					if (slotMetas.length <= 0) // if there are no more metas in this timeline slot, remove the slot
// 						delete this.timeline[prevSlot]
// 				}
// 			}
// 		}
// 	}
	
	

// 	//add to the new timeline slot or create a new slot if needed
// 	let slot = meta[0] - (meta[0] % 128)
// 	if (this.timeline[slot]){ //the needed slot already exists, check if this meta already exists there (redundant probably)
// 		for (const [i, m] of this.timeline[slot].entries()){
// 			if (m[3] === meta[3]) { //this should never happen if the above worked
// 				console.log('Updating Timeline Slot')
// 				this.timeline[slot][i] = meta
// 				return
// 			}
// 		}
	
// 		this.timeline[slot].push(meta) // the meta doesn't exist so add it to this slot
	
// 	}

// 	else {
// 		this.timeline[slot] = [meta] //the slot never existed so create it and add the meta
// 	}
	
// 	//if playhead position is currently ahead of start time and it's not already there
// 	//add this to the transport stack
// 	if (this.frameNumber >= meta[0]){
// 		for (const [i, m] of this.stack.entries()){
// 			if (m[3] === meta[3]){ return }
// 		}

// 		console.log('Back adding to tranport stack')
// 		this.stack.push(meta)
// 	}
// }
// }






			// else if (e.data.playState){
			// 	console.log(e.data.playState)
			// 	this.Transport.updateState(e.data)
			// }

			// else if (e.data.snap){
			// 	this.Transport.snap(e.data.snap)
			// 	if (!this.Transport.isPlaying)
			// 		this.Transport.snapSearch(this.Files);

			// }


// updateState(updateObj){
				
			// 	if(updateObj.playState === 'play') 
			// 		this.isPlaying = true;
			// 	else {
			// 		this.isPlaying = false;
			// 		this.snap(updateObj.startPos)
			// 		//this.clearStack();
					
			// 	}				
			// },

			//check if current transport position overlaps any entries in the timeline object - if so,
			//add to the transport stack



			// removeMeta(fileId, clipId){
			// 	let fileObj = this.files[fileId];
			// 	if (fileObj){
			// 		fileObj.metas[clipId] ? 
			// 		delete fileObj.metas[clipId] : 
			// 		console.error('Clip Id Not Found In Files.files');
			// 	}
				
			// 	console.log(this.files)
			// },