<script>


// this.Clock = {
			
		// 	frameNumber: 0,

		// 	// position: {
		// 	// 	hours: 0,
		// 	// 	minutes: 0,
		// 	// 	seconds: 0, 
		// 	// 	samples: 0,
		// 	// },


		// 	//[hours, mins, seconds, samples]
		// 	snap(startPos){
				
				
		// 		// if (startPos){
		// 		// 	this.position.hours = startPos[0]
		// 		// 	this.position.minutes = startPos[1]
		// 		// 	this.position.seconds = startPos[2]
		// 		// 	this.position.samples = startPos[3]
		// 		// }
		// 	},

		// 	tick(frames) {

		// 		this.frameNumber += frames

		// 		//this version of the clock should maybe be done on the front end//
		// 		// this.position.samples += frameSize
		// 		// if (this.position.samples % 48000 === 0){ //sample rate
		// 		// 	this.position.seconds++    
		// 		// 	console.log('Seconds: ', this.position.seconds) // 
					      
					
		// 		// 	if (this.position.seconds % 60 === 0) {
		// 		// 		this.position.seconds = 0
		// 		// 		this.position.minutes++
		// 		// 		console.log('Minutes: ', this.position.minutes) 
						
		// 		// 		if (this.position.minutes % 60 === 0){
		// 		// 			this.position.hours++
		// 		// 			console.log('Hours: ', this.position.hours) 
		// 		// 			if (this.position.hours > 24){
		// 		// 				this.position.hours = 0
		// 		// 				this.position.minutes = 0
		// 		// 				this.position.seconds = 0
		// 		// 				this.position.samples = 0
		// 		// 			}
		// 		// 		}
		// 		// 	}
		// 		// }
		// 	}
		// }  


    
				



				// let time = [0,0,0,0]
				// let seconds = e.data.snap / 48000
				// let remainder = e.data.snap % 48000

				// time[2] = Math.floor(seconds)
				// time[3] = Math.floor(remainder)
				// if (seconds >= 60){
				// 	let minutes = seconds / 60
				// 	let remainder = seconds % 60
				// 	time[1] = Math.floor(minutes)
				// 	time[2] = Math.floor(remainder)
				// }

				//this.Clock.snap(time)
				//this.Clock.totalSamples = e.data.snap
				//this.port.postMessage({snap: e.data.snap})




</script>