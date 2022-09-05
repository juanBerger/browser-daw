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
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
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
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
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

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => 
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

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
            //console.log('[CURRENT FPP]...', scaled)
            set(scaled);
            
        },
        subscribe
    }
}

const framesPerPixel = applyEasing();

const currentFrame = writable(0);

currentFrame.subscribe(frame => {
});

AudioCore.registerCallback(e => {
    if (e.data.tick) currentFrame.set(e.data.tick);
});

const Drawing = {

    scene: null,
    camera: null,
    renderer: null,

    init(canvas, parent) {

        //total track area including meter area (excluding margins)
        const startWidth = Number(window.getComputedStyle(parent).width.split('px')[0]);
        const startHeight = Number(window.getComputedStyle(parent).height.split('px')[0]);

        const scene = new THREE.Scene(); //left, right, top , bottom
        const camera = new THREE.OrthographicCamera(0, startWidth, 0, startHeight, -1, 1);

        const renderer = new THREE.WebGLRenderer( { canvas: canvas, alpha: true, antialias: true } );
        renderer.setSize(startWidth, startHeight);

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        this.animate();
    },



    drawLine(translateX, translateY, width, height){

        const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
        const material = new THREE.MeshBasicMaterial( {color: 0x00ff00, side: THREE.DoubleSide} );
        const plane = new THREE.Mesh( geometry, material );
        this.scene.add( plane );    
        plane.geometry.translate(translateX + (width * 0.5), translateY + (height * 0.5), 0);

    },


    animate(){

        requestAnimationFrame(this.animate.bind(this));
        this.renderer.render(this.scene, this.camera);

    }


};

/* src/Clip.svelte generated by Svelte v3.48.0 */

function create_fragment$3(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "id", "clip");
			attr(div, "class", "svelte-3j2z2i");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			/*div_binding*/ ctx[3](div);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			/*div_binding*/ ctx[3](null);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { translateX } = $$props;
	let { parentTrack } = $$props;
	let clip;

	onMount(() => {
		clip.style.setProperty('--translateX', String(translateX) + 'px');
		const boundingRect = clip.getBoundingClientRect();
		Drawing.drawLine(boundingRect.x - 8.75, boundingRect.y - 8.75, clip.clientWidth, clip.clientHeight); //up to border (non inclusive)
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			clip = $$value;
			$$invalidate(0, clip);
		});
	}

	$$self.$$set = $$props => {
		if ('translateX' in $$props) $$invalidate(1, translateX = $$props.translateX);
		if ('parentTrack' in $$props) $$invalidate(2, parentTrack = $$props.parentTrack);
	};

	return [clip, translateX, parentTrack, div_binding];
}

class Clip extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { translateX: 1, parentTrack: 2 });
	}
}

/* src/Track.svelte generated by Svelte v3.48.0 */

function create_fragment$2(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "trackRow track svelte-hhaqav");
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
	let track;

	onMount(() => {
		track.addEventListener('mouseenter', e => true);
		track.addEventListener('mouseleave', e => false);

		new Clip({
				target: track,
				props: { translateX: 500, parentTrack: track }
			});
	});

	function div_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			track = $$value;
			$$invalidate(0, track);
		});
	}

	$$self.$$set = $$props => {
		if ('parent' in $$props) $$invalidate(1, parent = $$props.parent);
		if ('fileId' in $$props) $$invalidate(2, fileId = $$props.fileId);
		if ('trackId' in $$props) $$invalidate(3, trackId = $$props.trackId);
	};

	return [track, parent, fileId, trackId, div_binding];
}

class Track extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { parent: 1, fileId: 2, trackId: 3 });
	}
}

/* src/TrackArea.svelte generated by Svelte v3.48.0 */

function create_fragment$1(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "id", "trackArea");
			attr(div, "class", "svelte-1l0ythd");
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
let SR = 48000;
let MAX_HOURS = 1;

function instance$1($$self, $$props, $$invalidate) {
	let trackArea;

	onMount(() => {
		let totalSamples = SR * 60 * 60 * MAX_HOURS;
		AudioCore.totalSamples = totalSamples;
		Drawing.init(document.getElementById('sceneCanvas'), document.getElementById('app'));

		/** FOR TEST **/
		let trackId = uuidv4();

		new Track({
				target: trackArea,
				props: {
					fileId: '123',
					trackId,
					parent: trackArea
				}
			});
	}); // let trackId_1 = uuidv4();
	// const track_1 = new Track({
	//     target: trackArea,
	//     props: {

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
		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
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
    new Header({target: app});

    // const leftArea = new LeftArea({target: app})
    new TrackArea({ target: app});
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
//# sourceMappingURL=app.js.map
