"use strict";
const dbReady = new Promise((resolve, reject) => {
  const request = indexedDB.open("raumscan_studio_v1", 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("projects", { keyPath: "id" });
    request.result.createObjectStore("videos");
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function dbOp(store, mode, apply) {
  const db = await dbReady;
  return new Promise((ok, no) => {
    const tx = db.transaction(store, mode);
    let req = apply(tx.objectStore(store));
    tx.oncomplete = () => ok(req.result);
    tx.onerror = () => no(tx.error);
    tx.onabort = () => no(tx.error || Error("Local storage was interrupted."));
  });
}
const getVideo = (id) => dbOp("videos", "readonly", (s) => s.get(id));
let memoryVideos = new Map(),
  srcCache = new Map();
async function videoSource(p) {
  if (p.example) return asset("sample.mp4");
  if (hosted && p.cloud) return srcCache.get(p.id) || "";
  if (srcCache.has(p.id)) return srcCache.get(p.id);
  const blob = memoryVideos.get(p.id) || (await getVideo(p.id));
  if (!blob) return "";
  const url = URL.createObjectURL(blob);
  srcCache.set(p.id, url);
  return url;
}
async function loadImg(src) {
  return new Promise((ok, no) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => no(Error("This image could not be opened."));
    i.src = src;
  });
}
function canvasOf(w, h) {
  let c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
function waitMedia(el, what, ms = 16000) {
  return new Promise((ok, no) => {
    const timer = setTimeout(
      () =>
        end(Error("Video decoding timed out. Try an H.264 MP4 walkthrough.")),
      ms,
    );
    function end(error) {
      clearTimeout(timer);
      el.removeEventListener(what, success);
      el.removeEventListener("error", failed);
      error ? no(error) : ok();
    }
    function success() {
      end();
    }
    function failed() {
      end(
        Error(
          "This video codec could not be decoded. Export the walkthrough as H.264 MP4 and try again.",
        ),
      );
    }
    el.addEventListener(what, success, { once: true });
    el.addEventListener("error", failed, { once: true });
  });
}
async function seek(v, t) {
  if (Math.abs(v.currentTime - t) < 0.0008 && v.readyState >= 2) return;
  const done = waitMedia(v, "seeked");
  v.currentTime = t;
  await done;
}
function frameStats(source) {
  const c = canvasOf(96, 64),
    ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const pix = ctx.getImageData(0, 0, 96, 64).data,
    g = new Float32Array(96 * 64),
    hist = new Array(48).fill(0);
  let lum = 0,
    edge = 0;
  for (let i = 0; i < g.length; i++) {
    const j = i * 4;
    g[i] = 0.2126 * pix[j] + 0.7152 * pix[j + 1] + 0.0722 * pix[j + 2];
    lum += g[i];
    for (let z = 0; z < 3; z++) hist[z * 16 + Math.min(15, pix[j + z] >> 4)]++;
  }
  for (let y = 1; y < 63; y++)
    for (let x = 1; x < 95; x++) {
      let i = y * 96 + x;
      edge += Math.abs(4 * g[i] - g[i - 1] - g[i + 1] - g[i - 96] - g[i + 96]);
    }
  lum /= g.length;
  edge /= 62 * 94;
  return {
    lum,
    edge,
    hist: hist.map((v) => v / g.length),
    score: Math.min(edge, 70) * 0.7 + 24 * (1 - Math.abs(126 - lum) / 130),
  };
}
async function extractVideo(file, report, cancel) {
  const url = URL.createObjectURL(file),
    v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  try {
    const ready = waitMedia(v, "loadeddata", 26000);
    v.src = url;
    v.load();
    await ready;
    let duration = v.duration;
    if (!Number.isFinite(duration)) {
      const done = waitMedia(v, "seeked");
      v.currentTime = 1e9;
      await done;
      duration = v.duration;
      await seek(v, 0.01);
    }
    if (!(duration > 0.12 && Number.isFinite(duration)))
      throw Error(
        "The recording has no readable duration. Try a longer MP4 clip.",
      );
    const bins = Math.min(60, Math.max(4, Math.ceil(duration / 6))),
      frames = [],
      scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight)),
      full = canvasOf(v.videoWidth * scale, v.videoHeight * scale),
      g = full.getContext("2d");
    for (let i = 0; i < bins; i++) {
      let best = null;
      for (const phase of [0.2, 0.52, 0.8]) {
        if (cancel()) throw Error("Import cancelled.");
        const t = Math.min(duration - 0.055, ((i + phase) * duration) / bins);
        await seek(v, Math.max(0.001, t));
        const stats = frameStats(v);
        if (!best || stats.score > best.score) {
          g.drawImage(v, 0, 0, full.width, full.height);
          best = {
            ...stats,
            time: t,
            src: full.toDataURL("image/jpeg", 0.84),
            width: full.width,
            height: full.height,
            id: uid(),
          };
        }
      }
      frames.push(best);
      report(
        (i + 1) / bins,
        "Selecting sharp frames · " + (i + 1) + " / " + bins,
      );
    }
    const selected = [];
    for (const f of [...frames].sort((a, b) => b.score - a.score)) {
      if (selected.length >= 16) break;
      if (
        !selected.some(
          (s) =>
            s.hist.reduce((sum, n, i) => sum + Math.abs(n - f.hist[i]), 0) <
            0.24,
        )
      )
        selected.push(f);
    }
    const photos = selected
      .sort((a, b) => a.time - b.time)
      .map((f, i) => ({
        id: f.id,
        room: "",
        name: "View " + String(i + 1).padStart(2, "0"),
        src: f.src,
        time: f.time,
        selected: true,
      }));
    return {
      duration,
      frames,
      photos,
      notes: [
        ...(frames.some((f) => f.lum < 45)
          ? ["Dark sections found. Revisit those areas with more light."]
          : []),
        ...(frames.some((f) => f.edge < 2.8)
          ? [
              "Some frames have few visible edges. Check focus and corner visibility.",
            ]
          : []),
      ],
    };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}
const defaultAdjust = () => ({ enhance: true, vertical: 0, roll: 0 });
async function processPhoto(src, opts = defaultAdjust(), maxSide = 1800) {
  const im = await loadImg(src),
    s = Math.min(1, maxSide / Math.max(im.width, im.height)),
    c = canvasOf(im.width * s, im.height * s),
    g = c.getContext("2d", { willReadFrequently: true }),
    w = c.width,
    h = c.height;
  const roll = ((Number(opts.roll) || 0) * Math.PI) / 180,
    keystone = (Number(opts.vertical) || 0) / 100;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2);
  g.rotate(roll);
  const zoom =
    Math.max(
      Math.abs(Math.cos(roll)) + (h / w) * Math.abs(Math.sin(roll)),
      Math.abs(Math.cos(roll)) + (w / h) * Math.abs(Math.sin(roll)),
    ) *
    (1 + Math.abs(keystone));
  g.scale(zoom, zoom);
  g.translate(-w / 2, -h / 2);
  if (keystone) {
    for (let y = 0; y < h; y++) {
      const stretch = 1 + keystone * ((2 * y) / h - 1);
      g.drawImage(
        im,
        0,
        y / s,
        im.width,
        Math.max(1, 1 / s),
        (w * (1 - stretch)) / 2,
        y,
        w * stretch,
        1.1,
      );
    }
  } else g.drawImage(im, 0, 0, w, h);
  if (opts.enhance) {
    const image = g.getImageData(0, 0, w, h),
      a = image.data,
      orig = new Uint8ClampedArray(a),
      hist = new Uint32Array(256);
    let sum = [0, 0, 0],
      count = 0;
    for (let i = 0; i < a.length; i += 40) {
      const l = Math.round(
        0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2],
      );
      hist[l]++;
      for (let k = 0; k < 3; k++) sum[k] += a[i + k];
      count++;
    }
    const quant = (q) => {
        let n = 0;
        for (let i = 0; i < 256; i++) {
          n += hist[i];
          if (n >= count * q) return i;
        }
        return 255;
      },
      lo = Math.min(30, quant(0.008)),
      hi = Math.max(215, quant(0.992)),
      avg = sum.reduce((u, v) => u + v, 0) / 3,
      wb = sum.map((x) => Math.max(0.96, Math.min(1.04, avg / Math.max(x, 1))));
    for (let i = 0; i < a.length; i += 4)
      for (let k = 0; k < 3; k++) {
        const k0 = i + k,
          sharp =
            i >= w * 4 &&
            i < a.length - w * 4 &&
            i % (w * 4) >= 4 &&
            i % (w * 4) < (w - 1) * 4
              ? 0.22 *
                (orig[k0] -
                  (orig[k0 - 4] +
                    orig[k0 + 4] +
                    orig[k0 - w * 4] +
                    orig[k0 + w * 4]) *
                    0.25)
              : 0;
        a[k0] = ((orig[k0] * wb[k] - lo) * 255) / (hi - lo) + sharp;
      }
    g.putImageData(image, 0, 0);
  }
  return c.toDataURL("image/jpeg", 0.92);
}
async function tinyImage(src, size = 640) {
  let im = await loadImg(src);
  let f = Math.min(1, size / Math.max(im.width, im.height));
  let c = canvasOf(im.width * f, im.height * f);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.76);
}
async function postAI(endpoint, body) {
  if (hosted) return cloudAPI(endpoint, body);
  if (location.protocol === "file:")
    throw Error("Open the local Studio server to use AI reconstruction.");
  const r = await fetch("/api/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let j;
  try {
    j = await r.json();
  } catch {
    throw Error("The local AI service could not be reached.");
  }
  if (!r.ok)
    throw Error(j.error || "The AI service could not complete this request.");
  return j;
}
