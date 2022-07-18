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
            // console.log(scaled, x)
            set(scaled);
            
        },
        subscribe
    }
}

const samplesPerPixel = _applyEasing();

const files = writable({});

const AudioCore = {

    audioContext: null,
    awp: null, 

    //move this to AudioCore
    addFile (arrayBuffer) {
        return new Promise((resolve, reject) => {
            this.awp.port.onmessage = e => {
                if (e.data.id != null) resolve(e.data.id);
                else reject(null);
            };
            
            this.awp.port.postMessage({file: arrayBuffer}, [arrayBuffer]);
            
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
			attr(div0, "class", "mask svelte-r2znka");
			attr(polyline, "stroke", "white");
			attr(polyline, "points", /*_points*/ ctx[4]);
			attr(polyline, "fill", "none");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "width", "100%");
			attr(svg, "height", "100%");
			attr(svg, "stroke-width", "2");
			attr(svg, "preserveAspectRatio", "none");
			attr(svg, "viewBox", svg_viewBox_value = "" + (/*vbTrim*/ ctx[5] + " 0 " + /*_numPoints*/ ctx[3] + " " + _VBHEIGHT));
			attr(div1, "class", "line svelte-r2znka");
			attr(div2, "class", "clip svelte-r2znka");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div0);
			/*div0_binding*/ ctx[8](div0);
			append(div2, t);
			append(div2, div1);
			append(div1, svg);
			append(svg, polyline);
			/*svg_binding*/ ctx[9](svg);
			/*div2_binding*/ ctx[10](div2);
		},
		p(ctx, [dirty]) {
			if (dirty & /*_points*/ 16) {
				attr(polyline, "points", /*_points*/ ctx[4]);
			}

			if (dirty & /*vbTrim, _numPoints*/ 40 && svg_viewBox_value !== (svg_viewBox_value = "" + (/*vbTrim*/ ctx[5] + " 0 " + /*_numPoints*/ ctx[3] + " " + _VBHEIGHT))) {
				attr(svg, "viewBox", svg_viewBox_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div2);
			/*div0_binding*/ ctx[8](null);
			/*svg_binding*/ ctx[9](null);
			/*div2_binding*/ ctx[10](null);
		}
	};
}

const _VBHEIGHT = '5000'; //this should be the same as the height const in the _generateWaveForm function
const _DENSITY = 50;

function instance$3($$self, $$props, $$invalidate) {
	let { start } = $$props;
	let { fileId } = $$props;
	let _clip;
	let _mask;
	let _svg;
	let _waveform;
	let _waveformTrims = [null, null];
	let _numPoints = 0; //this is the number of pts in the polyline
	let _points = '';
	let vbTrim = 0;
	let mouse = null;
	let mouseDown = false;
	let isTrimming = false;
	let isMoving = false;
	let isHighlighting = false;
	let hlStart = 0;
	let hlEnd = 0;
	let firstHighlight = true;

	//subscribe to the store using the subscribe method
	// $: {    
	//     const spp = $samplesPerPixel
	//     if (_clip && spp > 0 && _waveform){
	//         _clip.style.width = calculateClipSize(_waveform.sampleLength) + 'px';
	//     }
	// }
	const calculateClipSize = sampleLength => {
		return String(Math.round(sampleLength / get_store_value(samplesPerPixel) * 0.5));
	};

	const trimHandler = (e, side) => {
		//set as full width
		if (side === null && e === null) {
			_waveformTrims = [0, _waveform.points.length - 1];
			$$invalidate(4, _points = _waveform.points.slice(_waveformTrims[0], _waveformTrims[1]).join(' '));
			return;
		}

		let trim;

		if (side === 'left') {
			trim = e.movementX * -1;
			let translate = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0]);
			translate += e.movementX;
			_clip.style.setProperty('--position', translate + 'px');

			//_waveformTrims[0] += Math.round(e.movementX * ((get(samplesPerPixel) * 0.5) / _DENSITY))
			$$invalidate(5, vbTrim += e.movementX * 10);
		} else {
			_waveformTrims[1] += Math.round(e.movementX * (get_store_value(samplesPerPixel) / _DENSITY * 0.5)); //_waveformTrims[0] += e.movementX
			trim = e.movementX;
		}

		console.log(e.movementX, _waveformTrims);

		//_points = _waveform.points.slice(_waveformTrims[0], _waveformTrims[1]).join(' ')
		let divWidth = Number(_clip.style.width.split('px')[0]) + trim;

		$$invalidate(0, _clip.style.width = String(divWidth) + 'px', _clip);
	}; //do sample offsets here
	//let realSampleOffset = (trim * _DENSITY * get(samplesPerPixel));
	//AudioCore.awp.port.postMessage({trims: {fileId: []}}) //need to account for sample skips Density * samplesPerPixel when passing pointers bac

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
		e.movementX * 10;
		let translate = Number(window.getComputedStyle(_clip).getPropertyValue('--position').split('px')[0]);
		translate += e.movementX;
		_clip.style.setProperty('--position', translate + 'px');
	};

	const highlightHandler = e => {
		if (firstHighlight) {
			_mask.style.setProperty('--opacity', 0.3);
			firstHighlight = false;
			hlStart = e.offsetX;
			hlEnd = hlStart;
			console.log('hl start: ', hlStart);
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

	onMount(async () => {
		//[points, numPoints, numSamples]
		if (fileId !== null) {
			//get waveform obj for this fileId
			_waveform = await AudioCore.getWaveform(fileId);

			//size clip to it based on num samples / 2 (bec they are interleaved) and current samplesPerPixel
			$$invalidate(0, _clip.style.width = calculateClipSize(_waveform.sampleLength) + 'px', _clip);

			_clip.style.setProperty('--position', start + 'px');

			//set length of svg viewBox
			$$invalidate(3, _numPoints = _waveform.points.length);

			trimHandler(null, null);
		}

		//* MOUSE *//
		window.addEventListener('mousedown', e => {
			//reset any highlights
			_mask.style.setProperty('--opacity', 0);

			_mask.style.setProperty('--position', String(hlStart) + 'px');
			_mask.style.setProperty('--width', '0px');
		});

		//reset flags here since we may be outside of the clip
		window.addEventListener('mouseup', e => {
			mouseDown = false;
			isTrimming = false;
			isMoving = false;
			isHighlighting = false; //the highlight may still be visible, but it is no longer changing
			firstHighlight = true;
			hlStart = 0;
			hlEnd = 0;
		});

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
				if (e.target.className.includes('clip')) {
					//make sure we are referencing the clip
					console.log('Setting Trim Cursor ', e);

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
	});

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_mask = $$value;
			$$invalidate(1, _mask);
		});
	}

	function svg_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_svg = $$value;
			$$invalidate(2, _svg);
		});
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			_clip = $$value;
			$$invalidate(0, _clip);
		});
	}

	$$self.$$set = $$props => {
		if ('start' in $$props) $$invalidate(6, start = $$props.start);
		if ('fileId' in $$props) $$invalidate(7, fileId = $$props.fileId);
	};

	return [
		_clip,
		_mask,
		_svg,
		_numPoints,
		_points,
		vbTrim,
		start,
		fileId,
		div0_binding,
		svg_binding,
		div2_binding
	];
}

class Clip extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { start: 6, fileId: 7 });
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

			new Clip({
					target: _this,
					props: { start: 300, fileId }
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
	let _pixelPosition = 0;

	onMount(async () => {
		//* PLAYHEAD *//
		document.addEventListener('keydown', async e => {
			//the counter has to map the playhead to a specific pixel. This is based oN samplesPerPixrel // 
			const updateStyle = () => _this.style.setProperty('--playhead-pos', _pixelPosition + 'px');

			// Just listen to onmessage here
			// if (!AudioCore.awp){
			//   await AudioCore.create()
			//   AudioCore.awp.port.onmessage = e => { 
			//     if (e.data.tick.samples - _lastSampleValue >= (get(samplesPerPixel)) && _isPlaying){
			//         _pixelPosition = Math.round(e.data.tick.samples / get(samplesPerPixel)) // + any scrolled amount
			//         updateStyle()
			//         _lastSampleValue = e.data.tick.samples
			//     }
			//   }
			// }
			// else if (AudioCore.audioContext.state === 'suspended'){
			//     await AudioCore.audioContext.resume()
			//     console.log(AudioCore.audioContext.state)
			// }
			if (e.key != ' ') return;

			//** TEMP */
			let startPos = [0, 0, 0, 0];

			if (!_isPlaying) {
				_isPlaying = true;
				AudioCore.awp.port.postMessage({ playState: 'play', startPos });
			} else {
				_isPlaying = false;
				AudioCore.awp.port.postMessage({ playState: 'stop', startPos });
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

	{
		console.log(get_store_value(files));
	}

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
	let current;
	let if_block = /*_this*/ ctx[0] && create_if_block(ctx);

	return {
		c() {
			div = element("div");
			if (if_block) if_block.c();
			attr(div, "id", "trackArea");
			attr(div, "class", "svelte-1jxtb3m");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if (if_block) if_block.m(div, null);
			/*div_binding*/ ctx[2](div);
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
			/*div_binding*/ ctx[2](null);
		}
	};
}

let SR = 48000;
let NUM_HOURS = 1;

function instance($$self, $$props, $$invalidate) {
	let _this;
	let _zoomStep = 5; // 0 to 30 --> as this gets higher polyline height should somehow get smaller
	let playheadHeight = 0;

	onMount(async () => {
		//** SET TO MAX WIDTH*/
		let totalSamples = SR * 60 * 60 * NUM_HOURS;

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
					let id = await AudioCore.addFile(audioBuffer);

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

	return [_this, playheadHeight, div_binding];
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
