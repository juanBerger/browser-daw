

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
				let id = this.Files.add(e.data.file)
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
				this.Files.files[e.data.trims.id].metas.push(e.data.trims.metas)
			}

		}
		
		this.Files = {

			files: {},

			_generateWaveForm(audio, dType){

				const scaler = (value, oldMin, oldMax, newMin, newMax) => {
					return (newMax - newMin) * (value - oldMin	) / (oldMax - oldMin) + newMin
				}
				
				const typeRanges = {
					'int16': [-32768, 32767]
				}

				const density = 200; //has to be density % numChannels = 0 --> this means next chunk always starts on a L sample if we index starting at 0
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
			add(audioBuffer){
				//use wav parser util to check data type
				const audio = new Int16Array(audioBuffer.slice(44, audioBuffer.byteLength)) //int16 only for now
				const waveform = this._generateWaveForm(audio, 'int16')

				//if (duplicate) return existing id 
				//else:
				let id = 0
				this.files[id] = {
					audio: audio,
					waveform: waveform,
					metas: [], //[start, leftTrim, rightTrim]
					playbackOffset: 0,
				}

				return id
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
			
			for (const fileID in this.Files.files){
				let fileObj = this.Files.files[fileID]
				fileObj.metas[3] = 0;
				// for (const meta of fileObj.metas){
				// 	meta[3] = 0
				// }
			}
		}
		
	}

	//each tick advances 128 samples when playback is started
	process (inputs, outputs, parameters) {
		
		let outputDevice = outputs[0]
		let frames = outputDevice[0].length

		//start, leftIdx, rightIdx, idxOffset
		if (this.Clock.isPlaying){			
			
			for (let frame = 0; frame < frames; frame++){
			
				//intra - block 
				let P = this.Clock.position.samples + frame //this needs to account for the fact that we s

				//check all the files
				for (const fileID in this.Files.files){
					
					const fileObj = this.Files.files[fileID]
					const channels = fileObj.waveform.channels
					
					//check all the metas for these files
					for (const meta of fileObj.metas){

						let idx = P - meta[0]
						
						if (idx >= 0 && idx < (fileObj.audio.length - meta[2])) {
							
							idx += meta[1]
							
							for (let ch = 0; ch < channels; ch++){
								
								idx += ch          
								let sample = fileObj.audio[idx * channels] / 32768 //scale the value of idx to +/- playback speed
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












// for (const fileID in this.Files.files){

// 	const fileObj = this.Files.files[fileID]
// 	const channels = fileObj.waveform.channels
	
// 	for (const meta of fileObj.metas){
		
// 		let P = this.Clock.position.samples
// 		let idx = P - meta[0] 
		
// 		if (idx >= 0 && idx < (fileObj.audio.length - meta[2])) {
			
// 			idx += meta[1]
			
// 			for (let frame = 0; frame < frames; frame++){
// 				idx += frame
				
// 				for (let ch = 0; ch < channels; ch++){
// 					idx += ch
// 					outputDevice[ch][frame] = fileObj.audio[idx] / 32768
// 				}
// 			}
			
// 		}			

// 	}
// }




//   if (this.Clock.position.samples > fileObj.metas[0]){
	
// 	for (let frame = 0; frame < frames; frame++){
// 		let sourceIdx = fileObj.metas[1] + fileObj.metas[3]
// 		for (let ch = 0; ch < channels; ch++){
// 			const sample = fileObj.audio[sourceIdx] / 32768
// 			outputDevice[ch][frame] = sample
// 			sourceIdx++
// 		}

// 		fileObj.metas[3] += channels
// 	}
	



// }


















































  