# To Enable SABs need to set the following as response headers:
- Cross-Origin-Opener-Policy', 'same-origin'
- 'Cross-Origin-Embedder-Policy', 'require-corp'

# Don't have this working on a local server, so we can enable chrome with SABs on by running:
- /Applications/Google\ Chrome\ Beta.app/Contents/MacOS/Google\ Chrome\ Beta --enable-features=SharedArrayBuffer

# Check this for enabling these headers in netlify
https://gist.github.com/padenot/b4715c2b7cc03b51739725cf4d424794

# Here is a local node server that serves these headers (use this ringbuff lib)
https://github.com/padenot/ringbuf.js/blob/main/server.js


//"start": "wds --open /public/ --node-resolve",
//"start:watch": "wds --open /public/ --node-resolve --watch"