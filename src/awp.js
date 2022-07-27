
import { v5 as uuidv5 } from 'uuid';

class AWP extends AudioWorkletProcessor {

	constructor() { 
		
		super()

		this.port.onmessage = e => {
			
			if (e.data.playState){
				console.log(e.data.playState)
				this.Clock.updateState(e.data)
				this.setOrClear(e.data.playState);

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

					//new meta -- -- -- -- -- -- -- -- //
					//find this meta and replace it (if it exists) in 3 locations. Timeline, transport, files
					this.Transport.syncMetaObjects(meta, prevMeta)
					fileObj.metas[clipId] = meta
					console.log(this.Transport.timeline)
					
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

				const density = 200; //has to be density % numChannels = 0 --> this means next chunk always starts on a L sample if we index starting at 0 (and we are interleaved)
				const height = 4000; //this is in pixels and is arbitrary since varying track heights will stretch and squash whatever the instrinsic height actually is. There is prob a sane default here
            	const channels = 2;

				let points = [];
				let y = 0;

				for (let i=0; i < audio.length; i += density){ 
					let scaled = Math.round(scaler(audio[i], typeRanges[dType][0], typeRanges[dType][1], 0, height))
					points.push(String(y) + ',' + String(scaled))
					y++        
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
					
					return fileId

				}
			}

		}

		this.Transport = {
			
			timeline: {},
			stack: [],

			syncMetaObjects(meta, prevMeta) {

				//if the meta is on the transport stack, update it
				for (const [i, m] of this.stack.entries()){
					if (m[3] === meta[3]){
						console.log('Updating Existing Transport Stack Entry')
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
				
			}

		}


		this.Clock = {

			startPos: null,
			isPlaying: false,
			
			position: {
				hours: 0,
				minutes: 0,
				seconds: 0, 
				samples: 0,
			},

			updateState(updateObj){
				this.snap(updateObj.startPos)
				updateObj.playState === 'play' ? this.isPlaying = true : this.isPlaying = false
				
			},
			
			//[hours, mins, seconds, samples]
			snap(startPos){
				if (startPos){
					this.position.hours = startPos[0]
					this.position.minutes = startPos[1]
					this.position.seconds = startPos[2]
					this.position.samples = startPos[3]
				}
			},

			tick(frameSize) {
				
				this.position.samples += frameSize
				if (this.position.samples % 48000 === 0){ //sample rate
					this.position.seconds++    
					console.log('Seconds: ', this.position.seconds) // 
					      
					
					if (this.position.seconds % 60 === 0) {
						this.position.seconds = 0
						this.position.minutes++
						console.log('Minutes: ', this.position.minutes) 
						
						if (this.position.minutes % 60 === 0){
							this.position.hours++
							console.log('Hours: ', this.position.hours) 
							if (this.position.hours > 24){
								this.position.hours = 0
								this.position.minutes = 0
								this.position.seconds = 0
								this.position.samples = 0
							}
						}
					}
				}
			}
		}  
	}

	setOrClear(playState){
		
		if (playState === 'stop'){
			this.Transport.stack = [];
			console.log('Cleared Transport Stack')
		}
	}


	//each tick advances 128 samples when playback is started
	process (inputs, outputs, parameters) {
		
		let outputDevice = outputs[0]
		let frames = outputDevice[0].length

		if (this.Clock.isPlaying){			
			
			let P = this.Clock.position.samples
			let metas = this.Transport.timeline[P]
			if (metas){
				metas.forEach(meta => this.Transport.stack.push(meta))
			}

			if (this.Transport.stack.length > 0){

				for (let frame = 0; frame < frames; frame++){	

					P = this.Clock.position.samples + frame

					for (const [index, meta] of this.Transport.stack.entries()){
					
						let fileObj = this.Files.files[meta[4]]
						let idx = P - meta[0]

						if (idx >= 0) {
						
							let channels = fileObj.waveform.channels
							idx += meta[1]

							if (idx > ((fileObj.audio.length / channels)- meta[2])){
								console.log('Item removed from transport stack');
								this.Transport.stack.splice(index, 1);
								continue;
							}
							
							for (let ch = 0; ch < channels; ch++){
								idx += ch          
								let sample = fileObj.audio[idx * channels] / 32768 //scale the value of idx to +/- playback speed
								
								let prevValue = outputDevice[ch][frame]
								sample += prevValue
								sample > 1.0 ? sample = 1.0 : sample = sample
								sample < -1.0 ? sample = -1.0 : sample = sample

								outputDevice[ch][frame] = sample
							}
						}

					}

				}
	
			
			}
			
			
			
			this.Clock.tick(frames)
			this.port.postMessage({tick: this.Clock.position})
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






  