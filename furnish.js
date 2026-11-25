"use strict";
// Render a constrained furniture catalogue. Claude only supplies structured data.
function tint(hex, light) {
  const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (
    "rgb(" +
    values
      .map((n) =>
        Math.round(light > 1 ? n + (255 - n) * (light - 1) : n * light),
      )
      .join(",") +
    ")"
  );
}
function sketchPiece(ctx, item, anchor, width, height) {
  const yaw = (anchor.yaw * Math.PI) / 180,
    cos = Math.cos(yaw),
    sin = Math.sin(yaw);
  const unit = (anchor.span * width) / item.width,
    ox = anchor.x * width,
    oy = anchor.y * height;
  const w = item.width,
    d = item.depth,
    h = item.height,
    c = item.color;
  const faces = [];
  function project(x, z, elevation) {
    const towards = x * sin + z * cos;
    return [
      ox + (x * cos - z * sin) * unit,
      oy + (towards * 0.31 - elevation * 0.95) * unit,
      towards + elevation * 0.3,
    ];
  }
  function face(points, fill, round = 0) {
    const p = points.map((v) => project(...v));
    faces.push({
      p,
      fill,
      round,
      z: p.reduce((sum, v) => sum + v[2], 0) / p.length,
    });
  }
  function box(x, z, y, ww, dd, hh, color, round = 0.018) {
    const a = x - ww / 2,
      b = x + ww / 2,
      l = z - dd / 2,
      r = z + dd / 2,
      t = y + hh;
    face(
      [
        [a, l, y],
        [b, l, y],
        [b, l, t],
        [a, l, t],
      ],
      tint(color, 0.8),
      round,
    );
    face(
      [
        [a, r, y],
        [b, r, y],
        [b, r, t],
        [a, r, t],
      ],
      tint(color, 0.88),
      round,
    );
    face(
      [
        [a, l, y],
        [a, r, y],
        [a, r, t],
        [a, l, t],
      ],
      tint(color, 0.73),
      round,
    );
    face(
      [
        [b, l, y],
        [b, r, y],
        [b, r, t],
        [b, l, t],
      ],
      tint(color, 0.84),
      round,
    );
    face(
      [
        [a, l, t],
        [b, l, t],
        [b, r, t],
        [a, r, t],
      ],
      tint(color, 1.12),
      round,
    );
  }
  const wood = "#936f51",
    legs = (ww, dd, hh, t, color) => {
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          box(x * ww * 0.41, z * dd * 0.38, 0, t, t, hh, color, 0.006);
    };
  ctx.save();
  ctx.fillStyle = "rgba(31,27,22,.15)";
  ctx.filter = "blur(" + Math.max(1, unit * 0.024) + "px)";
  ctx.beginPath();
  for (const [i, [x, z]] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].entries()) {
    const [u, v] = project(x * w * 0.49, z * d * 0.49, 0);
    if (i) ctx.lineTo(u, v);
    else ctx.moveTo(u, v);
  }
  ctx.closePath();
  ctx.fill();
  ctx.filter = "none";
  if (item.kind === "sofa" || item.kind === "armchair") {
    legs(w, d, h * 0.22, Math.min(w, d) * 0.07, wood);
    box(0, 0, h * 0.14, w, d, h * 0.24, c);
    const count = item.kind === "sofa" ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const ww = (w * 0.78) / count,
        x = -w * 0.39 + ww * (i + 0.5);
      box(x, d * 0.04, h * 0.37, ww * 0.985, d * 0.72, h * 0.17, c, 0.035);
      box(x, -d * 0.37, h * 0.39, ww * 0.99, d * 0.22, h * 0.58, c, 0.045);
    }
    for (const side of [-1, 1])
      box(
        w * 0.445 * side,
        d * 0.02,
        h * 0.32,
        w * 0.11,
        d * 0.96,
        h * 0.4,
        c,
        0.05,
      );
  } else if (item.kind === "bed") {
    legs(w, d, h * 0.23, 0.08, wood);
    box(0, 0, h * 0.14, w, d, h * 0.24, wood);
    box(0, 0, h * 0.36, w * 0.99, d * 0.98, h * 0.17, "#f1ece2", 0.04);
    box(0, d * 0.12, h * 0.52, w, d * 0.71, h * 0.065, c, 0.035);
    box(0, -d * 0.48, h * 0.2, w, d * 0.07, h * 0.8, c, 0.04);
    for (const side of [-1, 1])
      box(
        w * 0.235 * side,
        -d * 0.29,
        h * 0.52,
        w * 0.41,
        d * 0.18,
        h * 0.11,
        "#efeadf",
        0.055,
      );
  } else if (
    ["coffee_table", "dining_table", "desk", "console"].includes(item.kind)
  ) {
    legs(w, d, h * 0.9, Math.min(w, d) * 0.075, wood);
    box(0, 0, h * 0.89, w, d, h * 0.11, c, 0.025);
    if (item.kind === "console")
      box(0, 0, h * 0.51, w * 0.95, d * 0.94, h * 0.38, c);
  } else if (item.kind === "chair") {
    legs(w, d, h * 0.5, Math.min(w, d) * 0.075, wood);
    box(0, 0, h * 0.48, w, d, h * 0.1, c, 0.04);
    box(0, -d * 0.43, h * 0.53, w * 0.94, d * 0.12, h * 0.46, c, 0.04);
  } else if (item.kind === "rug") {
    box(0, 0, 0, w, d, Math.min(0.025, h), c, 0);
    for (const side of [-1, 1])
      for (const offset of [0.42, 0.45])
        box(
          0,
          side * d * offset,
          0.027,
          w * 0.98,
          d * 0.015,
          0.002,
          "#c9bba5",
          0,
        );
  } else if (item.kind === "plant") {
    box(0, 0, 0, w * 0.45, d * 0.45, h * 0.33, "#c7ab8b", 0.025);
    box(0, 0, h * 0.31, w * 0.06, d * 0.06, h * 0.56, wood);
    for (let i = 0; i < 18; i++) {
      const theta = i * 2.399,
        level = 0.36 + (0.47 * i) / 18;
      const ex = Math.cos(theta) * w * 0.47,
        ez = Math.sin(theta) * d * 0.47;
      face(
        [
          [0, 0, h * level],
          [ex * 0.55 - ez * 0.14, ez * 0.55 + ex * 0.14, h * (level + 0.16)],
          [ex, ez, h * (level + 0.09)],
          [ex * 0.55 + ez * 0.14, ez * 0.55 - ex * 0.14, h * (level + 0.04)],
        ],
        tint(c, i % 2 ? 0.94 : 0.75),
      );
    }
  }
  faces.sort((a, b) => a.z - b.z);
  for (const { p, fill, round } of faces) {
    ctx.beginPath();
    if (round) {
      ctx.moveTo((p[0][0] + p.at(-1)[0]) / 2, (p[0][1] + p.at(-1)[1]) / 2);
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length];
        ctx.arcTo(
          a[0],
          a[1],
          (a[0] + b[0]) / 2,
          (a[1] + b[1]) / 2,
          Math.min(round * unit, Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.16),
        );
      }
    } else p.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(52,42,33,.13)";
    ctx.lineWidth = Math.max(0.45, width / 2200);
    ctx.stroke();
  }
  ctx.restore();
}
async function furnishPhotograph(photo, design) {
  const image = await loadImg(photo.src),
    ratio = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = canvasOf(image.width * ratio, image.height * ratio),
    ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const views = design.placements[photo.id] || [],
    pieces = new Map(design.inventory.map((v) => [v.id, v]));
  const anchored = views.filter((v) => pieces.has(v.item));
  if (!anchored.length) return null;
  anchored.sort(
    (a, b) =>
      Number(pieces.get(b.item).kind === "rug") -
        Number(pieces.get(a.item).kind === "rug") || a.y - b.y,
  );
  for (const a of anchored)
    sketchPiece(ctx, pieces.get(a.item), a, canvas.width, canvas.height);
  const size = Math.max(11, canvas.width / 65),
    pad = size * 0.55,
    label = "FURNISHING CONCEPT  /  " + design.style.toUpperCase();
  ctx.font = "600 " + size + "px system-ui";
  const mw = ctx.measureText(label).width + 2 * pad;
  ctx.fillStyle = "rgba(22,39,31,.90)";
  ctx.fillRect(pad, canvas.height - size * 2.9, mw, size * 2.15);
  ctx.fillStyle = "white";
  ctx.fillText(label, 2 * pad, canvas.height - size * 1.48);
  return canvas.toDataURL("image/jpeg", 0.82);
}
function roomDesignKey(photo) {
  return (photo.room || photo.id) + "|" + style;
}
function conceptSource(photo) {
  return p.example && photo.id === "living"
    ? { ...photo, src: asset("empty.jpg") }
    : photo;
}
async function prepareDesign(photo) {
  p.designs ||= {};
  const key = roomDesignKey(photo),
    existing = p.designs[key];
  if (existing?.placements?.[photo.id]) return existing;
  const remaining = p.photos.filter(
    (f) =>
      f.id !== photo.id &&
      photo.room &&
      f.room === photo.room &&
      !existing?.placements?.[f.id],
  );
  const group = [photo, ...remaining].slice(0, 6),
    images = [];
  for (const view of group)
    images.push({
      id: view.id,
      image: await tinyImage(conceptSource(view).src, 560),
    });
  const room = p.rooms.find((r) => r.id === photo.room)?.name || photo.name;
  const result = await cloudAPI("design", {
    style,
    room,
    photos: images,
    inventory: existing?.inventory || [],
  });
  const design = {
    style,
    note: result.note,
    inventory: existing?.inventory || result.inventory,
    placements: { ...existing?.placements, ...result.placements },
  };
  p.designs[key] = design;
  await save();
  return design;
}
function confirmDesign(batch) {
  if (!cloudUser) {
    workspaceDialog(() => confirmDesign(batch));
    return;
  }
  const views = batch
    ? p.photos.filter((f) => f.selected)
    : [stagedPhoto()].filter(Boolean);
  if (!views.length) {
    toast("Choose a photograph first.");
    return;
  }
  const tasks = views.filter(
    (f) => !p.designs?.[roomDesignKey(f)]?.placements?.[f.id],
  );
  if (tasks.length && !connected) {
    connectDialog();
    return;
  }
  modal(
    batch ? "Furnish selected views" : "Design this room",
    '<div class="form-grid"><p>Claude reviews up to six small photographs of the same room per request. Raumscan draws the proposed pieces onto each view in the ' +
      esc(style) +
      " style.</p>" +
      msg(
        tasks.length
          ? "Design requests use the studio’s Anthropic API credits. Furniture and finishes are reused across views of the room."
          : "This room design is saved. Rendering these views uses no additional Claude credits.",
      ) +
      '<p class="sub">Review placement against doors, windows and existing furniture. Exported concepts carry a visible label.</p><div class="form-footer"><button id="generate-concept" class="btn primary">Generate furnishing concept</button></div><div class="app-error" id="operation-error"></div></div>',
  );
  $("#generate-concept").onclick = async () => {
    operation("Designing the room", "Preparing room views…");
    try {
      let drawn = 0;
      for (const f of views) {
        $("#op-status").textContent = "Preparing " + f.name + " · " + style;
        const design = await prepareDesign(f);
        const src = await furnishPhotograph(conceptSource(f), design);
        if (src) {
          p.staged[f.id] = { style, src, use: batch, kind: "concept" };
          drawn++;
        }
      }
      await save();
      busy = false;
      closeModal();
      render();
      toast(
        drawn
          ? drawn + " furnishing concept" + (drawn === 1 ? "" : "s") + " ready."
          : "Claude found no unobstructed placement in these views. Try another photograph.",
      );
    } catch (e) {
      operationError(e);
    }
  };
}
const furnitureSizes = {
  sofa: ["Sofa", 2.15, 0.88, 0.84],
  armchair: ["Armchair", 0.79, 0.81, 0.82],
  coffee_table: ["Coffee table", 0.95, 0.58, 0.4],
  dining_table: ["Dining table", 1.58, 0.89, 0.76],
  chair: ["Dining chair", 0.48, 0.55, 0.88],
  bed: ["Double bed", 1.65, 2.1, 1.05],
  desk: ["Desk", 1.26, 0.62, 0.75],
  rug: ["Rug", 2.3, 1.48, 0.02],
  plant: ["Potted plant", 0.65, 0.62, 1.14],
  console: ["Console", 1.24, 0.38, 0.74],
};
async function arrangeFurniture() {
  const photo = stagedPhoto();
  if (!photo) return;
  p.designs ||= {};
  const key = roomDesignKey(photo),
    saved = p.designs[key];
  const design = structuredClone(
    saved || { style, inventory: [], placements: {}, note: "" },
  );
  design.placements[photo.id] ||= [];
  const image = await loadImg(conceptSource(photo).src);
  modal(
    "Arrange furniture",
    '<div class="form-grid"><p>Choose a piece and click the floor where its centre should sit.</p><canvas id="furniture-canvas" class="furniture-canvas" aria-label="Room photograph with furniture placement preview"></canvas>' +
      field("Furniture piece", '<select id="furniture-picker"></select>') +
      '<div class="fields">' +
      field(
        "Horizontal position",
        '<input type="range" id="furniture-x" min="0" max="100" value="50">',
      ) +
      field(
        "Floor position",
        '<input type="range" id="furniture-y" min="0" max="100" value="75">',
      ) +
      field(
        "Size in this view",
        '<input type="range" id="furniture-size" min="3" max="140" value="32">',
      ) +
      field(
        "Rotation",
        '<input type="range" id="furniture-yaw" min="-180" max="180" value="0">',
      ) +
      '</div><div class="form-footer"><button class="btn" id="remove-piece">Remove from this view</button><button class="btn primary" id="save-concept">Save furnishing concept</button></div><div class="app-error" id="operation-error"></div></div>',
  );
  const canvas = $("#furniture-canvas"),
    ratio = Math.min(1, 1000 / Math.max(image.width, image.height));
  canvas.width = image.width * ratio;
  canvas.height = image.height * ratio;
  const picker = $("#furniture-picker"),
    anchors = design.placements[photo.id];
  const options = design.inventory.map((v) => [v.id, v.name]);
  for (const [kind, [name]] of Object.entries(furnitureSizes))
    if (!design.inventory.some((v) => v.kind === kind))
      options.push(["new-" + kind, name]);
  picker.replaceChildren(
    ...options.map(([id, label]) => new Option(label, id)),
  );
  const selected = () => design.inventory.find((v) => v.id === picker.value);
  const position = () => anchors.find((v) => v.item === picker.value);
  function paint() {
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const ordered = anchors
      .map((a) => [design.inventory.find((i) => i.id === a.item), a])
      .filter(([i]) => i);
    ordered.sort(
      ([a, p], [b, q]) =>
        Number(b.kind === "rug") - Number(a.kind === "rug") || p.y - q.y,
    );
    for (const [piece, anchor] of ordered)
      sketchPiece(ctx, piece, anchor, canvas.width, canvas.height);
    $("#remove-piece").disabled = !position();
  }
  function controls() {
    const a = position() || { x: 0.5, y: 0.74, span: 0.32, yaw: 0 };
    for (const [id, n] of [
      ["x", a.x * 100],
      ["y", a.y * 100],
      ["size", a.span * 100],
      ["yaw", a.yaw],
    ])
      $("#furniture-" + id).value = n;
    paint();
  }
  function place() {
    let item = selected();
    if (!item) {
      const kind = picker.value.slice(4),
        [name, width, depth, height] = furnitureSizes[kind];
      if (design.inventory.length >= 6) {
        toast("This room already has six furniture pieces.");
        return;
      }
      const palette = styles[style];
      item = {
        id: kind,
        kind,
        name,
        width,
        depth,
        height,
        color:
          kind === "plant"
            ? "#698254"
            : palette[design.inventory.length % palette.length],
      };
      if (design.inventory.some((x) => x.id === item.id))
        item.id = "custom_" + design.inventory.length;
      design.inventory.push(item);
      picker.selectedOptions[0].value = item.id;
    }
    const a = position() || { item: item.id };
    Object.assign(a, {
      x: Number($("#furniture-x").value) / 100,
      y: Number($("#furniture-y").value) / 100,
      span: Number($("#furniture-size").value) / 100,
      yaw: Number($("#furniture-yaw").value),
    });
    if (!anchors.includes(a)) anchors.push(a);
    paint();
  }
  picker.onchange = controls;
  canvas.onclick = (e) => {
    const r = canvas.getBoundingClientRect();
    $("#furniture-x").value = (100 * (e.clientX - r.left)) / r.width;
    $("#furniture-y").value = (100 * (e.clientY - r.top)) / r.height;
    place();
  };
  for (const id of ["x", "y", "size", "yaw"])
    $("#furniture-" + id).oninput = place;
  $("#remove-piece").onclick = () => {
    const i = anchors.indexOf(position());
    if (i >= 0) anchors.splice(i, 1);
    controls();
  };
  $("#save-concept").onclick = async () => {
    try {
      const src = await furnishPhotograph(conceptSource(photo), design);
      p.designs[key] = design;
      if (src) p.staged[photo.id] = { src, style, use: false, kind: "concept" };
      else delete p.staged[photo.id];
      await save();
      closeModal();
      render();
      toast("Furniture arrangement saved.");
    } catch (e) {
      fail(e);
    }
  };
  controls();
}
