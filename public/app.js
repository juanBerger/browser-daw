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
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
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


//** ISSUES */
const MIN_SPP = 25; 
const MAX_SPP = 10000;
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
            let scaled = Math.round(scaler(eased, 0, 30, MIN_SPP, MAX_SPP));
            scaled % 2 === 0 ? scaled = scaled : scaled += scaled; //2 here is number of channels
            console.log('[CURRENT SPP]...', scaled);
            set(scaled);
            
        },
        subscribe
    }
}

const samplesPerPixel = _applyEasing();

const AudioCore = {

    audioContext: null,
    awp: null,
    totalSamples: 0,

    //move this to AudioCore
    addFile (arrayBuffer, filename) {
        return new Promise((resolve, reject) => {
            this.awp.port.onmessage = e => {
                if (e.data.id != null) resolve(e.data.id);
                else reject(null);
            };
            
            this.awp.port.postMessage({file: arrayBuffer, filename: filename}, [arrayBuffer]);
        })
    },

    //re
    getWaveform (id){
        return new Promise((resolve, reject) => {
            this.awp.port.onmessage = e => {
                if (e.data.setWaveform != null) resolve(e.data.setWaveform);
                else reject(null);
            };
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
        return Promise.resolve()
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

function create_fragment$3(ctx) {
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
			attr(polyline, "points", /*points*/ ctx[6]);
			attr(polyline, "fill", "none");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "width", /*maxSvgWidth*/ ctx[3]);
			attr(svg, "height", "100%");
			attr(svg, "preserveAspectRatio", "none");
			attr(svg, "stroke-width", "2");
			attr(svg, "viewBox", svg_viewBox_value = "" + (/*vbShift*/ ctx[2] + " 0 " + /*vbLength*/ ctx[0] + " " + /*vbHeight*/ ctx[1]));
			attr(div1, "class", "line svelte-1pnigs2");
			attr(div2, "class", "clip svelte-1pnigs2");
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
			if (dirty[0] & /*points*/ 64) {
				attr(polyline, "points", /*points*/ ctx[6]);
			}

			if (dirty[0] & /*maxSvgWidth*/ 8) {
				attr(svg, "width", /*maxSvgWidth*/ ctx[3]);
			}

			if (dirty[0] & /*vbShift, vbLength, vbHeight*/ 7 && svg_viewBox_value !== (svg_viewBox_value = "" + (/*vbShift*/ ctx[2] + " 0 " + /*vbLength*/ ctx[0] + " " + /*vbHeight*/ ctx[1]))) {
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

function instance$3($$self, $$props, $$invalidate) {
	let { start } = $$props;
	let { fileId } = $$props;
	let { width } = $$props;
	let { parent } = $$props;
	let lineData = null;
	let vbLength = 0; //the polyline creates a new point at each pixel
	let vbHeight = 0;
	let vbShift = '0';
	let maxSvgWidth;
	let _clip;
	let _mask;
	let clipId;
	let lineTrims = [0, 0];
	let clipTrims = [0, 0];
	let points = '';

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

	// $: {
	//     const spp = $samplesPerPixel
	//     if (hasLoaded){
	//         let newWidth = zoomClips(spp);
	//         maxSvgWidth = newWidth;
	//         _clip.style.setProperty('--width', String(newWidth) + 'px')
	//     }
	// }
	const trimHandler = (e, side) => {
		//
		let lineTrim = Math.round(e.movementX * get_store_value(samplesPerPixel) / (lineData.density * 0.5));

		let clipTrim = e.movementX;

		if (side === 'left') {
			lineTrims[0] += lineTrim;
			clipTrims[0] += clipTrim * get_store_value(samplesPerPixel);
			$$invalidate(7, start += clipTrim);

			//Trimming from left requires clip to move
			let translate = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0]);

			translate += clipTrim;
			$$invalidate(2, vbShift = String(Number(vbShift) + lineTrim)); //Need to move the viewbox a commesurate amount
			_clip.style.setProperty('--position', translate + 'px');
			clipTrim *= -1;
			console.log(clipTrims[0]);
		} else {
			if (lineTrims[1] === 0) console.error('No waveform loaded');
			lineTrims[1] += lineTrim;
			clipTrims[1] += clipTrim * get_store_value(samplesPerPixel) * -1;
		}

		//Inform the back end
		setCoreTrims(clipTrims, start);

		//update line drawing
		$$invalidate(6, points = lineData.points.slice(lineTrims[0], lineTrims[1]).join(' '));

		//update clip size
		let clipWidth = Number(_clip.style.getPropertyValue('--width').split('px')[0]) + clipTrim;

		_clip.style.setProperty('--width', String(clipWidth) + 'px');
	};

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

	const moveHandler = e => {
		//let translate = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0])
		$$invalidate(7, start += e.movementX);

		//translate += e.movementX
		_clip.style.setProperty('--position', start + 'px');

		setCoreTrims(clipTrims, start);
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

	const setClipSize = (lineData, spp) => {
		let audioFrames = lineData.points.length * lineData.density / lineData.channels;
		return Math.round(audioFrames / spp);
	};

	//can we supply this in terms of pixel-sample space // li
	const setCoreTrims = (clipTrims, position) => {
		AudioCore.awp.port.postMessage({
			trims: {
				fileId,
				clipId,
				meta: [position * get_store_value(samplesPerPixel), clipTrims[0], clipTrims[1]]
			}
		});
	};

	onMount(async () => {
		if (fileId !== null) {
			_clip.style.setProperty('--position', start + 'px');
			lineData = await AudioCore.getWaveform(fileId); //get data from audio back end
			clipId = uuidv4();
			lineTrims = [0, lineData.points.length - 1]; //set trim amounts
			clipTrims = [0, 0]; //these are now only offsets
			setCoreTrims(clipTrims, start);

			//Clip Dims
			if (width === null) $$invalidate(8, width = String(setClipSize(lineData, get_store_value(samplesPerPixel)))); else $$invalidate(8, width = String(width));

			_clip.style.setProperty('--width', width + 'px');

			//SVG Dims
			$$invalidate(1, vbHeight = String(lineData.height));

			$$invalidate(0, vbLength = String(lineData.points.length));
			$$invalidate(3, maxSvgWidth = Number(_clip.style.getPropertyValue('--width').split('px')[0]));
			$$invalidate(6, points = lineData.points.slice(0, lineData.points.length).join(' '));

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
					let s = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0]);
					let w = hlStart - s;

					//if (hlEnd < hlStart) w = s + hlEnd; //hlEnd is negative here -- > this right?
					console.log(s, w);

					new Clip_1({
							target: parent,
							props: { start: s, width: w, fileId, parent }
						});

					let sRight = s + hlEnd;
					let wRight = Number(width.split('px')[0]) - hlEnd;

					new Clip_1({
							target: parent,
							props: {
								start: sRight,
								width: wRight,
								fileId,
								parent
							}
						});

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
					moveHandler(e);
				} else if (isTrimming) {
					_clip.style.setProperty('--cursor', 'ew-resize');
					e.offsetX < _clip.offsetWidth * 0.05 && trimHandler(e, 'left');
					e.offsetX > _clip.offsetWidth * 0.95 && trimHandler(e, 'right');
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
			$$invalidate(5, _mask);
		});
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_clip = $$value;
			$$invalidate(4, _clip);
		});
	}

	$$self.$$set = $$props => {
		if ('start' in $$props) $$invalidate(7, start = $$props.start);
		if ('fileId' in $$props) $$invalidate(9, fileId = $$props.fileId);
		if ('width' in $$props) $$invalidate(8, width = $$props.width);
		if ('parent' in $$props) $$invalidate(10, parent = $$props.parent);
	};

	return [
		vbLength,
		vbHeight,
		vbShift,
		maxSvgWidth,
		_clip,
		_mask,
		points,
		start,
		width,
		fileId,
		parent,
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
			instance$3,
			create_fragment$3,
			safe_not_equal,
			{
				start: 7,
				fileId: 9,
				width: 8,
				parent: 10
			},
			null,
			[-1, -1]
		);
	}
}

/* src/Track.svelte generated by Svelte v3.48.0 */

function create_fragment$2(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "track");
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
	let { fileId } = $$props;
	let _this;

	onMount(() => {
		if (_this) {
			_this.addEventListener('mouseenter', e => true);
			_this.addEventListener('mouseleave', e => false);

			new Clip_1({
					target: _this,
					props: {
						start: 50,
						width: null,
						fileId,
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
		if ('fileId' in $$props) $$invalidate(1, fileId = $$props.fileId);
	};

	return [_this, fileId, div_binding];
}

class Track extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { fileId: 1 });
	}
}

/* src/Playhead.svelte generated by Svelte v3.48.0 */

function create_fragment$1(ctx) {
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

function instance$1($$self, $$props, $$invalidate) {
	let { height } = $$props;
	let _this;
	let _isPlaying = false;
	let _lastSampleValue = 0;
	let _pixelPosition = 0;

	onMount(async () => {
		//* PLAYHEAD *//
		document.addEventListener('keydown', async e => {
			//the counter has to map the playhead to a specific pixel. This is based on samplesPerPixrel // 
			const updateStyle = () => _this.style.setProperty('--playhead-pos', _pixelPosition + 'px');

			const handlePlayHeadMessage = awp_e => {
				if (awp_e.data.tick.samples - _lastSampleValue >= get_store_value(samplesPerPixel) && _isPlaying) {
					_pixelPosition = Math.round(awp_e.data.tick.samples / get_store_value(samplesPerPixel)); // + any scrolled amount
					updateStyle();
					_lastSampleValue = awp_e.data.tick.samples;
				}
			};

			//In this case - no clips have been added
			if (!AudioCore.awp) await AudioCore.create();

			AudioCore.awp.port.onmessage = awp_e => handlePlayHeadMessage(awp_e);
			if (AudioCore.audioContext.state === 'suspended') await AudioCore.audioContext.resume();
			if (e.key != ' ') return;

			//** TEMP */
			let startPos = [0, 0, 0, 0];

			if (!_isPlaying) {
				_isPlaying = true;
				AudioCore.awp.port.postMessage({ playState: 'play', startPos });
			} else {
				_isPlaying = false;
				AudioCore.awp.port.postMessage({ playState: 'stop', startPos });
				_lastSampleValue = 0;
				_pixelPosition = 0;
				updateStyle();
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
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { height: 1 });
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

function create_fragment(ctx) {
	let div;
	let button;
	let t1;
	let current;
	let mounted;
	let dispose;
	let if_block = /*_this*/ ctx[0] && create_if_block(ctx);

	return {
		c() {
			div = element("div");
			button = element("button");
			button.textContent = "Load a file";
			t1 = space();
			if (if_block) if_block.c();
			attr(button, "id", "button");
			attr(button, "class", "svelte-vv6lfr");
			attr(div, "id", "trackArea");
			attr(div, "class", "svelte-vv6lfr");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, button);
			append(div, t1);
			if (if_block) if_block.m(div, null);
			/*div_binding*/ ctx[3](div);
			current = true;

			if (!mounted) {
				dispose = listen(button, "click", /*buttonClicked*/ ctx[2]);
				mounted = true;
			}
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
			mounted = false;
			dispose();
		}
	};
}

let SR = 48000;
let NUM_HOURS = 1;

function instance($$self, $$props, $$invalidate) {
	let _this;
	let _zoomStep = 5; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
	let playheadHeight = 0;

	//update this to work on fire fox
	async function buttonClicked(e) {
		const fileObj = await readFile();

		if (fileObj[0].byteLength > 0) {
			if (!AudioCore.awp) await AudioCore.create(); else if (AudioCore.audioContext.state === 'suspended') {
				await AudioCore.audioContext.resume();
				console.log(AudioCore.audioContext.state);
			}

			//this is like a function call which we will await -- success = unique id. AWP determined if dup or not
			let id = await AudioCore.addFile(fileObj[0], fileObj[1].name.split('.wav')[0]);

			if (id !== null) {
				//if (hovering over existing track){
				//add to that track
				//}
				//else:
				new Track({
						target: _this,
						props: {
							fileId: id, //could be multiple?
							
						}
					});
			}
		}
	}

	const readFile = async () => {
		const [handle] = await window.showOpenFilePicker({
			types: [
				{
					description: '16 bit .wav file',
					accept: { 'application/octet-stream': ['.wav'] }
				}
			],
			startIn: 'desktop'
		});

		const file = await handle.getFile();
		const buffer = await file.arrayBuffer();
		return [buffer, file];
	};

	onMount(async () => {
		//** SET TO MAX WIDTH*/
		let totalSamples = SR * 60 * 60 * NUM_HOURS;

		AudioCore.totalSamples = totalSamples;
		samplesPerPixel.ease(_zoomStep);
		let pixelWidth = String(Math.round(totalSamples / get_store_value(samplesPerPixel)));
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
				samplesPerPixel.ease(_zoomStep);
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

					//this is like a function call which we will await -- success = unique id. AWP determined if dup or not
					let id = await AudioCore.addFile(audioBuffer, file.name.split('.wav')[0]);

					if (id !== null) {
						//if (hovering over existing track){
						//add to that track
						//}
						//else:
						new Track({
								target: _this,
								props: {
									fileId: id, //could be multiple?
									
								}
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

	return [_this, playheadHeight, buttonClicked, div_binding];
}

class TrackArea extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

window.onload = e => {

    console.log(convolve(false));
    const app = document.getElementById('app');
    new TrackArea({target: app});
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
