const FFMessageType = Object.freeze({
  LOAD: 'LOAD', EXEC: 'EXEC', FFPROBE: 'FFPROBE', WRITE_FILE: 'WRITE_FILE', READ_FILE: 'READ_FILE',
  DELETE_FILE: 'DELETE_FILE', RENAME: 'RENAME', CREATE_DIR: 'CREATE_DIR', LIST_DIR: 'LIST_DIR',
  DELETE_DIR: 'DELETE_DIR', ERROR: 'ERROR', PROGRESS: 'PROGRESS', LOG: 'LOG', MOUNT: 'MOUNT', UNMOUNT: 'UNMOUNT'
});

const ERROR_UNKNOWN_MESSAGE_TYPE = new Error('unknown message type');
const ERROR_NOT_LOADED = new Error('ffmpeg is not loaded, call await ffmpeg.load() first');
const ERROR_IMPORT_FAILURE = new Error('failed to import ffmpeg-core.js');

let ffmpeg;

async function load({ coreURL, wasmURL, workerURL }) {
  const first = !ffmpeg;
  if (!coreURL) throw ERROR_IMPORT_FAILURE;

  let createFFmpegCore;
  try {
    const imported = await import(coreURL);
    createFFmpegCore = imported.default;
  } catch (error) {
    throw new Error(`${ERROR_IMPORT_FAILURE.message}: ${error?.message || error}`);
  }
  if (!createFFmpegCore) throw ERROR_IMPORT_FAILURE;

  const resolvedWasmURL = wasmURL || coreURL.replace(/\.js$/i, '.wasm');
  const resolvedWorkerURL = workerURL || coreURL.replace(/\.js$/i, '.worker.js');

  ffmpeg = await createFFmpegCore({
    mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL: resolvedWasmURL, workerURL: resolvedWorkerURL }))}`
  });
  ffmpeg.setLogger(data => self.postMessage({ type: FFMessageType.LOG, data }));
  ffmpeg.setProgress(data => self.postMessage({ type: FFMessageType.PROGRESS, data }));
  return first;
}

function exec({ args, timeout = -1 }) {
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec(...args);
  const ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
}

function writeFile({ path, data }) { ffmpeg.FS.writeFile(path, data); return true; }
function readFile({ path, encoding }) { return ffmpeg.FS.readFile(path, { encoding }); }
function deleteFile({ path }) { ffmpeg.FS.unlink(path); return true; }
function rename({ oldPath, newPath }) { ffmpeg.FS.rename(oldPath, newPath); return true; }
function createDir({ path }) { ffmpeg.FS.mkdir(path); return true; }
function listDir({ path }) {
  return ffmpeg.FS.readdir(path).map(name => {
    const stat = ffmpeg.FS.stat(`${path}/${name}`);
    return { name, isDir: ffmpeg.FS.isDir(stat.mode) };
  });
}
function deleteDir({ path }) { ffmpeg.FS.rmdir(path); return true; }
function mount({ fsType, options, mountPoint }) {
  const fs = ffmpeg.FS.filesystems[fsType];
  if (!fs) return false;
  ffmpeg.FS.mount(fs, options, mountPoint);
  return true;
}
function unmount({ mountPoint }) { ffmpeg.FS.unmount(mountPoint); return true; }

self.onmessage = async ({ data: { id, type, data } }) => {
  try {
    if (type !== FFMessageType.LOAD && !ffmpeg) throw ERROR_NOT_LOADED;
    let result;
    switch (type) {
      case FFMessageType.LOAD: result = await load(data); break;
      case FFMessageType.EXEC: result = exec(data); break;
      case FFMessageType.WRITE_FILE: result = writeFile(data); break;
      case FFMessageType.READ_FILE: result = readFile(data); break;
      case FFMessageType.DELETE_FILE: result = deleteFile(data); break;
      case FFMessageType.RENAME: result = rename(data); break;
      case FFMessageType.CREATE_DIR: result = createDir(data); break;
      case FFMessageType.LIST_DIR: result = listDir(data); break;
      case FFMessageType.DELETE_DIR: result = deleteDir(data); break;
      case FFMessageType.MOUNT: result = mount(data); break;
      case FFMessageType.UNMOUNT: result = unmount(data); break;
      default: throw ERROR_UNKNOWN_MESSAGE_TYPE;
    }
    const transfer = result instanceof Uint8Array ? [result.buffer] : [];
    self.postMessage({ id, type, data: result }, transfer);
  } catch (error) {
    self.postMessage({ id, type: FFMessageType.ERROR, data: error?.stack || String(error) });
  }
};
