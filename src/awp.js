
import { v5 as uuidv5 } from 'uuid';
import { _generateWaveForm, _wavParser, _castToFloat } from './file_utils.js'


class AWP extends AudioWorkletProcessor {

	constructor() { 
		
		super()
		
		this.canvasPort;
		this.tickBuffer = 10;
		this.wasPlaying = false;

		this.port.onmessage = e => {
			
			if (e.data.playToggle){
				this.Transport.isPlaying = !this.Transport.isPlaying
				//this.Transport.fpp = e.data.fpp;
			}

			else if (e.data.uiUpdate){
				this.Transport.syncStackOnUpdate(e.data.uiUpdate);
				this.Transport.timeLine.syncOnUpdate(e.data.uiUpdate);
			}

			else if (e.data.fppUpdate){
				this.Transport.fpp = e.data.fppUpdate;
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
				this.Transport.clearFromStack(e.data.clear.clipId);
				this.Transport.timeLine.clear(e.data.clear.clipId, true);

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
					
					//console.log(filename, fileId)
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
				
				 //'foreign keys' --> startSlot: clipId / endSlot: clipId. This allows looking up clipIds by time slot. 
				 //you can then get the uiUpdate object with data[clipId]
				maps: {},
				
				syncOnUpdate (uiUpdate){
												
					let prev = this.data[uiUpdate.clipId];
					
					if (prev){
						
						const pSslot = prev.start - (prev.start % 128);
						const pEslot = prev.end - (prev.end % 128);
						const startList = this.maps[pSslot];
						const endList = this.maps[pEslot];
						
						if (startList){
							startList.forEach((uiUp, i) => {
								if (uiUp.id === prev.clipId)
									startList.splice(i, 1);
							})
						
							if (startList.length <= 0)
								delete this.maps[pSslot];
						}


						if (endList){
							endList.forEach((uiUp, i) => {
								if (uiUp.id === prev.clipId)
									endList.splice(i, 1);
							})
						
							if (endList.length <= 0){
								delete this.maps[pEslot];
							}
						}

					}


					const start = uiUpdate.start;
					const startSlot = start - (start % 128);
					const startList = this.maps[startSlot];
					const startUpdate = {id: uiUpdate.clipId, type: 'start'};

					if (!startList){
						this.maps[startSlot] = [startUpdate]
					}
					
					else {
						startList.push(startUpdate)
					}

					const end = uiUpdate.end;
					const endSlot = end - (end % 128);
					const endList = this.maps[endSlot];
					const endUpdate = {id: uiUpdate.clipId, type: 'end'}
					if (!endList){
						this.maps[endSlot] = [endUpdate]
					}

					else {
						endList.push(endUpdate)
					}

					this.data[uiUpdate.clipId] = uiUpdate;
					//console.log('xxxxx MAPS xxxxx', this.maps);
				},

				clear(clipId){

					let prev = this.data[clipId];
					
					if (prev){
						const pSslot = prev.start - (prev.start % 128);
						const pEslot = prev.end - (prev.end % 128);
						delete this.maps[pSslot];
						delete this.maps[pEslot];
						delete this.data[clipId];
					}

				},


				//clipId: {uiUpdate}
				data: {} 

			},

			stack: [],

			clearFromStack(clipId){
				
				for (const [i, s] of this.stack.entries()){
					if (s.clipId === clipId){
						this.stack.splice(i, 1);
						console.log('[Clearing From Stack On Deletion]...', clipId);
					}
				}

				
			},


			syncStackOnUpdate(uiUpdate){
				
				for (const [i, s] of this.stack.entries()){
					if (s.clipId === uiUpdate.clipId){
						console.log('[Removing From Stack On Update]...', uiUpdate.clipId);
						this.stack.splice(i, 1);
					}
				}

				if (this.frameNumber  > uiUpdate.start && this.frameNumber < uiUpdate.end){
					console.log('[Adding To Stack On Update]...', uiUpdate.clipId);
					this.stack.push(uiUpdate);
				}

			},

			syncStackOnBoundries(){

				const tlObjects = this.timeLine.maps[this.frameNumber];
				
				if (tlObjects){
					
					tlObjects.forEach((tlObject, i) => {

						const uiUpdate = this.timeLine.data[tlObject.id];
						
						if (tlObject.type === 'start'){
							this.stack.push(uiUpdate);
							console.log('[Adding To Stack On Boundry]...', uiUpdate.clipId);
						}

						else {
		
							this.stack.forEach((s, i) => {
								if (s.clipId === uiUpdate.clipId){
									this.stack.splice(i, 1);
									console.log('[Removing From Stack On Boundry]...', uiUpdate.clipId);
								}
							})	
						}

					})

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


	//during playback --> check if current frameNumber corresponds to add or remove from stack
	//on uiUpdae --> for each update object check if the clipId exists on the stack, if so remove it
	//on uiUpdate --> for each update object, check if the current frameNumber is between start and stop, 
	// 					if it is and the uiObject is not already on the stack, add it

	//each tick advances 128 frames when playback is started
	process (inputs, outputs, parameters) {
		
		if (this.Transport.isPlaying){			

			this.Transport.syncStackOnBoundries();
			
			let P = this.Transport.frameNumber;
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
			this.wasPlaying = true;
		}

		else if (this.wasPlaying){
			this.wasPlaying = false;
			//this.Transport.clearStack();
		}


		return true
	}
}
  
  registerProcessor('awp', AWP)

