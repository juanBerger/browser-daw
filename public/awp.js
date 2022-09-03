
import { v5 as uuidv5 } from 'uuid';

class AWP extends AudioWorkletProcessor {

	constructor() { 
		
		super()

		this.port.onmessage = e => {
			
			if (e.data.playState){
				console.log(e.data.playState)
				this.Transport.updateState(e.data)
			}

			else if (e.data.snap){
				this.Transport.snap(e.data.snap)
				if (!this.Transport.isPlaying)
					this.Transport.snapSearch(this.Files);

			}

			else if (e.data.file){
				let id = this.Files.add(e.data.file, e.data.filename)
				this.port.postMessage({id: id})
			}

			else if (e.data.getWaveform != null){
				let response = null;
				if (e.data.getWaveform in this.Files.files){
					response = this.Files.files[e.data.getWaveform]
				}
				
				this.port.postMessage({setWaveform: response.waveform})
			}

			else if (e.data.clear){
				this.Transport.removeMetas(e.data.clear.clipId)
				this.Files.removeMeta(e.data.clear.fileId, e.data.clear.clipId)

			}

			else if (e.data.trims){
				
				let fileObj = this.Files.files[e.data.trims.fileId] 
				
				//proceed with update if the file exists (it should)
				if (fileObj){ 

					let clipId = e.data.trims.clipId
					let prevMeta = fileObj.metas[clipId] //get previous meta for this clipID

					//prepare new meta
					let meta = e.data.trims.meta
					meta.push(e.data.trims.clipId) //add clipId to meta
					meta.push(e.data.trims.fileId) //add fileId to meta
					meta.push(e.data.trims.trackId) //add trackId to meta

					if (!this.Tracks.tracks[e.data.trims.trackId]){
						console.log('Adding Ampliutude array')
						this.Tracks.tracks[e.data.trims.trackId] = {amplitude: this.Tracks.genertateAmplitudeArray()}
					}

					//new meta -- -- -- -- -- -- -- -- //
					//find this meta and replace it (if it exists) in 3 locations. Timeline, transport, files
					
					this.Transport.syncMetaObjects(meta, prevMeta)
					fileObj.metas[clipId] = meta
					
				}

				
			}
		}
		
		this.Files = {

			files: {},
			NAMESPACE: 'd176d515-5974-40b9-b5c0-1b21800f1684',

			_generateWaveForm(audio, dType){

				const scaler = (value, oldMin, oldMax, newMin, newMax) => {
					return (newMax - newMin) * (value - oldMin	) / (oldMax - oldMin) + newMin
				}
				
				const typeRanges = {
					'int16': [-32768, 32767]
				}

				let density = 200; //has to be density % numChannels = 0 --> this means next chunk always starts on a L sample if we index starting at 0 (and we are interleaved)
				const height = 4000; //this is in pixels and is arbitrary since varying track heights will stretch and squash whatever the instrinsic height actually is. There is prob a sane default here
            	const channels = 2;

				let points = [];
				let x = 0;

				for (let i=0; i < audio.length; i += density){ 
					let scaled = Math.round(scaler(audio[i], typeRanges[dType][0], typeRanges[dType][1], 0, height))
					points.push(String(x) + ',' + String(scaled))
					x++        
				}
			
				const result = {
					points: points,
					sampleLength: audio.length,
					height: height,
					density: density,
					channels: channels,

				}

				return result
			},

			removeMeta(fileId, clipId){
				let fileObj = this.files[fileId];
				if (fileObj){
					fileObj.metas[clipId] ? 
					delete fileObj.metas[clipId] : 
					console.error('Clip Id Not Found In Files.files');
				}
				
				console.log(this.files)
			},


			//https://github.com/pierrec/js-xxhash try this to create a hash
			add(audioBuffer, filename){
				
				let fileId = uuidv5(filename, this.NAMESPACE)

				if (fileId in this.files){
					console.warn('File already in the bin')
					return fileId
				}
				
				else {
					
					//use wav parser util to check data type
					const audio = new Int16Array(audioBuffer.slice(44, audioBuffer.byteLength)) //int16 only for now
					const waveform = this._generateWaveForm(audio, 'int16')

					this.files[fileId] = {
						audio: audio,
						waveform: waveform,
						metas: {}, // {clipId: [start, leftTrim, rightTrim, clipId, fileId]} // how to be less redundant here
						playbackOffset: 0,
					}
					
					console.log(filename, fileId)
					return fileId

				}
			}

		}

		this.Tracks = {

			genertateAmplitudeArray(){
				return new Float32Array(128)
			},

			tracks: {} 
		}

		this.Transport = {
			
			isPlaying: false,
			frameNumber: 0,
			timeline: {},
			stack: [],

			tick(frames){ this.frameNumber += frames; },
			snap(frameNumber){ this.frameNumber = frameNumber},

			clearStack(){
				this.stack = [];
				console.log('Cleared Transport Stack')
			},

			updateState(updateObj){
				
				if(updateObj.playState === 'play') 
					this.isPlaying = true;
				else {
					this.isPlaying = false;
					this.snap(updateObj.startPos)
					//this.clearStack();
					
				}				
			},

			//check if current transport position overlaps any entries in the timeline object - if so,
			//add to the transport stack
			snapSearch(Files){
				for (const entry in this.timeline){
					for (const [i, m] of this.timeline[entry].entries()){
						let fileObj = Files.files[m[4]];
						let channels = fileObj.waveform.channels
						if (this.frameNumber > m[0] && this.frameNumber < (fileObj.audio.length / channels) - m[2]){
							
							//see if it already exists in the transport stack, if not, add it
							for (const stackMeta of this.stack) {
								if (m[3] === stackMeta[3]){
									console.log('Already on the stack')
									return;
								}
							}

							console.log('Adding to stack')
							this.stack.push(m)

						}
					
					}

				}
			},

			removeMetas(clipId){
				
				for (const slot in this.timeline) {
					let metas = this.timeline[slot]
					for (const [i, m] of metas.entries()){
						if (m[3] === clipId){
							metas.splice(i, 1)
							console.log('Deleted clip removed from timeline slot(s)');
						}
					}
				}

				for (const [i, m] of this.stack.entries()){
					if (m[3] === clipId){
						this.stack.splice(i, 1)
						console.log('Deleted clip removed from transport stack');
					}
				}
			},

			syncMetaObjects(meta, prevMeta) {

				//if the meta is on the transport stack, update it
				for (const [i, m] of this.stack.entries()){
					if (m[3] === meta[3]){
						//console.log('Updating Existing Transport Stack Entry')
						this.stack[i] = meta
					}
				}


				//get the prev timeline slot of this meta (if there is one) and remove it from there
				if (prevMeta){
					let prevSlot = prevMeta[0] - (prevMeta[0] % 128)
					let slotMetas = this.timeline[prevSlot]
					if (slotMetas){
						for (const [i, m] of slotMetas.entries()){
							if (m[3] === meta[3]) { //if clipIds match
								slotMetas.splice(i, 1) //remove the old meta entry
								if (slotMetas.length <= 0) // if there are no more metas in this timeline slot, remove the slot
									delete this.timeline[prevSlot]
							}
						}
					}
				}
				
				

				//add to the new timeline slot or create a new slot if needed
				let slot = meta[0] - (meta[0] % 128)
				if (this.timeline[slot]){ //the needed slot already exists, check if this meta already exists there (redundant probably)
					for (const [i, m] of this.timeline[slot].entries()){
						if (m[3] === meta[3]) { //this should never happen if the above worked
							console.log('Updating Timeline Slot')
							this.timeline[slot][i] = meta
							return
						}
					}
				
					this.timeline[slot].push(meta) // the meta doesn't exist so add it to this slot
				
				}

				else {
					this.timeline[slot] = [meta] //the slot never existed so create it and add the meta
				}
				
				//if playhead position is currently ahead of start time and it's not already there
				//add this to the transport stack
				if (this.frameNumber >= meta[0]){
					for (const [i, m] of this.stack.entries()){
						if (m[3] === meta[3]){ return }
					}

					console.log('Back adding to tranport stack')
					this.stack.push(meta)
				}
			}
		}

	}


	//trackObject

	//each tick advances 128 frames when playback is started
	process (inputs, outputs, parameters) {
		
		let outputDevice = outputs[0]
		let frames = outputDevice[0].length

		if (this.Transport.isPlaying){			
			
			let P = this.Transport.frameNumber
			let metas = this.Transport.timeline[P]
			if (metas){
				metas.forEach(meta => this.Transport.stack.push(meta))
			}

			if (this.Transport.stack.length > 0){

				//run through 0 to 127
				for (let frame = 0; frame < frames; frame++){	

					P = this.Transport.frameNumber + frame


					for (const [index, meta] of this.Transport.stack.entries()){
					
						let fileObj = this.Files.files[meta[4]];
						let idx = P - meta[0];
						let ampliArray = this.Tracks.tracks[meta[5]].amplitude;
						ampliArray[frame] = 0; //clear any previous amplitude

						if (idx >= 0) {
						
							let channels = fileObj.waveform.channels
							idx += meta[1]

							if (idx > ((fileObj.audio.length / channels) - meta[2])){
								console.log('Item removed from transport stack');
								this.Transport.stack.splice(index, 1);
								continue;
							}
							
							
							for (let ch = 0; ch < channels; ch++){
								idx += ch          
								let sample = fileObj.audio[idx * channels] / 32768 //scale the value of idx to +/- playback speed
								
								if (ch === 0){
									let sq = sample * sample
									ampliArray[0] += sq
								}
								
								// if (sample > 0.99 || sample < -0.99){
								// 	console.log(sample)
								// }

								//this is for summing all tracks, but fails when we move clips around
								let prevValue = outputDevice[ch][frame]
								sample += prevValue
								
								sample > 1.0 ? sample = 1.0 : sample = sample
								sample < -1.0 ? sample = -1.0 : sample = sample

								outputDevice[ch][frame] = sample
							}

						
						}

					}

				}


				for (const track in this.Tracks.tracks){
					let amp = this.Tracks.tracks[track].amplitude[0]
					let rms = Math.sqrt((1/128) * amp);
					this.port.postMessage({amplitude: {track: track, amplitude: rms}})
				}
			
			}
			
			this.Transport.tick(frames)
			this.port.postMessage({tick: this.Transport.frameNumber})
		}


		return true
	}
}
  
  registerProcessor('awp', AWP)

















//check for any metas for this clip id that already exist
					//find the timeline slot it currently occupies and remove it from there
					//let prevMeta = fileObj.metas[clipId]
					// if (prevMeta){
					// 	let prevSlot = prevMeta[0] - (prevMeta[0] % 128)
						
					// 	delete this.Files.timeline[prevSlot]
					// }

					//update fileObj - do we still need this structure as it is?
					//fileObj.metas[clipId] = meta
									
					//check the transport stack for this meta
					// for (const [i, m] of this.Transport.stack.entries()){
					// 	if (m[3] === clipId) {
					// 		console.log('Replacing Transport Slot')
					// 		this.Transport.stack[i] = meta
					// 	}
					// }

					//calculate new slot
					//let slot = fileObj.metas[clipId][0] - (fileObj.metas[clipId][0] % 128)
					
					//if slot already exists - check attached metas and see if any match our clipID
					//meta: --> [start, leftTrim, rightTrim, clipId, fileID]
					//if (this.Files.timeline[slot]){
						
						// for (const [i, m] of this.Files.timeline[slot].entries()){
						// 	if (m[3] === clipId) {
						// 		console.log('Replacing Timeline Slot')
						// 		this.Files.timeline[slot][i] = meta
						// 		return
						// 	}
						// }

						//if this clip is new to this slot, just add it
						//this.Files.timeline[slot].push(meta)
					//}

					//else {

						//if the slot doesn't exist -- create it and add the meta
						//this.Files.timeline[slot] = [fileObj.metas[clipId]]
					//}






  