function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function get_store_value(store) {
    let value;
    subscribe(store, _ => value = _)();
    return value;
}
function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        while (flushidx < dirty_components.length) {
            const component = dirty_components[flushidx];
            flushidx++;
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

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

//(span of new range * real current delta / span of old range) + newRange
const scaler = (value, oldMin, oldMax, newMin, newMax) => {
    return (newMax - newMin) * (value - oldMin) / (oldMax - oldMin) + newMin
};


function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => 
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

//export const samplesPerPixel = writable(8000) //this is changed by the zoom setting
//export const zoomStep = readable(384) //change this to an easing function


const MIN_FPP = 25; 
const MAX_FPP = 10000;
const CHANNELS = 2;

function _applyEasing (x) {
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

const framesPerPixel = _applyEasing();

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
        await this.audioContext.audioWorklet.addModule('./awp.js');
        this.awp = new AudioWorkletNode(this.audioContext, 'awp', {numberOfInputs: [1], numberOfOutputs: [1], outputChannelCount: [2]});
        this.awp.connect(this.audioContext.destination);
        console.log('Created Audio Context: ', this.audioContext);
        this.initOnMessage();
        return Promise.resolve();
    }


};


function convolve(inline){
    let x = [0, 1.3, 3.3, 4.5, 6.6, 23];
    let h = [1, 1, 0.6, 2];

    if (inline){
        let y = Array(x.length + h.length - 1).fill(0);
        for (let i=0; i < x.length; i++){
            for (let j=0; j < h.length; j++){
                y[i + j] += x[i] * h[j];
            } 
        }

        return y
    }
    
    else {
        let outputs = [];
        for (let i=0; i < x.length; i++){
            let output = Array(x.length + h.length - 1).fill(0);
            for (let j=0; j < h.length; j++){
                output[i + j] += x[i] * h[j];
            }
            
            outputs.push(output);
        }

        return outputs
    }

}

/* src/Clip.svelte generated by Svelte v3.48.0 */

function create_fragment$6(ctx) {
	let div2;
	let div0;
	let t;
	let div1;
	let svg;
	let polyline;
	let svg_viewBox_value;

	return {
		c() {
			div2 = element("div");
			div0 = element("div");
			t = space();
			div1 = element("div");
			svg = svg_element("svg");
			polyline = svg_element("polyline");
			attr(div0, "class", "mask svelte-1pnigs2");
			attr(div0, "id", "-mask");
			attr(polyline, "stroke", "white");
			attr(polyline, "points", /*_points*/ ctx[2]);
			attr(polyline, "fill", "none");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "width", /*_maxSvgWidth*/ ctx[6]);
			attr(svg, "height", "100%");
			attr(svg, "preserveAspectRatio", "none");
			attr(svg, "stroke-width", "2");
			attr(svg, "viewBox", svg_viewBox_value = "" + (/*_vbShift*/ ctx[5] + " 0 " + /*_vbLength*/ ctx[3] + " " + /*_vbHeight*/ ctx[4]));
			attr(div1, "class", "line svelte-1pnigs2");
			attr(div2, "class", "clip svelte-1pnigs2");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div0);
			/*div0_binding*/ ctx[12](div0);
			append(div2, t);
			append(div2, div1);
			append(div1, svg);
			append(svg, polyline);
			/*div2_binding*/ ctx[13](div2);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*_points*/ 4) {
				attr(polyline, "points", /*_points*/ ctx[2]);
			}

			if (dirty[0] & /*_maxSvgWidth*/ 64) {
				attr(svg, "width", /*_maxSvgWidth*/ ctx[6]);
			}

			if (dirty[0] & /*_vbShift, _vbLength, _vbHeight*/ 56 && svg_viewBox_value !== (svg_viewBox_value = "" + (/*_vbShift*/ ctx[5] + " 0 " + /*_vbLength*/ ctx[3] + " " + /*_vbHeight*/ ctx[4]))) {
				attr(svg, "viewBox", svg_viewBox_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div2);
			/*div0_binding*/ ctx[12](null);
			/*div2_binding*/ ctx[13](null);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let { parent } = $$props;
	let { fileId } = $$props;
	let { trackId } = $$props;
	let { start } = $$props;
	let { clipTrims } = $$props;

	//exposed in markup
	let clipId;

	let lineData;
	let _clip;
	let _mask;
	let _points = '';
	let _vbLength = 0; //the polyline creates a new point at each pixel
	let _vbHeight = 0;
	let _vbShift = '0';
	let _maxSvgWidth = 0;

	/* Mouse states */
	let mouse = null;

	let mouseDown = false;

	/* Actions */
	let isTrimming = false;

	let isMoving = false;
	let isHighlighting = false;
	let firstHighlight = true;
	let hlStart = 0;
	let hlEnd = 0;
	let lastfpp = null;

	const unsub = framesPerPixel.subscribe(fpp => {
		const zoom = () => {
			updateClipWidth(clipTrims, lineData, fpp);
			$$invalidate(6, _maxSvgWidth = Number(window.getComputedStyle(_clip).getPropertyValue('--width').split('px')[0]));
			lastfpp = fpp;
		};

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

	const highlightHandler = e => {
		if (firstHighlight) {
			_mask.style.setProperty('--opacity', 0.3);
			firstHighlight = false;
			hlStart = e.offsetX;
			hlEnd = hlStart;
			_mask.style.setProperty('--position', String(hlStart) + 'px');
			return;
		}

		hlEnd += e.movementX;
		let delta = Math.abs(hlEnd - hlStart);

		if (hlEnd < hlStart) {
			_mask.style.setProperty('--position', String(hlStart - delta) + 'px');
		}

		_mask.style.setProperty('--width', String(delta) + 'px');
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
		$$invalidate(2, _points = lineData.points.slice(lineTrims[0], lineData.points.length - lineTrims[1]).join(' '));
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
 * samples to pixels - 
 * @param samples - array to sum
 * @param fpp - current frames per pixel value
 */
	const samplesToPixels = (samples, fpp) => {
		const totalFrames = samples.reduce((prev, current) => prev + current);
		return Math.round(totalFrames / fpp);
	};

	const pixelsToSamples = (pixels, fpp) => {
		return Math.round(pixels * fpp);
	};

	const setCoreTrims = (clipTrims, fileId, clipId, position, trackId) => {
		//clipTrims[0] -= 12000 //everything is a little off lol 
		clipTrims = clipTrims.map(ct => ct * 1);

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
		if (side === 'left') {
			clipTrims[0] += pixelsToSamples(pixelChange, get_store_value(framesPerPixel));
			$$invalidate(7, start += pixelChange);
			lineTrims[0] += pixelsToLinePoints(pixelChange, get_store_value(framesPerPixel), lineData);
			$$invalidate(5, _vbShift = String(Number(lineTrims[0]))); //Need to move the viewbox a commesurate amount
		} else //for actual trimming pixel change will be negative
		if (side === 'right') {
			pixelChange *= -1;
			clipTrims[1] += pixelsToSamples(pixelChange, get_store_value(framesPerPixel));
			lineTrims[1] += pixelsToLinePoints(pixelChange, get_store_value(framesPerPixel), lineData);
		}

		updateClipWidth(clipTrims, lineData, get_store_value(framesPerPixel));
		updateWaveform(lineTrims, lineData);
		$$invalidate(7, start = updatePosition(0, start)); //pixelChange is 0 here since this is the first call
		setCoreTrims(clipTrims, fileId, clipId, start, trackId);
	};

	const clearCore = (fileId, clipId) => {
		AudioCore.awp.port.postMessage({ clear: { fileId, clipId } });
	};

	onMount(async () => {
		if (fileId !== null) {
			clipId = uuidv4();
			lineData = await AudioCore.getWaveform(fileId); //get waveform from back end
			$$invalidate(4, _vbHeight = String(lineData.height));
			$$invalidate(3, _vbLength = String(lineData.points.length));
			$$invalidate(6, _maxSvgWidth = samplesToPixels([lineData.sampleLength / lineData.channels], get_store_value(framesPerPixel)));
			let lineTrims = clipTrimsToLineTrims(clipTrims, lineData);
			updateTrims(0, 'left', clipTrims, lineTrims, lineData);
			updateTrims(0, 'right', clipTrims, lineTrims, lineData);

			//* MOUSE *//
			window.addEventListener('mousedown', e => {
				//reset any highlights
				_mask.style.setProperty('--opacity', 0);

				_mask.style.setProperty('--position', String(hlStart) + 'px');
				_mask.style.setProperty('--width', '0px');
				hlStart = 0;
				hlEnd = 0;
			});

			window.addEventListener('keydown', e => {
				if (e.key === 'Backspace' && Math.abs(hlStart - hlEnd) > 0) {
					const rOffset = Number(window.getComputedStyle(_clip).getPropertyValue('--width').split('px')[0]) - hlStart;

					const lClipTrims = [
						clipTrims[0],
						clipTrims[1] + pixelsToSamples(rOffset, get_store_value(framesPerPixel))
					];

					new Clip_1({
							target: parent,
							props: {
								start,
								clipTrims: lClipTrims,
								fileId,
								parent
							}
						});

					const lOffset = hlStart + (hlEnd - hlStart);

					const rClipTrims = [
						clipTrims[0] + pixelsToSamples(lOffset, get_store_value(framesPerPixel)),
						clipTrims[1]
					];

					new Clip_1({
							target: parent,
							props: {
								start: start + lOffset,
								clipTrims: rClipTrims,
								fileId,
								parent
							}
						});

					unsub(); //unsubs from the fpp store
					clearCore(fileId, clipId);
					parent.removeChild(_clip);
				}
			});

			//reset flags here since we may be outside of the clip
			window.addEventListener('mouseup', e => {
				mouseDown = false;
				isTrimming = false;
				isMoving = false;
				isHighlighting = false; //the highlight may still be visible, but it is no longer changing
				firstHighlight = true;
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
				if (isHighlighting) {
					highlightHandler(e);
				} else if (isMoving) {
					$$invalidate(7, start = updatePosition(e.movementX, start));
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

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_mask = $$value;
			$$invalidate(1, _mask);
		});
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_clip = $$value;
			$$invalidate(0, _clip);
		});
	}

	$$self.$$set = $$props => {
		if ('parent' in $$props) $$invalidate(8, parent = $$props.parent);
		if ('fileId' in $$props) $$invalidate(9, fileId = $$props.fileId);
		if ('trackId' in $$props) $$invalidate(10, trackId = $$props.trackId);
		if ('start' in $$props) $$invalidate(7, start = $$props.start);
		if ('clipTrims' in $$props) $$invalidate(11, clipTrims = $$props.clipTrims);
	};

	return [
		_clip,
		_mask,
		_points,
		_vbLength,
		_vbHeight,
		_vbShift,
		_maxSvgWidth,
		start,
		parent,
		fileId,
		trackId,
		clipTrims,
		div0_binding,
		div2_binding
	];
}

class Clip_1 extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance$5,
			create_fragment$6,
			safe_not_equal,
			{
				parent: 8,
				fileId: 9,
				trackId: 10,
				start: 7,
				clipTrims: 11
			},
			null,
			[-1, -1]
		);
	}
}

/* src/Track.svelte generated by Svelte v3.48.0 */

function create_fragment$5(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "trackRow track svelte-o8aap2");
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

function instance$4($$self, $$props, $$invalidate) {
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
		init(this, options, instance$4, create_fragment$5, safe_not_equal, { parent: 1, fileId: 2, trackId: 3 });
	}
}

/* src/Meter.svelte generated by Svelte v3.48.0 */

function create_fragment$4(ctx) {
	let div3;
	let div2;
	let div1;
	let div0;

	return {
		c() {
			div3 = element("div");
			div2 = element("div");
			div1 = element("div");
			div0 = element("div");
			attr(div0, "id", "meterMask");
			attr(div0, "class", "svelte-a5zkyk");
			attr(div1, "id", "meterColors");
			attr(div1, "class", "svelte-a5zkyk");
			attr(div2, "id", "meterMat");
			attr(div2, "class", "svelte-a5zkyk");
			attr(div3, "class", "trackRow meter svelte-a5zkyk");
		},
		m(target, anchor) {
			insert(target, div3, anchor);
			append(div3, div2);
			append(div2, div1);
			append(div1, div0);
			/*div0_binding*/ ctx[3](div0);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div3);
			/*div0_binding*/ ctx[3](null);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { fileId } = $$props;
	let { trackId } = $$props;
	let _mask;
	let prevMaskHeight = '100%';
	let newMaskHeight = null;

	const handleMeterMessage = e => {
		if (e.data.amplitude && e.data.amplitude.track === trackId) {
			newMaskHeight = String(100 - e.data.amplitude.amplitude * 100) + '%';

			//console.log(newMaskHeight)
			_mask.animate([{ height: prevMaskHeight }, { height: newMaskHeight }], 3);

			prevMaskHeight = newMaskHeight;
		}
	};

	onMount(() => {
		newMaskHeight = '50%';
		_mask.animate([{ height: prevMaskHeight }, { height: newMaskHeight }], 1);
		prevMaskHeight = newMaskHeight;
		AudioCore.registerCallback(handleMeterMessage);
	});

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_mask = $$value;
			$$invalidate(0, _mask);
		});
	}

	$$self.$$set = $$props => {
		if ('fileId' in $$props) $$invalidate(1, fileId = $$props.fileId);
		if ('trackId' in $$props) $$invalidate(2, trackId = $$props.trackId);
	};

	return [_mask, fileId, trackId, div0_binding];
}

class Meter extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$4, safe_not_equal, { fileId: 1, trackId: 2 });
	}
}

/* src/Playhead.svelte generated by Svelte v3.48.0 */

function create_fragment$3(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "id", "playhead");
			attr(div, "class", "svelte-4j4pzx");
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

function instance$2($$self, $$props, $$invalidate) {
	let { height } = $$props;
	let _this;
	let _isPlaying = false;
	let _lastSampleValue = 0;
	let _pixelPosition = 0;

	onMount(async () => {
		//the counter has to map the playhead to a specific pixel. This is based on samplesPerPixrel // 
		const updateStyle = () => _this.style.setProperty('--playhead-pos', _pixelPosition + 'px');

		//need a guard here - revisit selectors thing
		const handlePlayHeadMessage = e => {
			if (e.data.samplesTick) {
				if (e.data.samplesTick - _lastSampleValue >= get_store_value(framesPerPixel) && _isPlaying) {
					_pixelPosition = Math.round(e.data.samplesTick / get_store_value(framesPerPixel)); // + any scrolled amount
					updateStyle();
					_lastSampleValue = e.data.samplesTick;
				}
			} else if (e.data.snap) {
				_pixelPosition = Math.round(e.data.snap / get_store_value(framesPerPixel)); // + any scrolled amount
				updateStyle();
				console.log(e.data.snap);
				_lastSampleValue = e.data.snap;
			}
		};

		AudioCore.registerCallback(handlePlayHeadMessage);

		//* PLAYHEAD *//
		document.addEventListener('keydown', async e => {
			//In this case - no clips have been added
			if (!AudioCore.awp) await AudioCore.create();

			if (AudioCore.audioContext.state === 'suspended') await AudioCore.audioContext.resume();
			if (e.key != ' ') return;

			if (!_isPlaying) {
				_isPlaying = true;
				AudioCore.awp.port.postMessage({ playState: 'play', startPos: null });
			} else {
				_isPlaying = false;
				AudioCore.awp.port.postMessage({ playState: 'stop', startPos: null });
			} //_lastSampleValue = 0;
			//_pixelPosition = 0;
		}); //updateStyle();
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_this = $$value;
			$$invalidate(0, _this);
		});
	}

	$$self.$$set = $$props => {
		if ('height' in $$props) $$invalidate(1, height = $$props.height);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*_this, height*/ 3) {
			{
				if (_this) {
					_this.style.setProperty('--playhead-height', height + 'px');
				}
			}
		}
	};

	return [_this, height, div_binding];
}

class Playhead extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$3, safe_not_equal, { height: 1 });
	}
}

/* src/TrackArea.svelte generated by Svelte v3.48.0 */

function create_if_block(ctx) {
	let playhead;
	let current;

	playhead = new Playhead({
			props: { height: /*playheadHeight*/ ctx[1] }
		});

	return {
		c() {
			create_component(playhead.$$.fragment);
		},
		m(target, anchor) {
			mount_component(playhead, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const playhead_changes = {};
			if (dirty & /*playheadHeight*/ 2) playhead_changes.height = /*playheadHeight*/ ctx[1];
			playhead.$set(playhead_changes);
		},
		i(local) {
			if (current) return;
			transition_in(playhead.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(playhead.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(playhead, detaching);
		}
	};
}

function create_fragment$2(ctx) {
	let div;
	let current;
	let if_block = /*_this*/ ctx[0] && create_if_block(ctx);

	return {
		c() {
			div = element("div");
			if (if_block) if_block.c();
			attr(div, "id", "trackArea");
			attr(div, "class", "svelte-1pe5qzx");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if (if_block) if_block.m(div, null);
			/*div_binding*/ ctx[3](div);
			current = true;
		},
		p(ctx, [dirty]) {
			if (/*_this*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*_this*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(div, null);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (if_block) if_block.d();
			/*div_binding*/ ctx[3](null);
		}
	};
}

let SR = 48000;
let NUM_HOURS = 1;

function instance$1($$self, $$props, $$invalidate) {
	let { leftArea } = $$props;

	//* Playhead related *//
	let _this;
	let _zoomStep = 5; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
	let playheadHeight = 0;

	onMount(async () => {
		//** SET TO MAX WIDTH*/
		let totalSamples = SR * 60 * 60 * NUM_HOURS;

		AudioCore.totalSamples = totalSamples;
		framesPerPixel.ease(_zoomStep);
		let pixelWidth = String(Math.round(totalSamples / get_store_value(framesPerPixel)));
		_this.style.setProperty('--trackArea-width', pixelWidth + 'px');

		/** LISTEN TO THIS RESIZE */
		const resizeObserver = new ResizeObserver(entries => {
				for (let entry of entries) {
					$$invalidate(1, playheadHeight = entry.contentRect.height);
				}
			});

		resizeObserver.observe(_this);

		/** ZOOMING */
		_this.addEventListener('mouseenter', e => true);

		_this.addEventListener('mouseleave', e => false);

		document.addEventListener('keydown', e => {
			if (e.key === 'r' || e.key === 't') {
				if (e.key === 'r') _zoomStep >= 30 ? _zoomStep = _zoomStep : _zoomStep++; else _zoomStep <= 0 ? _zoomStep = _zoomStep : _zoomStep--;
				framesPerPixel.ease(_zoomStep);
				console.log('[ZOOMING]');
			}
		});

		//* DRAG AND DROP *//   
		_this.addEventListener('dragover', e => {
			e.preventDefault();
		});

		_this.addEventListener('drop', async e => {
			e.preventDefault();
			let handles = Array.from(e.dataTransfer.items).filter(handle => handle.type.includes('audio')).map(handle => handle.getAsFileSystemHandle());

			for await (const handle of handles) {
				const file = await handle.getFile();
				const audioBuffer = await file.arrayBuffer();

				if (audioBuffer.byteLength > 0) {
					if (!AudioCore.awp) await AudioCore.create(); else if (AudioCore.audioContext.state === 'suspended') {
						await AudioCore.audioContext.resume();
						console.log(AudioCore.audioContext.state);
					}

					console.log(handle);
					let id = await AudioCore.addFile(audioBuffer, file.name.split('.wav')[0]);
					console.log(id);

					if (id !== null) {
						//if (hovering over existing track){
						//add to that track
						//}
						//else:
						let trackId = uuidv4();

						new Track({
								target: _this,
								props: { fileId: id, trackId, parent: _this }
							});

						let leftArea = document.getElementsByClassName('leftArea')[0];

						new Meter({
								target: leftArea,
								props: { fileId: id, trackId }
							});
					}
				}
			}
		});
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_this = $$value;
			$$invalidate(0, _this);
		});
	}

	$$self.$$set = $$props => {
		if ('leftArea' in $$props) $$invalidate(2, leftArea = $$props.leftArea);
	};

	return [_this, playheadHeight, leftArea, div_binding];
}

class TrackArea extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$2, safe_not_equal, { leftArea: 2 });
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
			console.log(newPos, e.offsetX);

			if (AudioCore.awp) {
				AudioCore.awp.port.postMessage({ snap: newPos });
			}
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

    console.log(convolve(false));
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


// -- OLD -- OLD -- //


// window.onclick = async e => {
    
//     //ha ha 
//     if (tracks.length > 0)
//         return
    
//     const track = document.createElement('div')
//     track.id = 'track_' + String(tracks.length)
//     track.className = 'track'
//     const audioBuffer = await readFile()
//     let audioMeta = wavParser(audioBuffer.slice(0, 44))

//     //track can be already existing
//     const clip = new Clip({target: track, 
//         props: {
//             audioBuffer: audioBuffer,
//             audioMeta: audioMeta,
//             zoomLevel: 0
//         }
//     })

//     const trackArea = document.getElementById('trackArea')
//     trackArea.appendChild(track)
//     tracks.push(track)
// }

     
// point.setAttribute('cy', String(lastY))
// point.setAttribute('cx', String(scaled))
// point.setAttribute('r', '5')
// point.setAttribute('stroke', 'black')
// point.setAttribute('fill', 'black')
// point.setAttribute('stroke-width', '2')


// window.onload = async e => {

//     let fileLoader = document.getElementById('fileLoader')
//     fileLoader.onclick = async e => {
//         let buffer = await readFile()
//         let audio = new Float32Array(buffer)
//         let waveformPoints = audio.subarray(0, 48000)
//         console.log(waveformPoints.length)


//         //Start Audio
//         // let audioContext = new AudioContext({latencyHint: 0, sampleRate: 48000});
//         // await audioContext.audioWorklet.addModule('awp.js')
//         // let awp = new AudioWorkletNode(audioContext, 'awp', {numberOfInputs: [1], numberOfOutputs: [1], outputChannelCount: [2]});
//         // awp.connect(audioContext.destination)
//     }
// }






/**
 * 
 * @param {*} uiState --> per track clip postion, offset, backing file 
 * 
 * {trackId: [  {in: x, out: x, inTrim: x, outTrim: x, fileId: x},
 *              {in: x, out: x, inTrim: x, outTrim: x, fileId: x},
 * }
 * 
 */

 //construct Files Object
/**
 * OLD
 * { fileIdA:
 *          [   
 *              ArrayBuffer -->, becomes detached when passing to awp
 *              {trackId1: [ SAB, {in: x, out: x, inTrim: x, outTrim: x}, {in: x, out: x, inTrim: x, outTrim: x}, ],
 *              {trackId2: [ SAB, {in: x, out: x, inTrim: x, outTrim: x}, {in: x, out: x, inTrim: x, outTrim: x}, ]
 *          ]
 *           
 */



/**
 * MemoryObject
 * {fileUUIDv5: [ArrayBuffer, anythingElse?], }
 * 
 * 
 * Updated on UI change, on init
 * ClipsObject -- these should be sorted into timeline order? 
 * [{in: sampleNumber, out: sampleNumber, trims: [in, out], fileId: uuidv5},        ]
 * 
 *              x x x x x
 * 
 *                  5% or 60%
 *              
 * 
 *             --> pixel width (number of them), is proportional to actual length in samples relative to number of samples in the viewport
 * 
 *             480000 samples --> 1/60th of a 1 minute span
 *  
 *             To set a baseline for the viewport span. Just pick a max length (1 hour for example). Set grid lines accordingly, then all zoom steps are proportional to that
 */
//# sourceMappingURL=app.js.map
