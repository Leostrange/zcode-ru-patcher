const { parentPort, workerData } = require('worker_threads');
const core = require('./patch-core');

core.patch(workerData.dir, {
  asarSource: workerData.asarSource || undefined,
  onProgress(step, total, msg, level) {
    parentPort.postMessage({ type: 'progress', step, total, msg, level });
  },
}).then((result) => {
  parentPort.postMessage({ type: 'done', result });
}).catch((error) => {
  parentPort.postMessage({
    type: 'done',
    result: { success: false, log: [{ type: 'error', msg: error.message }] },
  });
});
