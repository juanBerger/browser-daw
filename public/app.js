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
const TEST_STRING = "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";

function instance($$self, $$props, $$invalidate) {
	let _this;
	let _zoomStep = 5; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
	let playheadHeight = 0;

	async function initTesting(audioString) {
		btoa(audioString);
		let id = await AudioCore.addFile(audioBuffer, 'testWav');

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
		initTesting(TEST_STRING);

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
