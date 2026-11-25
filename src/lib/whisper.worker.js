/* Whisper runs in a background worker so the page stays responsive and can be cancelled. */
let transformers = null;
const pipelines = {};
const files = {};

const post = (type, payload) => self.postMessage({ type, ...(payload || {}) });

self.onmessage = async (event) => {
  const message = event.data;
  if (message.type !== 'run') return;

  try {
    if (!transformers) {
      post('status', { s: 'engine' });
      transformers = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      transformers.env.allowLocalModels = false;
      try {
        transformers.env.backends.onnx.wasm.numThreads = 1;
      } catch {
        /* older builds do not expose wasm settings */
      }
    }

    if (!pipelines[message.model]) {
      post('status', { s: 'model' });
      Object.keys(files).forEach((key) => delete files[key]);

      const progress = {
        progress_callback: (progressEvent) => {
          if (progressEvent.status === 'progress' && progressEvent.total) {
            files[progressEvent.file] = { l: progressEvent.loaded, t: progressEvent.total };
            let loaded = 0;
            let total = 0;
            Object.keys(files).forEach((key) => {
              loaded += files[key].l;
              total += files[key].t;
            });
            post('dl', { pct: total ? (loaded / total) * 100 : 0 });
          }
        },
      };

      try {
        pipelines[message.model] = await transformers.pipeline(
          'automatic-speech-recognition',
          message.model,
          progress
        );
      } catch {
        transformers.env.useBrowserCache = false;
        pipelines[message.model] = await transformers.pipeline(
          'automatic-speech-recognition',
          message.model,
          progress
        );
      }
    }

    post('status', { s: 'run' });
    const options = message.opt;
    options.chunk_callback = () => post('chunk');

    let output;
    try {
      output = await pipelines[message.model](message.pcm, options);
    } catch (error) {
      if (options.num_beams) {
        delete options.num_beams;
        output = await pipelines[message.model](message.pcm, options);
      } else {
        throw error;
      }
    }

    post('done', { text: output.text || '', chunks: output.chunks || [] });
  } catch (error) {
    post('error', { msg: String((error && error.message) || error) });
  }
};
