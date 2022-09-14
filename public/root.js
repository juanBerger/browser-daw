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
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
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

//(span of new range * real current delta / span of old range) + newRangeMin
const scaler = (value, oldMin, oldMax, newMin, newMax) => {
    return (newMax - newMin) * (value - oldMin) / (oldMax - oldMin) + newMin
};

//http://www.topherlee.com/software/pcm-tut-wavformat.htmlx

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => 
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

var awpURL = "awp-23b770a4.js";

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
const currentFrame = writable(0); //Not sure we need this

const userEvents = writable([]); //{type: x, <type specific props>}
const lineDataStore = writable({});



currentFrame.subscribe(frame => {
    if (AudioCore.awp){
        AudioCore.awp.port.postMessage({snap: frame});
    }
});

AudioCore.registerCallback(e => {
    if (e.data.tick) currentFrame.set(e.data.tick);
});

/* src/Clip.svelte generated by Svelte v3.48.0 */

function create_fragment$5(ctx) {
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
			attr(div0, "class", "mask svelte-g8iujq");
			attr(div0, "id", "-mask");
			attr(polyline, "stroke", "white");
			attr(polyline, "points", /*_points*/ ctx[2]);
			attr(polyline, "fill", "none");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "height", "100%");
			attr(svg, "width", "100%");
			attr(svg, "preserveAspectRatio", "none");
			attr(svg, "stroke-width", "2");
			attr(svg, "viewBox", svg_viewBox_value = "" + (/*vbShift*/ ctx[5] + " 0 " + /*vbLength*/ ctx[3] + " " + /*vbHeight*/ ctx[4]));
			attr(div1, "class", "line svelte-g8iujq");
			attr(div2, "class", "clip svelte-g8iujq");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div0);
			/*div0_binding*/ ctx[11](div0);
			append(div2, t);
			append(div2, div1);
			append(div1, svg);
			append(svg, polyline);
			/*div2_binding*/ ctx[12](div2);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*_points*/ 4) {
				attr(polyline, "points", /*_points*/ ctx[2]);
			}

			if (dirty[0] & /*vbShift, vbLength, vbHeight*/ 56 && svg_viewBox_value !== (svg_viewBox_value = "" + (/*vbShift*/ ctx[5] + " 0 " + /*vbLength*/ ctx[3] + " " + /*vbHeight*/ ctx[4]))) {
				attr(svg, "viewBox", svg_viewBox_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div2);
			/*div0_binding*/ ctx[11](null);
			/*div2_binding*/ ctx[12](null);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let { fileId } = $$props;
	let { start } = $$props;
	let { clipTrims } = $$props;
	let { trackId } = $$props;
	let { clipId } = $$props;
	let lineData;
	let clip;
	let mask;
	let _points = '';
	let vbLength = 0; //the polyline creates a new point at each pixel
	let vbHeight = 0;
	let vbShift = '0';

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
			let prevPosFrames = pixelsToFrames(start, lastfpp);
			let newPosPixels = framesToPixels([prevPosFrames], fpp);
			let delta = newPosPixels - start; //should be negative when we zoom out
			$$invalidate(6, start = updatePosition(delta, start));
			Number(window.getComputedStyle(clip).getPropertyValue('--width').split('px')[0]);
			lastfpp = fpp;
		};

		//skip the zoom operation when the fpp is initially set on load
		!lastfpp ? lastfpp = fpp : zoom();
	});

	const setVerticalPointers = e => {
		let pointerType;

		if (mouse) {
			if (e.offsetY > clip.offsetHeight / 2) {
				clip.style.setProperty('--cursor', 'grab');
				pointerType = 'grab';
			} else {
				pointerType = 'text';
				clip.style.setProperty('--cursor', 'text');
			}
		}

		return pointerType;
	};

	const highlightHandler = e => {
		if (firstHighlight) {
			mask.style.setProperty('--opacity', 0.3);
			firstHighlight = false;
			hlStart = e.offsetX;
			hlEnd = hlStart;
			mask.style.setProperty('--position', String(hlStart) + 'px');
			return;
		}

		hlEnd += e.movementX;
		let delta = Math.abs(hlEnd - hlStart);

		if (hlEnd < hlStart) {
			mask.style.setProperty('--position', String(hlStart - delta) + 'px');
		}

		mask.style.setProperty('--width', String(delta) + 'px');
	};

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
 * @param start: start position in pixels. Updates this global var in place
 */
	const updatePosition = (pixelChange, start) => {
		start += pixelChange;
		clip.style.setProperty('--position', start + 'px');
		return start;
	};

	const updateWaveform = (lineTrims, lineData) => {
		const subArray = lineData.points.slice(lineTrims[0], lineData.points.length - lineTrims[1]);
		$$invalidate(3, vbLength = String(subArray.length));
		$$invalidate(2, _points = subArray.join(' '));
	};

	const updateClipWidth = (clipTrims, lineData, fpp) => {
		let totalWidth = lineData.sampleLength / lineData.channels - (clipTrims[0] + clipTrims[1]);
		totalWidth /= fpp;
		clip.style.setProperty('--width', String(Math.round(totalWidth)) + 'px');
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
		if (side === 'left') {
			let lNewClipTrim = clipTrims[0] + pixelsToFrames(pixelChange, get_store_value(framesPerPixel));
			if (lNewClipTrim < 0) return;
			clipTrims[0] = lNewClipTrim;

			//start += pixelChange;
			let lNewLineTrim = lineTrims[0] + pixelsToLinePoints(pixelChange, get_store_value(framesPerPixel), lineData);

			if (lNewLineTrim < 0) return;
			lineTrims[0] = lNewLineTrim;

			//Trimming from left requires shifting clips to the right (since length itself can only be changed from the right)
			$$invalidate(6, start = updatePosition(pixelChange, start)); //this a

			$$invalidate(5, vbShift = String(Number(lineTrims[0])));
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
		setCoreTrims(clipTrims, fileId, clipId, start, trackId);
	};

	const clearCore = (fileId, clipId) => {
		AudioCore.awp.port.postMessage({ clear: { fileId, clipId } });
	};

	onMount(() => {
		if (fileId !== null) {
			$$invalidate(0, clip.id = clipId, clip); //tag the DOM element with our passed in ID
			lineData = get_store_value(lineDataStore)[fileId];
			$$invalidate(4, vbHeight = String(lineData.height)); //an arbitrary nmber of pixels since height is scaled to conatiner box. Higher values create lighter looking lines
			$$invalidate(3, vbLength = String(lineData.points.length)); //this is really already in pixel space because each point increments by one pixel (its 1px per 'density' number of samples)
			let lineTrims = clipTrimsToLineTrims(clipTrims, lineData);
			updateTrims(0, 'left', clipTrims, lineTrims, lineData);
			updateTrims(0, 'right', clipTrims, lineTrims, lineData);

			//* MOUSE *//
			window.addEventListener('mousedown', e => {
				//reset any highlights
				mask.style.setProperty('--opacity', 0);

				mask.style.setProperty('--position', String(hlStart) + 'px');
				mask.style.setProperty('--width', '0px');
				hlStart = 0;
				hlEnd = 0;
			});

			window.addEventListener('keydown', e => {
				if (e.key === 'Backspace' && Math.abs(hlStart - hlEnd) > 0) {
					const clipLength = Number(window.getComputedStyle(clip).getPropertyValue('--width').split('px')[0]);
					const fpp = get_store_value(framesPerPixel);
					const leftTrims = [clipTrims[0], clipTrims[1] + pixelsToFrames(clipLength - hlStart, fpp)];
					const leftStart = start;
					const rightTrims = [clipTrims[0] + pixelsToFrames(hlEnd, fpp), clipTrims[1]];
					const rightStart = start + hlEnd;
					clearCore(fileId, clipId);
					unsub();

					userEvents.update(ue => {
						ue.push({
							type: 'addClips',
							clips: [
								{
									trackId,
									fileId,
									start: leftStart,
									trims: leftTrims
								}
							]
						});

						ue.push({
							type: 'addClips',
							clips: [
								{
									trackId,
									fileId,
									start: rightStart,
									trims: rightTrims
								}
							]
						});

						ue.push({
							type: "rmClips",
							clips: [{ trackId, clipId }]
						});

						return ue;
					});
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

			clip.addEventListener('mouseenter', e => {
				mouse = true;
			});

			clip.addEventListener('mouseleave', e => {
				mouse = false;
			});

			clip.addEventListener('mousedown', e => mouseDown = true);

			clip.addEventListener('mouseup', e => {
				//isTrimming isMoving etc are reset on the window version of this event listener
				if (mouse) setVerticalPointers(e);
			});

			clip.addEventListener('mousemove', e => {
				if (isHighlighting) {
					highlightHandler(e);
				} else if (isMoving) {
					$$invalidate(6, start = updatePosition(e.movementX, start));
					setCoreTrims(clipTrims, fileId, clipId, start, trackId);
				} else if (isTrimming) {
					clip.style.setProperty('--cursor', 'ew-resize');
					e.offsetX < clip.offsetWidth * 0.05 && updateTrims(e.movementX, 'left', clipTrims, lineTrims, lineData);
					e.offsetX > clip.offsetWidth * 0.95 && updateTrims(e.movementX, 'right', clipTrims, lineTrims, lineData);
				} else if (e.offsetX < clip.offsetWidth * 0.05 || e.offsetX > clip.offsetWidth * 0.95) {
					if (e.srcElement.id != '-mask') {
						//make sure we are referencing the clip
						clip.style.setProperty('--cursor', 'ew-resize');

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
			mask = $$value;
			$$invalidate(1, mask);
		});
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			clip = $$value;
			$$invalidate(0, clip);
		});
	}

	$$self.$$set = $$props => {
		if ('fileId' in $$props) $$invalidate(7, fileId = $$props.fileId);
		if ('start' in $$props) $$invalidate(6, start = $$props.start);
		if ('clipTrims' in $$props) $$invalidate(8, clipTrims = $$props.clipTrims);
		if ('trackId' in $$props) $$invalidate(9, trackId = $$props.trackId);
		if ('clipId' in $$props) $$invalidate(10, clipId = $$props.clipId);
	};

	return [
		clip,
		mask,
		_points,
		vbLength,
		vbHeight,
		vbShift,
		start,
		fileId,
		clipTrims,
		trackId,
		clipId,
		div0_binding,
		div2_binding
	];
}

class Clip extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance$4,
			create_fragment$5,
			safe_not_equal,
			{
				fileId: 7,
				start: 6,
				clipTrims: 8,
				trackId: 9,
				clipId: 10
			},
			null,
			[-1, -1]
		);
	}
}

/* src/Track.svelte generated by Svelte v3.48.0 */

function create_fragment$4(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "trackRow track svelte-bzgvta");
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

function instance$3($$self, $$props, $$invalidate) {
	let { trackId } = $$props;
	let track;

	const ueUnsub = userEvents.subscribe(async ue => {
		for (const [i, event] of ue.entries()) {
			if (event.type === 'addClips' || event.type === 'rmClips') {
				const targetClips = event.clips.filter(clip => clip.trackId === trackId);
				doEvent(targetClips, event.type);
				popEntries(i);
			}
		}
	});

	function doEvent(targetClips, type) {
		for (const clip of targetClips) {
			switch (type) {
				case 'addClips':
					new Clip({
							target: track,
							props: {
								fileId: clip.fileId,
								start: clip.start,
								clipTrims: clip.trims,
								trackId,
								clipId: uuidv4()
							}
						});
					break;
				case 'rmClips':
					const rmClip = document.getElementById(clip.clipId);
					track.removeChild(rmClip);
					break;
			}
		}
	}

	function popEntries(i) {
		userEvents.update(ue => {
			for (const [j, clip] of ue[i].clips.entries()) {
				if (clip.trackId === trackId) ue[i].clips.splice(j, 1);
			}

			if (ue[i].clips.length === 0) ue.splice(i, 1);
			return ue;
		});
	}

	// function popUe (i){
	//     userEvents.update(e => {
	//         e.splice(i, 1);
	//         return e
	//     })
	// }
	onMount(() => {
		$$invalidate(0, track.id = trackId, track);
		console.log('Track On Load', trackId);
	});

	onDestroy(() => {
		ueUnsub();
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			track = $$value;
			$$invalidate(0, track);
		});
	}

	$$self.$$set = $$props => {
		if ('trackId' in $$props) $$invalidate(1, trackId = $$props.trackId);
	};

	return [track, trackId, div_binding];
}

class Track extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$4, safe_not_equal, { trackId: 1 });
	}
}

/* src/TrackArea.svelte generated by Svelte v3.48.0 */

function create_fragment$3(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "id", "trackArea");
			attr(div, "class", "svelte-id4cvd");
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

let zoomStep = 10; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
const SR = 48000;
const NUM_HOURS = 1;

function instance$2($$self, $$props, $$invalidate) {
	let trackArea;
	const tracks = []; //this component is in charge of assigning track ids. It reuses indeces from this array

	const ueUnsub = userEvents.subscribe(async ue => {
		for (const [i, event] of ue.entries()) {
			if (event.type === 'addTrack') {
				const track = new Track({
						target: trackArea,
						props: {
							trackId: tracks.length, //we are just using the indexes here as trackIds
							
						}
					});

				popUserEvent(i);

				if (event.clips) {
					userEvents.update(ue => {
						event.clips.map(clip => clip.trackId = tracks.length);
						ue.push({ type: 'addClips', clips: event.clips });
						return ue;
					});
				}

				console.log('Pushed Add Clip Event');
				tracks.push(track);
			}
		}
	});

	function popUserEvent(i) {
		userEvents.update(e => {
			e.splice(i, 1);
			return e;
		});
	}

	onMount(async () => {
		//  S E T    M A X    W I D T H   //
		let totalSamples = SR * 60 * 60 * NUM_HOURS;

		framesPerPixel.ease(zoomStep);
		let pixelWidth = String(Math.round(totalSamples / get_store_value(framesPerPixel)));
		trackArea.style.setProperty('--trackArea-width', pixelWidth + 'px');
	});

	onDestroy(() => {
		ueUnsub();
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			trackArea = $$value;
			$$invalidate(0, trackArea);
		});
	}

	return [trackArea, div_binding];
}

class TrackArea extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$3, safe_not_equal, {});
	}
}

/* src/LeftArea.svelte generated by Svelte v3.48.0 */

function create_fragment$2(ctx) {
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
		init(this, options, null, create_fragment$2, safe_not_equal, {});
	}
}

/* src/Header.svelte generated by Svelte v3.48.0 */

function create_fragment$1(ctx) {
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

function instance$1($$self, $$props, $$invalidate) {
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
		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
	}
}

const Loaders = {

    auto() {

        const files = [
            "test_1.wav",
            "TRL_TRL_0128_01401_Wonder__a__APM.wav"
        ];

        for (const file of files){

            const req = new XMLHttpRequest();
            req.open("GET", file, true);
            req.responseType = "arraybuffer";
            req.send();
            req.onload = async e => {
                const audioBuffer = req.response;
                this._parseResponse(audioBuffer, file);
            };

        }
    },

    async filePicker() {

        const [handle] = await window.showOpenFilePicker({
            types: [{ description: '16 bit .wav file', accept: {'application/octet-stream': ['.wav']}}],
            startIn: 'desktop'}); 
        const file = await handle.getFile();
        const audioBuffer = await file.arrayBuffer();
        this._parseResponse(audioBuffer, file);
        
    },

    //This defines how we react to each new audioBuffer
    async _parseResponse(audioBuffer, file){
        
        const fileId = await AudioCore.addFile(audioBuffer, file.split('.wav')[0]);
        const lineData = await AudioCore.getWaveform(fileId); 
        
        //we need to keep a copy of this on the ui thread so that creating new clips is not async
        lineDataStore.update(lds => {
            lds[fileId] = lineData;
            return lds
        });

        userEvents.update(ue => {
            ue.push({type: 'addTrack', clips: [{fileId: fileId, start: 0, trims: [0, 0]}, ]});
            return ue
        });    

    }

};

/* src/App.svelte generated by Svelte v3.48.0 */

function create_fragment(ctx) {
	let div2;
	let leftarea;
	let t0;
	let div0;
	let t1;
	let header;
	let t2;
	let div1;
	let t3;
	let trackarea;
	let current;
	leftarea = new LeftArea({});
	header = new Header({});
	trackarea = new TrackArea({});

	return {
		c() {
			div2 = element("div");
			create_component(leftarea.$$.fragment);
			t0 = space();
			div0 = element("div");
			t1 = space();
			create_component(header.$$.fragment);
			t2 = space();
			div1 = element("div");
			t3 = space();
			create_component(trackarea.$$.fragment);
			attr(div0, "id", "vDivider");
			attr(div0, "class", "svelte-v60cx0");
			attr(div1, "id", "hDivider");
			attr(div1, "class", "svelte-v60cx0");
			attr(div2, "id", "app");
			attr(div2, "class", "svelte-v60cx0");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			mount_component(leftarea, div2, null);
			append(div2, t0);
			append(div2, div0);
			append(div2, t1);
			mount_component(header, div2, null);
			append(div2, t2);
			append(div2, div1);
			append(div2, t3);
			mount_component(trackarea, div2, null);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(leftarea.$$.fragment, local);
			transition_in(header.$$.fragment, local);
			transition_in(trackarea.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(leftarea.$$.fragment, local);
			transition_out(header.$$.fragment, local);
			transition_out(trackarea.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div2);
			destroy_component(leftarea);
			destroy_component(header);
			destroy_component(trackarea);
		}
	};
}

function instance($$self) {

	/**
 * events --> add Track (can be with or without clips if withclips need to pass in handle?)
 */
	const ueUnsub = userEvents.subscribe(ue => {
		
	});

	onMount(async () => {
		await AudioCore.create();
		if ('auto') Loaders.auto();
	});

	onDestroy(() => {
		ueUnsub();
	});

	return [];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

window.onload = () => {  
    new App({target: document.getElementById('root')});
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
//# sourceMappingURL=root.js.map
