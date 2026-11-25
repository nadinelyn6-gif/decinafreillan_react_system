/**
 * Owns the Whisper worker lifecycle. One runner per app instance.
 */
export function createAsrRunner() {
  let worker = null;
  let job = null;

  function getWorker() {
    if (worker) return worker;

    worker = new Worker(new URL('./whisper.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      if (job) job.on(event.data);
    };
    worker.onerror = (event) => {
      if (event.preventDefault) event.preventDefault();
      const current = job;
      job = null;
      try {
        worker.terminate();
      } catch {
        /* already gone */
      }
      worker = null;
      if (current) {
        current.reject(
          new Error(
            `The speech engine could not run (${event.message || 'unknown error'}). Try a smaller model or a shorter file.`
          )
        );
      }
    };
    return worker;
  }

  function run(model, pcm, options, onEvent) {
    return new Promise((resolve, reject) => {
      job = {
        on(message) {
          if (message.type === 'done') {
            job = null;
            resolve(message);
          } else if (message.type === 'error') {
            job = null;
            reject(new Error(message.msg));
          } else {
            onEvent(message);
          }
        },
        reject(error) {
          job = null;
          reject(error);
        },
      };

      getWorker().postMessage({ type: 'run', model, opt: options, pcm }, [pcm.buffer]);
    });
  }

  function cancel() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    if (job) job.reject(new Error('cancelled'));
  }

  return { run, cancel, dispose: cancel };
}
