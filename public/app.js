import { n as noop, s as safe_not_equal, S as SvelteComponent, i as init, e as element, a as svg_element, b as attr, c as insert, d as append, f as detach, o as onMount, g as get_store_value, h as binding_callbacks } from './index-0cb22112.js';

const subscriber_queue = [];
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = new Set();
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (const subscriber of subscribers) {
                    subscriber[1]();
                    subscriber_queue.push(subscriber, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.add(subscriber);
        if (subscribers.size === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            subscribers.delete(subscriber);
            if (subscribers.size === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}

//(span of new range * real current delta / span of old range) + newRangeMin
const scaler = (value, oldMin, oldMax, newMin, newMax) => {
    return (newMax - newMin) * (value - oldMin) / (oldMax - oldMin) + newMin
};

//http://www.topherlee.com/software/pcm-tut-wavformat.htmlx

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => 
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

var awpURL = "awp-c896646c.js";

const AudioCore = {

    audioContext: null,
    awp: null,
    totalSamples: 0,
    onMessageCallbacks: [],
    addFileResult: -1,
    getWaveFormResult: -1,

    registerCallback(callback){
        this.onMessageCallbacks.push(callback);
    },

    initOnMessage(){
        this.awp.port.onmessage = e => {
            
            //special cases
            if (e.data.id){
                this.addFileResult = e.data.id;
                return
            }

            else if (e.data.setWaveform){
                this.getWaveFormResult = e.data.setWaveform;
                return
            }
            
            this.onMessageCallbacks.forEach(cb => cb(e));
        };
    },

    addFile (arrayBuffer, filename) {
        
        return new Promise((resolve, reject) => {
            
            const interval = setInterval(() => {
                
                if(this.addFileResult !== -1){
                    clearInterval(interval);
                    let result = this.addFileResult;
                    this.addFileResult = - 1;
                    this.addFileResult !== null ? resolve(result) : reject(result);
                }
            
            }, 3);
            
            this.awp.port.postMessage({file: arrayBuffer, filename: filename}, [arrayBuffer]);
        })
    },


    getWaveform (id){
        return new Promise((resolve, reject) => {
            
            const interval = setInterval(() => {
    
                if(this.getWaveFormResult !== -1){
                    clearInterval(interval);
                    let result = this.getWaveFormResult;
                    this.getWaveFormResult = -1;
                    this.getWaveFormResult !== null ? resolve(result) : reject(result);
                }
            
            }, 3);
            
        
            this.awp.port.postMessage({getWaveform: id});
            
        })

    },

    addClips (){

    },

    async create() {

        this.audioContext = new AudioContext({latencyHint: 0, sampleRate: 48000});
        console.log(this.audioContext.audioWorklet);
        await this.audioContext.audioWorklet.addModule(awpURL);
        this.awp = new AudioWorkletNode(this.audioContext, 'awp', {numberOfInputs: [1], numberOfOutputs: [1], outputChannelCount: [2]});
        this.awp.connect(this.audioContext.destination);
        console.log('Created Audio Context: ', this.audioContext);
        this.initOnMessage();
        return Promise.resolve();
    }


};

const MIN_FPP = 25; 
const MAX_FPP = 10000;
const CHANNELS = 2;

function applyEasing (x) {
    const { set, update, subscribe } = writable(x);
    return {
        set,
        update, 
        ease: (x) => {
           
            //x *= 0.1
            //let eased = -(Math.cos(Math.PI * x) - 1) / 2
            //let eased = x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
            //this needs to get much slower as it gets closer to MIN_SPP
            let eased = x;
            let scaled = Math.round(scaler(eased, 0, 30, MIN_FPP, MAX_FPP));
            //scaled % CHANNELS === 0 ? scaled = scaled : scaled += scaled 
            scaled /= CHANNELS;
            console.log('[CURRENT FPP]...', scaled);
            set(scaled);
            
        },
        subscribe
    }
}

const framesPerPixel = applyEasing();

const currentFrame = writable(0);

currentFrame.subscribe(frame => {
    if (AudioCore.awp){
        AudioCore.awp.port.postMessage({snap: frame});
    }
});

AudioCore.registerCallback(e => {
    if (e.data.tick) currentFrame.set(e.data.tick);
});

/* src/Clip.svelte generated by Svelte v3.48.0 */

function create_fragment$4(ctx) {
	let div1;
	let div0;
	let svg;
	let polyline;
	let svg_viewBox_value;

	return {
		c() {
			div1 = element("div");
			div0 = element("div");
			svg = svg_element("svg");
			polyline = svg_element("polyline");
			attr(polyline, "stroke", "white");
			attr(polyline, "points", /*_points*/ ctx[1]);
			attr(polyline, "fill", "none");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "height", "100%");
			attr(svg, "width", "100%");
			attr(svg, "preserveAspectRatio", "none");
			attr(svg, "stroke-width", "2");
			attr(svg, "viewBox", svg_viewBox_value = "" + (/*_vbShift*/ ctx[4] + " 0 " + /*_vbLength*/ ctx[2] + " " + /*_vbHeight*/ ctx[3]));
			attr(div0, "class", "line svelte-6l3kxw");
			attr(div1, "class", "clip svelte-6l3kxw");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, div0);
			append(div0, svg);
			append(svg, polyline);
			/*div1_binding*/ ctx[10](div1);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*_points*/ 2) {
				attr(polyline, "points", /*_points*/ ctx[1]);
			}

			if (dirty[0] & /*_vbShift, _vbLength, _vbHeight*/ 28 && svg_viewBox_value !== (svg_viewBox_value = "" + (/*_vbShift*/ ctx[4] + " 0 " + /*_vbLength*/ ctx[2] + " " + /*_vbHeight*/ ctx[3]))) {
				attr(svg, "viewBox", svg_viewBox_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div1);
			/*div1_binding*/ ctx[10](null);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { parent } = $$props;
	let { fileId } = $$props;
	let { trackId } = $$props;
	let { start } = $$props;
	let { clipTrims } = $$props;

	//exposed in markup
	let clipId;

	let lineData;
	let _clip;
	let _points = '';
	let _vbLength = 0; //the polyline creates a new point at each pixel
	let _vbHeight = 0;
	let _vbShift = '0';

	/* Mouse states */
	let mouse = null;

	let mouseDown = false;

	/* Actions */
	let isTrimming = false;

	let isMoving = false;
	let isHighlighting = false;
	let hlStart = 0;
	let hlEnd = 0;
	let lastfpp = null;

	const unsub = framesPerPixel.subscribe(fpp => {
		const zoom = () => {
			updateClipWidth(clipTrims, lineData, fpp);
			let prevPosFrames = pixelsToFrames(start, lastfpp);
			let newPosPixels = framesToPixels([prevPosFrames], fpp);
			let delta = newPosPixels - start; //should be negative when we zoom out
			$$invalidate(5, start = updatePosition(delta, start));
			Number(window.getComputedStyle(_clip).getPropertyValue('--width').split('px')[0]);
			lastfpp = fpp;
		};

		//skip the zoom operation when the fpp is initially set on load
		!lastfpp ? lastfpp = fpp : zoom();
	});

	const setVerticalPointers = e => {
		let pointerType;

		if (mouse) {
			if (e.offsetY > _clip.offsetHeight / 2) {
				_clip.style.setProperty('--cursor', 'grab');
				pointerType = 'grab';
			} else {
				pointerType = 'text';
				_clip.style.setProperty('--cursor', 'text');
			}
		}

		return pointerType;
	};

	// const clipWidth = (lineData, clipTrims, spp) => {
	//     let sampleWidth = lineData.sampleLength - (clipTrims[0] + clipTrims[1]);
	//     let pixelWidth = (sampleWidth / spp) / lineData.channels
	//     return Math.round(pixelWidth)
	// }
	// const setClipSize = (lineData, spp) => {
	//     let audioFrames = (lineData.points.length * lineData.density) / lineData.channels
	//     return Math.round(audioFrames / spp)
	// }
	// const zoomClips = fpp => {
	//     let sampleLength = (lineTrims[1] - lineTrims[0]) * lineData.density
	//     return Math.round((sampleLength / spp) / lineData.channels)
	// }
	/**
 * 
 * @param pixels
 * @param fpp
 * @param lineData
 */
	const pixelsToLinePoints = (pixels, fpp, lineData) => {
		let frames = pixels * fpp;
		return Math.round(frames / (lineData.density / lineData.channels));
	};

	/**
 * 
 * @param pixelChange : Positive to the right, negative to the left.
 * @param start: &start position in pixels. Updates this global var in place
 */
	const updatePosition = (pixelChange, start) => {
		start += pixelChange;
		_clip.style.setProperty('--position', start + 'px');
		return start;
	};

	const updateWaveform = (lineTrims, lineData) => {
		const subArray = lineData.points.slice(lineTrims[0], lineData.points.length - lineTrims[1]);
		$$invalidate(2, _vbLength = String(subArray.length));
		$$invalidate(1, _points = subArray.join(' '));
	};

	const updateClipWidth = (clipTrims, lineData, fpp) => {
		let totalWidth = lineData.sampleLength / lineData.channels - (clipTrims[0] + clipTrims[1]);
		totalWidth /= fpp;
		_clip.style.setProperty('--width', String(Math.round(totalWidth)) + 'px');
	};

	const clipTrimsToLineTrims = (clipChange, lineData) => {
		return clipChange.map(c => c / (lineData.density / lineData.channels));
	};

	/**
 * frames to pixels - 
 * @param frames - array to sum. This is so that we can easily use with trims
 * @param fpp - current frames per pixel value
 */
	const framesToPixels = (frames, fpp) => {
		const totalFrames = frames.reduce((prev, current) => prev + current);
		return Math.round(totalFrames / fpp);
	};

	const pixelsToFrames = (pixels, fpp) => {
		return Math.round(pixels * fpp);
	};

	const setCoreTrims = (clipTrims, fileId, clipId, position, trackId) => {
		//clipTrims[0] -= 12000 //everything is a little off lol 
		//clipTrims = clipTrims.map(ct => ct * 1);
		AudioCore.awp.port.postMessage({
			trims: {
				fileId,
				clipId,
				trackId,
				meta: [position * get_store_value(framesPerPixel), clipTrims[0], clipTrims[1]]
			}
		});
	};

	const updateTrims = (pixelChange, side, clipTrims, lineTrims, lineData) => {
		// console.log(pixelChange)
		// if (pixelChange !== 0){
		//     pixelChange = 1;
		//     console.log(pixelChange)
		// }    
		if (side === 'left') {
			let lNewClipTrim = clipTrims[0] + pixelsToFrames(pixelChange, get_store_value(framesPerPixel));
			if (lNewClipTrim < 0) return;
			clipTrims[0] = lNewClipTrim;
			$$invalidate(5, start += pixelChange);
			let lNewLineTrim = lineTrims[0] + pixelsToLinePoints(pixelChange, get_store_value(framesPerPixel), lineData);
			if (lNewLineTrim < 0) return;
			lineTrims[0] = lNewLineTrim;
			$$invalidate(4, _vbShift = String(Number(lineTrims[0]))); //Need to move the viewbox a commesurate amount
		} else //for actual trimming pixel change will be negative
		if (side === 'right') {
			pixelChange *= -1;
			let rNewClipTrim = clipTrims[1] + pixelsToFrames(pixelChange, get_store_value(framesPerPixel));
			if (rNewClipTrim < 0) return;
			clipTrims[1] = rNewClipTrim;
			let rNewLineTrim = lineTrims[1] + pixelsToLinePoints(pixelChange, get_store_value(framesPerPixel), lineData);
			if (rNewLineTrim < 0) return;
			lineTrims[1] = rNewLineTrim;
		}

		updateClipWidth(clipTrims, lineData, get_store_value(framesPerPixel));
		updateWaveform(lineTrims, lineData);
		$$invalidate(5, start = updatePosition(0, start)); //pixelChange is 0 here since this is the first call
		setCoreTrims(clipTrims, fileId, clipId, start, trackId);
	};

	const clearCore = (fileId, clipId) => {
		AudioCore.awp.port.postMessage({ clear: { fileId, clipId } });
	};

	onMount(async () => {
		if (fileId !== null) {
			clipId = uuidv4();
			lineData = await AudioCore.getWaveform(fileId); //get waveform from back end
			console.log(lineData);
			$$invalidate(3, _vbHeight = String(lineData.height)); //an arbitrary nmber of pixels since height is scaled to conatiner box. Higher values create lighter looking lines
			$$invalidate(2, _vbLength = String(lineData.points.length)); //this is really already in pixel space because each point increments by one pixel (its 1px per 'density' number of samples)
			framesToPixels([lineData.sampleLength / lineData.channels], get_store_value(framesPerPixel));
			let lineTrims = clipTrimsToLineTrims(clipTrims, lineData);
			updateTrims(0, 'left', clipTrims, lineTrims, lineData);
			updateTrims(0, 'right', clipTrims, lineTrims, lineData);

			//* MOUSE *//
			window.addEventListener('mousedown', e => {
				
			}); //reset any highlights
			// _mask.style.setProperty('--opacity', 0);
			// _mask.style.setProperty('--position', String(hlStart) + 'px');
			// _mask.style.setProperty('--width', '0px');

			// hlStart = 0;
			// hlEnd = 0;
			window.addEventListener('keydown', e => {
				if (e.key === 'Backspace' && Math.abs(hlStart - hlEnd) > 0) {
					const rOffset = Number(window.getComputedStyle(_clip).getPropertyValue('--width').split('px')[0]) - hlStart;

					const lClipTrims = [
						clipTrims[0],
						clipTrims[1] + pixelsToFrames(rOffset, get_store_value(framesPerPixel))
					];

					const lOffset = hlStart + (hlEnd - hlStart);

					[
						clipTrims[0] + pixelsToFrames(lOffset, get_store_value(framesPerPixel)),
						clipTrims[1]
					];

					parent.removeChild(_clip);

					new Clip_1({
							target: parent,
							props: {
								start,
								clipTrims: lClipTrims,
								fileId,
								parent
							}
						});

					// new Clip({
					//     target: parent,
					//     props: {
					//         start: start + lOffset,
					//         clipTrims: rClipTrims,
					//         fileId: fileId,
					//         parent: parent
					//     }
					// })
					unsub(); //unsubs from the fpp store

					clearCore(fileId, clipId);
				}
			});

			//reset flags here since we may be outside of the clip
			window.addEventListener('mouseup', e => {
				mouseDown = false;
				isTrimming = false;
				isMoving = false;
				isHighlighting = false; //the highlight may still be visible, but it is no longer changing
			}); // hlStart = 0;
			// hlEnd = 0;

			_clip.addEventListener('mouseenter', e => {
				mouse = true;
			});

			_clip.addEventListener('mouseleave', e => {
				mouse = false;
			});

			_clip.addEventListener('mousedown', e => mouseDown = true);

			_clip.addEventListener('mouseup', e => {
				//isTrimming isMoving etc are reset on the window version of this event listener
				if (mouse) setVerticalPointers(e);
			});

			_clip.addEventListener('mousemove', e => {
				if (isHighlighting) ; else if (isMoving) {
					$$invalidate(5, start = updatePosition(e.movementX, start)); //highlightHandler(e);
					setCoreTrims(clipTrims, fileId, clipId, start, trackId);
				} else if (isTrimming) {
					_clip.style.setProperty('--cursor', 'ew-resize');
					e.offsetX < _clip.offsetWidth * 0.05 && updateTrims(e.movementX, 'left', clipTrims, lineTrims, lineData);
					e.offsetX > _clip.offsetWidth * 0.95 && updateTrims(e.movementX, 'right', clipTrims, lineTrims, lineData);
				} else if (e.offsetX < _clip.offsetWidth * 0.05 || e.offsetX > _clip.offsetWidth * 0.95) {
					if (e.srcElement.id != '-mask') {
						//make sure we are referencing the clip
						_clip.style.setProperty('--cursor', 'ew-resize');

						if (mouseDown) isTrimming = true;
					}
				} else {
					let type = setVerticalPointers(e);

					if (mouseDown) {
						if (type === 'grab') isMoving = true; else if (type === 'text') isHighlighting = true;
					}
				}
			});
		} else console.error('No Audio Associated With This Clip');
	});

	function div1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_clip = $$value;
			$$invalidate(0, _clip);
		});
	}

	$$self.$$set = $$props => {
		if ('parent' in $$props) $$invalidate(6, parent = $$props.parent);
		if ('fileId' in $$props) $$invalidate(7, fileId = $$props.fileId);
		if ('trackId' in $$props) $$invalidate(8, trackId = $$props.trackId);
		if ('start' in $$props) $$invalidate(5, start = $$props.start);
		if ('clipTrims' in $$props) $$invalidate(9, clipTrims = $$props.clipTrims);
	};

	return [
		_clip,
		_points,
		_vbLength,
		_vbHeight,
		_vbShift,
		start,
		parent,
		fileId,
		trackId,
		clipTrims,
		div1_binding
	];
}

class Clip_1 extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance$3,
			create_fragment$4,
			safe_not_equal,
			{
				parent: 6,
				fileId: 7,
				trackId: 8,
				start: 5,
				clipTrims: 9
			},
			null,
			[-1, -1]
		);
	}
}

/* src/Track.svelte generated by Svelte v3.48.0 */

function create_fragment$3(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "trackRow track svelte-11xj7z8");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			/*div_binding*/ ctx[4](div);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			/*div_binding*/ ctx[4](null);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let { parent } = $$props;
	let { fileId } = $$props;
	let { trackId } = $$props;
	let _this;

	onMount(() => {
		if (_this) {
			_this.addEventListener('mouseenter', e => true);
			_this.addEventListener('mouseleave', e => false);

			new Clip_1({
					target: _this,
					props: {
						start: 10,
						clipTrims: [0, 0], //this means full width; //144000
						fileId,
						trackId,
						parent: _this
					}
				});
		}
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_this = $$value;
			$$invalidate(0, _this);
		});
	}

	$$self.$$set = $$props => {
		if ('parent' in $$props) $$invalidate(1, parent = $$props.parent);
		if ('fileId' in $$props) $$invalidate(2, fileId = $$props.fileId);
		if ('trackId' in $$props) $$invalidate(3, trackId = $$props.trackId);
	};

	return [_this, parent, fileId, trackId, div_binding];
}

class Track extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$3, safe_not_equal, { parent: 1, fileId: 2, trackId: 3 });
	}
}

/* src/TrackArea.svelte generated by Svelte v3.48.0 */

function create_fragment$2(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "id", "trackArea");
			attr(div, "class", "svelte-id4cvd");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			/*div_binding*/ ctx[2](div);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			/*div_binding*/ ctx[2](null);
		}
	};
}
let _zoomStep = 5; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
let SR = 48000;
let NUM_HOURS = 1;

function instance$1($$self, $$props, $$invalidate) {
	let { leftArea } = $$props;

	//* Playhead related *//
	let _this;

	// window.onclick = async e => {
	//     await AudioCore.create();
	// }
	onMount(async () => {
		//S E T    M A X    W I D T H //
		let totalSamples = SR * 60 * 60 * NUM_HOURS;

		AudioCore.totalSamples = totalSamples;
		framesPerPixel.ease(_zoomStep);
		let pixelWidth = String(Math.round(totalSamples / get_store_value(framesPerPixel)));
		_this.style.setProperty('--trackArea-width', pixelWidth + 'px');
		framesPerPixel.ease(_zoomStep);
		await AudioCore.create();
		let file = "test_1.wav";
		const req = new XMLHttpRequest();
		req.open("GET", file, true);
		req.responseType = "arraybuffer";
		req.send();

		req.onload = async e => {
			const audioBuffer = req.response;
			const fileId = await AudioCore.addFile(audioBuffer, file.split('.wav')[0]);

			if (fileId !== null) {
				new Track({
						target: trackArea,
						props: {
							fileId,
							trackId: uuidv4(),
							parent: trackArea
						}
					});
			}
		};
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_this = $$value;
			$$invalidate(0, _this);
		});
	}

	$$self.$$set = $$props => {
		if ('leftArea' in $$props) $$invalidate(1, leftArea = $$props.leftArea);
	};

	return [_this, leftArea, div_binding];
}

class TrackArea extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$2, safe_not_equal, { leftArea: 1 });
	}
}

/* src/LeftArea.svelte generated by Svelte v3.48.0 */

function create_fragment$1(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "leftArea svelte-1241pls");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

class LeftArea extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment$1, safe_not_equal, {});
	}
}

/* src/Header.svelte generated by Svelte v3.48.0 */

function create_fragment(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "id", "header");
			attr(div, "class", "svelte-1o68e6l");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			/*div_binding*/ ctx[1](div);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			/*div_binding*/ ctx[1](null);
		}
	};
}

let TOTAL_PADDING = 9;

function instance($$self, $$props, $$invalidate) {
	let _this;

	onMount(e => {
		_this.addEventListener('click', e => {
			let newPos = (e.offsetX - TOTAL_PADDING) * get_store_value(framesPerPixel);
			currentFrame.set(newPos);
		});
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_this = $$value;
			$$invalidate(0, _this);
		});
	}

	return [_this, div_binding];
}

class Header extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

window.onload = e => {

    const app = document.getElementById('app');
    new LeftArea({target: app});
    new TrackArea({ target: app});
    new Header({target: app});
};



//This is for a file dialogue
// const readFile = async () => {
//     const [handle] = await window.showOpenFilePicker({
//         types: [{ description: 'Pro Tools Session Files', accept: {'application/octet-stream': ['.wav']}}],
//         startIn: 'desktop'}) 
//     const file = await handle.getFile()
//     const buffer = await file.arrayBuffer()
//     return buffer
// }





 // //** SET TO MAX WIDTH*/
    // let totalSamples = SR * 60 * 60 * NUM_HOURS
    // AudioCore.totalSamples = totalSamples
    // framesPerPixel.ease(_zoomStep)
    // let pixelWidth = String(Math.round(totalSamples / get(framesPerPixel)))
    // _this.style.setProperty('--trackArea-width', pixelWidth + 'px')
    

    // /** LISTEN TO THIS RESIZE */
    // const resizeObserver = new ResizeObserver(entries => {
    //     for (let entry of entries){ playheadHeight = entry.contentRect.height }
    // })
    // resizeObserver.observe(_this)
    

    // /** ZOOMING */
    // _this.addEventListener('mouseenter', e => _mouse = true)
    // _this.addEventListener('mouseleave', e => _mouse = false)
    // document.addEventListener('keydown', e => {
    //     if (e.key === 'r' || e.key === 't'){
    //         if (e.key === 'r') _zoomStep >= 30 ? _zoomStep = _zoomStep : _zoomStep++
    //         else _zoomStep <= 0 ? _zoomStep = _zoomStep : _zoomStep--
    //         framesPerPixel.ease(_zoomStep)
    //         //console.log('[ZOOMING]')
    //     }          
    // })




    // //* DRAG AND DROP *//   
    //_this.addEventListener('dragover', e => { e.preventDefault() })
    //_this.addEventListener('drop', async e => {

    //    e.preventDefault()

        // let handles = Array.from(e.dataTransfer.items)
        // .filter(handle => handle.type.includes('audio'))
        // .map(handle => handle.getAsFileSystemHandle())

        // for await (const handle of handles){
        //     const file = await handle.getFile()
        //     const audioBuffer = await file.arrayBuffer()
        //     if (audioBuffer.byteLength > 0){

        //         if (!AudioCore.awp) await AudioCore.create()
                
        //         else if (AudioCore.audioContext.state === 'suspended'){
        //             await AudioCore.audioContext.resume()
        //             console.log(AudioCore.audioContext.state)
        //         }
                
        //         console.log(handle)
        //         // let id = await AudioCore.addFile(audioBuffer, file.name.split('.wav')[0])
        //         // const lineData = await AudioCore.getWaveform(id); //get waveform from back end
        //         // console.log(lineData)


        //         if (id !== null) {
                    
                    



                    
                    
                    
                    
        //             //if (hovering over existing track){
        //                 //add to that track
        //             //}
        //             //else:
        //             // let trackId = uuidv4();
        //             // const track = new Track({
        //             //     target: _this,
        //             //     props: {
        //             //         fileId: id,
        //             //         trackId: trackId,
        //             //         parent: _this
        //             //     }
        //             // })

        //             // let leftArea = document.getElementsByClassName('leftArea')[0];
        //             // const meter = new Meter({
        //             //     target: leftArea,
        //             //     props: {
        //             //         fileId: id,
        //             //         trackId: trackId,
        //             //     }
        //             // })
                    
        //         }
                
        //     }
        //}
//# sourceMappingURL=app.js.map
