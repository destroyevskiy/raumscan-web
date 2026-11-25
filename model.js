"use strict";
const assets = window.RAUMSCAN_ASSETS || {};
const asset = (name) => assets[name] || "assets/" + name;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n) =>
  Number(n).toLocaleString("en-GB", { maximumFractionDigits: 1 });
const clock = (t) =>
  Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
const area = (rooms) => rooms.reduce((s, r) => s + r.w * r.h, 0);
const icoPaths = {
  logo: '<path d="M3 19V8l9-5 9 5v11l-9 5z M3 8l9 5 9-5 M12 13v11 M7 10.3v6.2l5 2.8 M12 7l5 2.8"/>',
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  scan: '<path d="M3 8V4h5m8 0h5v4m0 8v4h-5M8 20H3v-4"/><path d="m8 13 3 2 5-6"/>',
  video:
    '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  plan: '<path d="M3 3h18v18H3z M3 13h8m0-10v10m4 0h6m-7 0v8"/>',
  camera:
    '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3.3"/>',
  stage:
    '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  doc: '<path d="M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h6"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zm0 0v15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  upRight: '<path d="M6 18 18 6 M6 6h12v12"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  swap: '<path d="m8 8 4-4 4 4m-8 8 4 4 4-4"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  building:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h2m4 0h2m-8 4h2m4 0h2m-5 10v-5h3v5"/>',
  ruler: '<path d="m3 16 13-13 5 5L8 21z M13 6l3 3m-6 0 2 2m-5 1 3 3"/>',
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5"/>',
  play: '<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="4"/>',
  expand: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  cube: '<path d="m3 7 9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5m-9 5v10"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  close: '<path d="m5 5 14 14m0-14L5 19"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M3 16v5h18v-5"/>',
  film: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M7 4v16m10-16v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
  folder: '<path d="M3 6h6l2 3h10v11H3z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  edit: '<path d="m4 16 12-12 4 4L8 20H4z M14 6l4 4"/>',
  flag: '<path d="M5 21V4c5-3 9 3 15 0v10c-6 3-10-3-15 0"/>',
  bulb: '<path d="M9 17c0-3-4-4-4-8a7 7 0 1 1 14 0c0 4-4 5-4 8zM9 21h6"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 5-5 3 3 4-7 6 7"/>',
  rotate: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  trash: '<path d="M3 6h18M6 6l1 15h10l1-15M9 6V3h6v3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  settings:
    '<path d="M3 7h9m4 0h5M3 17h3m4 0h11"/><circle cx="14" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  pdf: '<path d="M5 3h10l4 4v14H5z M14 3v5h5"/><path d="M8 16c3-1 5-5 4-6-2 2 0 7 4 6"/>',
  home: '<path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7"/>',
};
function icon(name, size = 18) {
  return (
    '<svg aria-hidden="true" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    (icoPaths[name] || "") +
    "</svg>"
  );
}
const opening = (kind, side, at, width) => ({ kind, side, at, width });
const demoRooms = [
  {
    id: "living",
    name: "Living room",
    x: 0,
    y: 0,
    w: 5.6,
    h: 4.5,
    openings: [
      opening("window", "N", 0.9, 1.3),
      opening("window", "W", 1.2, 1.7),
      opening("door", "S", 4.2, 0.9),
    ],
  },
  {
    id: "bedroom",
    name: "Bedroom",
    x: 5.6,
    y: 0,
    w: 4.4,
    h: 4.5,
    openings: [
      opening("window", "N", 1.5, 1.5),
      opening("door", "S", 0.35, 0.9),
    ],
  },
  {
    id: "hall",
    name: "Hallway",
    x: 0,
    y: 4.5,
    w: 10,
    h: 1.25,
    openings: [opening("door", "E", 0.15, 0.85)],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    x: 0,
    y: 5.75,
    w: 5.6,
    h: 3,
    openings: [
      opening("door", "N", 3.65, 0.9),
      opening("window", "S", 1.1, 1.8),
    ],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    x: 5.6,
    y: 5.75,
    w: 3.2,
    h: 3,
    openings: [opening("door", "N", 0.6, 0.85), opening("window", "S", 1, 0.9)],
  },
];
function demoProject() {
  return {
    id: "sample",
    name: "Charlottenburg apartment",
    address: "Charlottenburg, Berlin",
    example: true,
    planSource: "Illustrative sample",
    rooms: structuredClone(demoRooms),
    photos: ["living", "bedroom", "kitchen", "bathroom", "hall"].map(
      (id, i) => ({
        id,
        room: id,
        name: demoRooms.find((r) => r.id === id).name,
        src: asset(id + ".jpg"),
        time: [5, 13, 9, 17, 1][i],
        selected: true,
      }),
    ),
    frames: [],
    duration: 20,
    footage: "Illustrated walkthrough",
    staged: {},
    notes: [],
    brand: "Raumscan Studio",
    language: "de",
    purpose: "Sale",
    description: "",
    planVerified: false,
  };
}
function bounds(rooms) {
  const x = Math.min(...rooms.map((r) => r.x)),
    y = Math.min(...rooms.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...rooms.map((r) => r.x + r.w)) - x,
    h: Math.max(...rooms.map((r) => r.y + r.h)) - y,
  };
}
function furnishings(r) {
  const n = r.name.toLowerCase(),
    w = r.w,
    h = r.h;
  let s = "";
  const box = (x, y, b, d, rad = 0) =>
    '<rect x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    b +
    '" height="' +
    d +
    '" rx="' +
    rad +
    '"/>';
  if (n.includes("living")) {
    s =
      box(0.23, 0.48, 0.9, 2.4, 0.07) +
      box(0.35, 0.68, 0.78, 0.62, 0.05) +
      box(0.35, 1.35, 0.78, 0.62, 0.05) +
      box(0.35, 2.02, 0.78, 0.62, 0.05) +
      box(1.48, 1.06, 1.08, 1.12, 0.15) +
      box(w - 1.16, 0.22, 0.85, 0.85, 0.16);
  } else if (n.includes("bed")) {
    s =
      box(w - 2.2, 0.22, 1.75, 2.1, 0.05) +
      box(w - 2.13, 0.3, 0.76, 0.44, 0.06) +
      box(w - 1.29, 0.3, 0.76, 0.44, 0.06) +
      box(w - 2.2, 0.88, 1.75, 1.44, 0.05) +
      box(w - 2.72, 0.23, 0.42, 0.49, 0.04);
  } else if (n.includes("kitchen")) {
    s =
      box(0.15, 0.16, 0.58, h - 0.32) +
      box(0.73, h - 0.72, w - 1, 0.54) +
      box(0.23, 0.79, 0.42, 0.6, 0.05) +
      '<circle cx="1.4" cy="' +
      (h - 0.44) +
      '" r=".14"/><circle cx="1.8" cy="' +
      (h - 0.44) +
      '" r=".12"/>';
  } else if (n.includes("bath")) {
    s =
      box(w - 0.87, 0.16, 0.72, 1.65, 0.12) +
      box(w - 0.79, 0.27, 0.54, 1.42, 0.15) +
      box(0.15, h - 0.73, 0.7, 0.54, 0.07) +
      '<ellipse cx="1.46" cy="' +
      (h - 0.51) +
      '" rx=".23" ry=".35"/>';
  }
  return (
    '<g transform="translate(' +
    r.x +
    " " +
    r.y +
    ')" stroke="#a9aaa0" stroke-width=".023" fill="#e9e9df">' +
    s +
    "</g>"
  );
}
function floorSVG(project, mode = "2d", angle = 0, large = false) {
  const rooms = project.rooms;
  if (!rooms.length) return "";
  const b = bounds(rooms),
    p = 0.8,
    colors = ["#e5e9db", "#efe7de", "#edeee7", "#e8e4d8", "#dfebe8"];
  if (mode === "3d") return isoPlan(rooms, angle, project.example);
  const rects = rooms
    .map(
      (r, i) =>
        '<rect x="' +
        r.x +
        '" y="' +
        r.y +
        '" width="' +
        r.w +
        '" height="' +
        r.h +
        '" fill="' +
        colors[i % colors.length] +
        '"/>',
    )
    .join("");
  const walls = rooms
    .map(
      (r) =>
        '<rect x="' +
        r.x +
        '" y="' +
        r.y +
        '" width="' +
        r.w +
        '" height="' +
        r.h +
        '" fill="none" stroke="#394640" stroke-width=".12"/>',
    )
    .join("");
  const openings = rooms
    .flatMap((r) =>
      (r.openings || []).map((o) => {
        const horizontal = "NS".includes(o.side);
        const limit = horizontal ? r.w : r.h;
        const len = Math.min(o.width, limit),
          pos = Math.max(0, Math.min(o.at, limit - len));
        const x = r.x + (horizontal ? pos : o.side === "E" ? r.w : 0),
          y = r.y + (horizontal ? (o.side === "S" ? r.h : 0) : pos);
        const transform =
          "translate(" +
          x +
          " " +
          y +
          ") " +
          (horizontal
            ? o.side === "S"
              ? "scale(1 -1)"
              : ""
            : "matrix(0 1 " + (o.side === "E" ? -1 : 1) + " 0 0 0)");
        return (
          '<g transform="' +
          transform +
          '"><path d="M0 0h' +
          len +
          '" stroke="#fbfcf8" stroke-width=".15"/>' +
          (o.kind === "window"
            ? '<rect x="0" y="-.048" width="' +
              len +
              '" height=".096" fill="#f3f8f6" stroke="#748c84" stroke-width=".027"/><path d="M0 0h' +
              len +
              '" stroke="#748c84" stroke-width=".021"/>'
            : '<path d="M0 0v' +
              len +
              " M0 " +
              len +
              " A" +
              len +
              " " +
              len +
              " 0 0 0 " +
              len +
              ' 0" fill="none" stroke="#899289" stroke-width=".03"/>') +
          "</g>"
        );
      }),
    )
    .join("");
  const labels = rooms
    .map(
      (r) =>
        '<g font-family="Arial,sans-serif" text-anchor="middle" fill="#34453b"><text x="' +
        (r.x + r.w / 2) +
        '" y="' +
        (r.y + r.h / 2 - 0.03) +
        '" font-size=".26" font-weight="600" stroke="#eeeee5" stroke-width=".06" paint-order="stroke">' +
        esc(r.name) +
        '</text><text x="' +
        (r.x + r.w / 2) +
        '" y="' +
        (r.y + r.h / 2 + 0.34) +
        '" font-size=".215">' +
        fmt(r.w * r.h) +
        " m²</text></g>",
    )
    .join("");
  const dimension =
    '<g stroke="#98a19b" stroke-width=".022" fill="none"><path d="M' +
    b.x +
    " " +
    (b.y - 0.37) +
    "h" +
    b.w +
    "m0 -.1v.2M" +
    b.x +
    " " +
    (b.y - 0.47) +
    'v.2"/></g><text x="' +
    (b.x + b.w / 2) +
    '" y="' +
    (b.y - 0.43) +
    '" text-anchor="middle" font-family="monospace" font-size=".21" fill="#69796d">' +
    fmt(b.w) +
    " m</text>";
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Apartment floor plan in two dimensions" viewBox="' +
    [b.x - p, b.y - p, b.w + 2 * p, b.h + 2 * p].join(" ") +
    '">' +
    rects +
    (project.example ? rooms.map(furnishings).join("") : "") +
    walls +
    openings +
    labels +
    dimension +
    "</svg>"
  );
}
function isoPlan(rooms, angle, example) {
  const b = bounds(rooms),
    theta = ((angle - 33) * Math.PI) / 180,
    cos = Math.cos(theta),
    sin = Math.sin(theta);
  const proj = (x, y, z = 0) => [
    (x * cos - y * sin) * 39,
    (x * sin + y * cos) * 23 - z * 38,
  ];
  const pts = (points) => points.map((p) => proj(...p).join(",")).join(" ");
  const poly = (ps, fill) =>
    '<polygon points="' +
    pts(ps) +
    '" fill="' +
    fill +
    '" stroke="#728076" stroke-width="1"/>';
  let faces = [],
    floor = "",
    top = "",
    labels = "";
  rooms.forEach((r, i) => {
    const { x, y, w, h } = r;
    const ring = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
    floor += poly(
      ring,
      ["#d9d5bd", "#e7d9c8", "#dadfcf", "#d6cdb9", "#d0dfda"][i % 5],
    );
    for (let j = 0; j < 4; j++) {
      const a = ring[j],
        d = ring[(j + 1) % 4],
        side = ["N", "E", "S", "W"][j],
        horizontal = j % 2 === 0,
        limit = horizontal ? w : h;
      // Cut the model at sill height to keep the room interiors visible.
      const baseY = (proj(...a)[1] + proj(...d)[1]) / 2,
        wallHeight = 0.72,
        reverse = j >= 2;
      let cursor = 0;
      const segment = (lo, hi, z0, z1, fill) => {
        if (hi - lo < 0.005) return;
        const at = (t) => [
          a[0] + ((d[0] - a[0]) * t) / limit,
          a[1] + ((d[1] - a[1]) * t) / limit,
        ];
        faces.push({
          depth: baseY,
          svg: poly(
            [
              [...at(lo), z0],
              [...at(hi), z0],
              [...at(hi), z1],
              [...at(lo), z1],
            ],
            fill,
          ),
        });
      };
      const openings = [];
      for (const s of rooms)
        for (const o of s.openings || []) {
          const oh = "NS".includes(o.side);
          if (oh !== horizontal) continue;
          const line = oh
            ? s.y + (o.side === "S" ? s.h : 0)
            : s.x + (o.side === "E" ? s.w : 0);
          if (Math.abs(line - (oh ? a[1] : a[0])) > 0.01) continue;
          const start = (oh ? s.x : s.y) + o.at - (oh ? x : y);
          if (start < -0.01 || start + o.width > limit + 0.01) continue;
          openings.push({
            lo: reverse ? limit - start - o.width : start,
            hi: reverse ? limit - start : start + o.width,
            kind: o.kind,
          });
        }
      for (const o of openings.sort((u, v) => u.lo - v.lo)) {
        segment(cursor, o.lo, 0, wallHeight, j % 2 ? "#abb9ac" : "#f2f1e7");
        if (o.kind === "window") {
          segment(o.lo, o.hi, 0, 0.26, "#d7e1d7");
          segment(o.lo, o.hi, 0.26, 0.68, "#b4d7d1");
        }
        cursor = Math.max(cursor, o.hi);
      }
      segment(cursor, limit, 0, wallHeight, j % 2 ? "#b4beb1" : "#f2f1e7");
    }
  });
  const all = rooms.flatMap((r) =>
    [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ].flatMap((p) => [proj(...p), proj(...p, 0.72)]),
  );
  const xx = all.map((p) => p[0]),
    yy = all.map((p) => p[1]),
    left = Math.min(...xx) - 15,
    up = Math.min(...yy) - 15;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rotatable three-dimensional cutaway of the floor plan" viewBox="' +
    [left, up, Math.max(...xx) - left + 15, Math.max(...yy) - up + 15].join(
      " ",
    ) +
    '">' +
    floor +
    faces
      .sort((a, b) => a.depth - b.depth)
      .map((f) => f.svg)
      .join("") +
    "</svg>"
  );
}
