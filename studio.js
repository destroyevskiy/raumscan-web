"use strict";
const $ = (q) => document.querySelector(q),
  $$ = (q) => [...document.querySelectorAll(q)];
const pages = [
  ["overview", "overview", "Project overview"],
  ["capture", "video", "Walkthrough"],
  ["plan", "plan", "Floor plan"],
  ["photos", "camera", "Photography"],
  ["stage", "stage", "Virtual staging"],
  ["export", "doc", "Exposé & export"],
];
const btn = (text, action, ic = "", style = "") =>
  '<button type="button" class="btn ' +
  style +
  '" data-act="' +
  action +
  '">' +
  (ic ? icon(ic, 16) : "") +
  esc(text) +
  "</button>";
const ib = (title, act, ic) =>
  '<button type="button" class="icon-btn" title="' +
  esc(title) +
  '" aria-label="' +
  esc(title) +
  '" data-act="' +
  act +
  '">' +
  icon(ic, 16) +
  "</button>";
const msg = (text, kind = "") =>
  '<div class="info ' +
  kind +
  '">' +
  icon("info", 16) +
  "<span>" +
  esc(text) +
  "</span></div>";
const micro = (s) => '<div class="eyebrow"><i></i>' + esc(s) + "</div>";
const field = (label, inside) =>
  '<label class="field">' + esc(label) + inside + "</label>";
const heading = (title, sub, action = "") =>
  '<div class="heading"><div><h1>' +
  esc(title) +
  '</h1><div class="meta">' +
  sub +
  "</div></div>" +
  action +
  "</div>";
let p = demoProject(),
  page = "overview",
  planMode = "2d",
  angle = 0,
  style = "Scandinavian",
  stageId = "",
  photoFilter = "all",
  connected = false,
  saveOK = true,
  loaded = false;
let geometryReady = false;
let cancelImport = false,
  importing = false,
  capture = null,
  chosenFile = null,
  markers = [],
  busy = false,
  selectedRoom = "",
  previewSerial = 0,
  modalCleanup = null;
const styles = {
  Scandinavian: ["#ccb99d", "#eeeadc", "#8d9476"],
  Modern: ["#464b3e", "#99756a", "#d7d1bf"],
  Minimalist: ["#dbd6c9", "#adad9f", "#7d8277"],
  Luxury: ["#655441", "#ae9566", "#ded3c6"],
};
const toast = (text) => {
  const el = $("#toasts");
  el.textContent = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.textContent = ""), 5500);
};
function save() {
  if (hosted && p.cloud) return saveCloud(p);
  if (hosted) return Promise.resolve();
  try {
    localStorage.setItem("raumscan-current", p.id);
  } catch {}
  const project = structuredClone(p);
  return dbOp("projects", "readwrite", (s) => s.put(project))
    .then(() => {
      saveOK = true;
      statusBar();
    })
    .catch(() => {
      saveOK = false;
      statusBar();
      toast(
        "Device storage is full or unavailable. This session is in memory. Export your work before closing.",
      );
    });
}
function statusBar() {
  const el = $(".bar-status");
  if (el)
    el.innerHTML =
      '<i class="dot"></i>' +
      (hosted && p.cloud
        ? esc(cloudSync)
        : !saveOK
          ? "Session only"
          : p.example
            ? "Demo workspace"
            : "Saved on this device");
}
function bar() {
  const label = pages.find((a) => a[0] === page)[2];
  $("#bar").innerHTML =
    ib("Open navigation", "menu", "menu").replace(
      "icon-btn",
      "icon-btn mobile-toggle",
    ) +
    '<button class="crumb" data-act="projects">Workspace</button><span class="slash">/</span><button class="crumb" data-act="projects">Projects</button><span class="slash">/</span><span class="current">' +
    esc(page === "overview" ? "Overview" : label) +
    '</span><span class="bar-status"></span>';
  statusBar();
}
function rail() {
  const nav = (a, i) =>
    '<button class="nav ' +
    (a[0] === page ? "active" : "") +
    '" data-page="' +
    a[0] +
    '" ' +
    (a[0] === page ? 'aria-current="page"' : "") +
    ">" +
    icon(a[1], 17) +
    esc(a[2]) +
    (i ? '<span class="num">0' + i + "</span>" : "") +
    "</button>";
  $("#rail").innerHTML =
    '<div class="brand">' +
    icon("logo", 34) +
    '<span>raumscan</span></div><div class="brand-sub">PROPERTY STUDIO</div><button class="project-switch" data-act="projects"><span class="small-symbol">' +
    icon("building", 18) +
    "</span><span><strong>" +
    esc(p.name) +
    "</strong><small>" +
    (p.example ? "Sample project" : "Active project") +
    "</small></span>" +
    icon("swap", 13) +
    '</button><div class="rail-label">Workspace</div>' +
    nav(pages[0], 0) +
    '<div class="rail-line"></div><div class="rail-label">Production tools</div>' +
    pages
      .slice(1)
      .map((a, i) => nav(a, i + 1))
      .join("") +
    '<div class="sidebar-bottom"><button class="nav" data-act="guide">' +
    icon("book", 16) +
    "Capture guide</button>" +
    (hosted
      ? '<button class="nav" data-act="workspace">' +
        icon("folder", 16) +
        "Workspace key</button>"
      : "") +
    '<button class="nav" data-act="connect">' +
    icon("settings", 16) +
    'AI connection</button><div class="railfoot"><span class="avatar">RS</span><div><b>' +
    (hosted ? "Raumscan Studio" : "Local studio") +
    "</b><small>" +
    (hosted
      ? cloudUser
        ? "Private workspace"
        : "Demo workspace"
      : "Personal workspace") +
    "</small></div></div></div>";
}
function panelHead(name, ic, extra = "") {
  return (
    '<div class="barline"><div class="card-title">' +
    icon(ic, 17) +
    "<h2>" +
    esc(name) +
    "</h2></div>" +
    extra +
    "</div>"
  );
}
function planToggle() {
  return (
    '<div class="seg" aria-label="Floor plan view">' +
    ["2d", "3d"]
      .map(
        (m) =>
          '<button data-mode="' +
          m +
          '" aria-pressed="' +
          (planMode === m) +
          '" class="' +
          (planMode === m ? "on" : "") +
          '">' +
          m.toUpperCase() +
          "</button>",
      )
      .join("") +
    "</div>"
  );
}
function planDraw(large) {
  return (
    '<div class="plan-face paper-grid ' +
    (large ? "full-plan" : "") +
    '"><div class="drawing">' +
    floorSVG(p, planMode, angle, large) +
    '</div><span class="compass">' +
    (p.example ? "N" : "Y") +
    '</span><span class="scale-mark">' +
    (p.example
      ? "SAMPLE MODEL"
      : p.planVerified
        ? "REVIEWED LAYOUT"
        : "DRAFT LAYOUT") +
    "</span>" +
    (planMode === "3d"
      ? '<label class="rotate-row"><span class="visually-hidden">Rotate 3D model</span><input id="rotate" class="orient-range" type="range" min="-180" max="180" value="' +
        angle +
        '"></label>'
      : "") +
    "</div>"
  );
}
function planPanel(large = false) {
  return (
    '<section class="panel">' +
    panelHead("Floor plan", "plan", p.rooms.length ? planToggle() : "") +
    (p.rooms.length
      ? planDraw(large)
      : '<div class="empty"><h3>Your apartment layout</h3><p>Generate a draft from the walkthrough or enter measured rooms.</p>' +
        btn("Review floor plan", "plan", "plan") +
        "</div>") +
    '<div class="card-foot">' +
    icon("layers", 14) +
    "<span>" +
    p.rooms.length +
    " spaces</span>" +
    (p.rooms.length
      ? " <span>·</span> <span>" +
        fmt(area(p.rooms)) +
        " m²" +
        (p.example ? "" : " est.") +
        "</span>"
      : "") +
    (large
      ? ""
      : '<button class="text-btn end" data-page="plan">Open plan ' +
        icon("upRight", 13) +
        "</button>") +
    "</div></section>"
  );
}
function player(tall = false) {
  const poster = p.example
    ? asset("living.jpg")
    : p.photos[0]?.src || p.frames[0]?.src;
  return (
    '<section class="panel">' +
    panelHead(
      "Apartment walkthrough",
      "video",
      '<span class="stamp">' + icon("film", 13) + " Source video</span>",
    ) +
    '<div class="video-face" ' +
    (tall ? 'style="aspect-ratio:16/9"' : "") +
    '><video id="source-video" preload="metadata" playsinline poster="' +
    esc(poster || "") +
    '"></video><span class="capture-tag"><i></i>' +
    (p.example ? "SAMPLE WALKTHROUGH" : "WALKTHROUGH") +
    '</span><div class="reticle"></div><button class="play-big" data-act="play" aria-label="Play walkthrough">' +
    icon("play", 23) +
    '</button><div class="videocontrols"><button data-act="play" id="small-play" aria-label="Play or pause">' +
    icon("play", 14) +
    '</button><span id="video-time">0:00 / ' +
    clock(p.duration) +
    '</span><input type="range" id="seek" min="0" max="1000" value="0" aria-label="Walkthrough playback position"><button data-act="fullscreen" aria-label="Expand video">' +
    icon("expand", 15) +
    '</button></div></div><div class="card-foot">' +
    icon("time", 14) +
    "<span>" +
    clock(p.duration) +
    " duration</span><span>·</span><span>" +
    (p.example ? "Illustrated tour" : p.frames.length + " sampled frames") +
    "</span>" +
    (!tall
      ? '<button class="text-btn end" data-page="capture">View scan ' +
        icon("upRight", 13) +
        "</button>"
      : "") +
    "</div></section>"
  );
}
function toolkit() {
  const cover = p.photos[0]?.src || "",
    photo = p.example ? asset("bedroom.jpg") : p.photos[1]?.src || cover;
  const staged = Object.values(p.staged || {}).find((v) => v.src);
  const previews = [
    '<img class="fill" alt="" src="' + esc(photo) + '">',
    '<div class="split-art"><img alt="" src="' +
      esc(p.example ? asset("living.jpg") : staged?.src || cover) +
      '"><img class="before-art" alt="" src="' +
      esc(p.example ? asset("empty.jpg") : cover) +
      '"></div><span class="split-grip">‹ ›</span>',
    '<div class="paper-sheet">' +
      (p.rooms.length ? floorSVG(p) : "") +
      '</div><div class="paper-cover"><small>Property exposé</small><div class="line"></div><strong>' +
      esc(p.name) +
      '</strong><img alt="" src="' +
      esc(cover) +
      '"></div>',
  ];
  return (
    '<div class="section-title"><h2>Listing toolkit</h2></div><div class="tool-grid">' +
    [
      [
        "photos",
        "Listing photography",
        "Select and refine your best frames.",
        "03 / PHOTOS",
      ],
      [
        "stage",
        "Virtual staging",
        "Explore furnishings and room styles.",
        "04 / DESIGN",
      ],
      [
        "export",
        "Exposé builder",
        "Assemble your listing package.",
        "05 / EXPORT",
      ],
    ]
      .map(
        ([key, title, desc, index], i) =>
          '<button class="panel tool-card" data-page="' +
          key +
          '"><div class="art ' +
          (i === 2 ? "paper-art" : "") +
          '">' +
          previews[i] +
          '<span class="art-code">' +
          index +
          '</span></div><div class="tool-content"><h3>' +
          title +
          '</h3><span class="circle-arrow">' +
          icon("upRight", 13) +
          "</span><p>" +
          desc +
          "</p></div></button>",
      )
      .join("") +
    "</div>"
  );
}
function overview() {
  return (
    micro("Project overview") +
    heading(
      p.name,
      icon("pin", 14) +
        esc(p.address || "Address not entered") +
        '<span class="sep"></span>Apartment' +
        (p.example
          ? '<span class="sep"></span><span class="badge">Sample project</span>'
          : ""),
      btn("New scan", "new", "plus", "primary"),
    ) +
    '<div class="hero-grid">' +
    player() +
    planPanel() +
    "</div>" +
    toolkit()
  );
}
function capturePage() {
  return (
    micro("01 / Capture") +
    heading(
      "Walkthrough",
      esc(p.name),
      btn("New scan", "new", "plus", "primary"),
    ) +
    '<div class="two-col"><div class="stack">' +
    player(true) +
    '<section class="panel">' +
    panelHead(
      "Frame timeline",
      "film",
      '<span class="stamp">Click to seek</span>',
    ) +
    '<div class="timeline">' +
    (p.example ? [...p.photos].sort((a, b) => a.time - b.time) : p.frames)
      .map(
        (f) =>
          '<button data-seek="' +
          f.time +
          '"><img alt="" loading="lazy" src="' +
          esc(f.src) +
          '"><span>' +
          clock(f.time) +
          "</span></button>",
      )
      .join("") +
    '</div></section></div><div class="stack"><section class="panel">' +
    panelHead("Capture coverage", "scan") +
    '<div class="tool-form">' +
    (p.example
      ? msg(
          "This sample combines illustrated room views. Upload a continuous recording to review your own capture.",
        )
      : "<p>Review room transitions and visibility before generating a plan.</p>") +
    (p.notes.length
      ? '<ul class="note-list">' +
        p.notes.map((n) => "<li>" + esc(n) + "</li>").join("") +
        "</ul>"
      : "") +
    (p.markers || [])
      .map(
        (m) =>
          '<div class="review-line"><span>' +
          esc(m.name) +
          '</span><span class="mono">' +
          clock(m.time) +
          "</span></div>",
      )
      .join("") +
    btn("Open capture guide", "guide", "book") +
    btn(
      p.rooms.length ? "Review floor plan" : "Reconstruct floor plan",
      "plan",
      "arrow",
      "primary",
    ) +
    "</div></section></div></div>"
  );
}
function planPage() {
  return (
    micro("02 / Reconstruct") +
    heading(
      "Floor plan",
      esc(p.name),
      '<div class="actions">' +
        (!p.example
          ? (geometryReady
              ? btn(
                  "Local reconstruction",
                  "geometry-settings",
                  "scan",
                  "primary",
                )
              : "") +
            (hosted
              ? ""
              : btn(
                  "AI-assisted draft",
                  "reconstruct",
                  "stage",
                  geometryReady ? "" : "primary",
                ))
          : "") +
        (p.rooms.length
          ? btn("Download plan", "download-plan", "download")
          : "") +
        "</div>",
    ) +
    '<div class="two-col"><div class="stack">' +
    planPanel(true) +
    msg(
      p.example
        ? "The sample layout illustrates the floor-plan review. 2D and 3D share the same room and opening data."
        : p.planVerified
          ? "You marked these room dimensions as reviewed."
          : "Draft geometry is approximate. Check each room, opening and connection against the apartment.",
    ) +
    '</div><div class="stack"><section class="panel">' +
    panelHead(
      "Room schedule",
      "layers",
      '<span class="stamp">' + p.rooms.length + " spaces</span>",
    ) +
    p.rooms
      .map(
        (r, i) =>
          '<div class="list-row"><span class="room-dot" style="background:' +
          ["#e3e7d8", "#e9dfd3", "#e5e8de", "#e5dece", "#d7e4df"][i % 5] +
          '"></span><strong>' +
          esc(r.name) +
          '</strong><span class="dim end">' +
          fmt(r.w * r.h) +
          " m²</span>" +
          ib("Edit " + r.name, "room:" + r.id, "edit") +
          "</div>",
      )
      .join("") +
    '<div class="padded">' +
    btn("Add room", "room:new", "plus") +
    "</div></section>" +
    (!p.example
      ? '<div class="panel tool-form">' +
        field(
          "Reference wall",
          '<select id="scale-room">' +
            p.rooms
              .map(
                (r) =>
                  '<option value="' +
                  esc(r.id) +
                  '">' +
                  esc(r.name) +
                  " · width " +
                  fmt(r.w) +
                  " m</option>",
              )
              .join("") +
            "</select>",
        ) +
        field(
          "Measured length (metres)",
          '<input id="ref-length" type="number" step=".01" min=".1" placeholder="e.g. 4.25">',
        ) +
        btn("Scale entire plan", "calibrate", "ruler") +
        '<label class="check-field"><input id="verify" type="checkbox" ' +
        (p.planVerified ? "checked" : "") +
        "> I checked the room dimensions on site</label></div>"
      : "") +
    (p.notes.length
      ? '<section class="panel tool-form"><h3>Coverage review</h3><ul class="note-list">' +
        p.notes.map((n) => "<li>" + esc(n) + "</li>").join("") +
        "</ul></section>"
      : "") +
    "</div></div>"
  );
}
function photosPage() {
  let visible = p.photos.filter((f) => photoFilter === "all" || f.selected);
  return (
    micro("03 / Photography") +
    heading(
      "Listing photography",
      esc(p.name) + '<span class="sep"></span>' + p.photos.length + " frames",
      btn("Open exposé", "export", "arrow", "primary"),
    ) +
    '<div class="filter-row"><div class="seg"><button data-filter="all" class="' +
    (photoFilter === "all" ? "on" : "") +
    '">All frames</button><button data-filter="selected" class="' +
    (photoFilter === "selected" ? "on" : "") +
    '">Selected (' +
    p.photos.filter((f) => f.selected).length +
    ')</button></div><span class="stamp">Select images for your listing</span></div><div class="gallery">' +
    visible
      .map(
        (f) =>
          '<article class="panel"><div class="photo-thumb"><img loading="lazy" alt="' +
          esc(f.name) +
          '" src="' +
          esc(f.preview || f.src) +
          '"><button aria-label="Edit ' +
          esc(f.name) +
          '" data-act="photo:' +
          f.id +
          '">' +
          icon("settings", 14) +
          '</button><span class="photo-time">' +
          clock(f.time) +
          '</span></div><div class="photo-foot"><div><strong>' +
          esc(f.name) +
          "</strong><small>" +
          (f.adjust
            ? "Edited frame"
            : p.example
              ? "Sample photograph"
              : "Walkthrough frame") +
          '</small></div><input type="checkbox" data-select="' +
          f.id +
          '" aria-label="Include ' +
          esc(f.name) +
          ' in listing" ' +
          (f.selected ? "checked" : "") +
          "></div></article>",
      )
      .join("") +
    "</div>" +
    (visible.length
      ? ""
      : msg("No frames selected. Choose All frames to add photographs."))
  );
}
function stagedPhoto() {
  return p.photos.find((f) => f.id === stageId) || p.photos[0];
}
function stageView(f) {
  const saved = p.staged?.[f.id];
  if (saved?.style === style) return saved.src;
  if (p.example && f.id === "living") {
    if (style === "Scandinavian") return asset("living.jpg");
    if (style === "Modern") return asset("modern.jpg");
  }
  return null;
}
function stagePage() {
  const f = stagedPhoto();
  if (!f)
    return (
      micro("04 / Design") +
      heading("Virtual staging", esc(p.name)) +
      msg("Import a walkthrough to select a frame.")
    );
  const result = stageView(f),
    before = p.example && f.id === "living" ? asset("empty.jpg") : f.src;
  return (
    micro("04 / Design") +
    heading("Virtual staging", esc(p.name)) +
    '<div class="two-col"><section class="panel">' +
    panelHead(
      f.name,
      "stage",
      result
        ? '<span class="badge">Virtually staged</span>'
        : '<span class="stamp">Source frame</span>',
    ) +
    '<div class="stage-preview" style="--cut:43%"><img src="' +
    esc(result || before) +
    '" alt="' +
    esc(result ? style + " virtual staging" : "Original room frame") +
    '">' +
    (result
      ? '<img class="base" src="' +
        esc(before) +
        '" alt="Original room"><div class="compare-line"><span>‹ ›</span></div><span class="compare-label before-label">Original</span><span class="compare-label after-label">' +
        esc(style) +
        '</span><input type="range" id="compare" aria-label="Compare original and staged room" min="0" max="100" value="43">'
      : "") +
    '</div><div class="card-foot">' +
    icon(result ? "layers" : "image", 14) +
    (result
      ? "Drag to compare the original and the staged view."
      : "Select a style and generate a staged view.") +
    '</div></section><section class="panel tool-form"><h3>Design settings</h3>' +
    field(
      "Source photograph",
      '<select id="stage-photo">' +
        p.photos
          .map(
            (photo) =>
              '<option value="' +
              photo.id +
              '" ' +
              (photo.id === f.id ? "selected" : "") +
              ">" +
              esc(photo.name) +
              "</option>",
          )
          .join("") +
        "</select>",
    ) +
    '<div class="field">Interior style<div class="style-list">' +
    Object.entries(styles)
      .map(
        ([name, sw]) =>
          '<button data-style="' +
          name +
          '" class="style-tile ' +
          (style === name ? "on" : "") +
          '"><span class="swatches">' +
          sw.map((c) => '<i style="background:' + c + '"></i>').join("") +
          "</span>" +
          name +
          "</button>",
      )
      .join("") +
    "</div></div>" +
    (result
      ? p.staged[f.id]?.use && p.staged[f.id]?.style === style
        ? btn("Use original in exposé", "use-original", "image")
        : btn("Use in exposé", "use-stage", "check", "primary")
      : btn("Generate staged view", "generate-stage", "stage", "primary")) +
    btn("Stage selected photos", "batch-stage", "layers") +
    (p.example
      ? "<p>Two prebuilt living-room styles are included. Additional views use the connected AI service.</p>"
      : "<p>Frames assigned to the same room use its existing staged view as a furniture reference.</p>") +
    "</section></div>"
  );
}
function exportPage() {
  const cover = p.photos.find((f) => f.selected),
    st = cover && p.staged?.[cover.id];
  return (
    micro("05 / Publish") +
    heading("Exposé builder", esc(p.name)) +
    '<div class="two-col"><div class="panel">' +
    panelHead(
      "Document preview",
      "doc",
      '<span class="stamp">A4 · PDF</span>',
    ) +
    '<div class="pages-preview"><div class="expose-sheet"><small>' +
    esc(p.brand || "Raumscan Studio") +
    "</small><hr><h2>" +
    esc(p.name) +
    "</h2><small>" +
    esc(p.address) +
    "</small>" +
    (cover
      ? '<img alt="Exposé cover" src="' +
        esc(st?.use ? st.src : cover.preview || cover.src) +
        '">'
      : "") +
    "<p>" +
    esc(descriptionFor(p)) +
    "</p><footer><span>" +
    esc(p.example ? "SAMPLE PROPERTY" : p.purpose.toUpperCase()) +
    '</span><span>01</span></footer></div></div></div><div class="panel tool-form"><h3>Listing details</h3><form id="export-form" class="form-grid">' +
    field(
      "Agency / brand",
      '<input maxlength="80" name="brand" value="' + esc(p.brand || "") + '">',
    ) +
    '<div class="fields">' +
    field(
      "Listing language",
      '<select name="lang"><option value="de" ' +
        (p.language === "de" ? "selected" : "") +
        '>Deutsch</option><option value="en" ' +
        (p.language === "en" ? "selected" : "") +
        ">English</option></select>",
    ) +
    field(
      "Offer type",
      '<select name="purpose"><option ' +
        (p.purpose === "Sale" ? "selected" : "") +
        ">Sale</option><option " +
        (p.purpose === "Rent" ? "selected" : "") +
        ">Rent</option></select>",
    ) +
    "</div>" +
    field(
      "Property description",
      '<textarea maxlength="4000" name="description" rows="5">' +
        esc(descriptionFor(p)) +
        "</textarea>",
    ) +
    '<button type="button" class="text-btn" data-act="draft">Generate description ' +
    icon("rotate", 13) +
    '</button><button class="btn" type="submit">' +
    icon("check", 15) +
    'Save listing details</button></form><hr style="border:0;border-top:1px solid var(--line);width:100%;margin:1px 0"><div class="stamp">' +
    p.photos.filter((f) => f.selected).length +
    " photos · " +
    (p.rooms.length ? "Floor plan included" : "No floor plan") +
    "</div>" +
    btn("Download exposé PDF", "pdf", "pdf", "primary") +
    btn("Export listing ZIP", "zip", "download") +
    "<p>ZIP includes JPEGs, listing text, the PDF and your available floor plan for manual upload to ImmoScout24 or Immowelt.</p></div></div>"
  );
}
function render() {
  const old = $("#source-video");
  if (old) old.pause();
  rail();
  bar();
  $("#content").innerHTML = (
    {
      overview,
      capture: capturePage,
      plan: planPage,
      photos: photosPage,
      stage: stagePage,
      export: exportPage,
    }[page] || overview
  )();
  wireView();
}
function go(k) {
  if (!pages.some((x) => x[0] === k)) return;
  document.body.classList.remove("rail-open");
  page = k;
  history.replaceState(null, "", "#" + k);
  render();
  window.scrollTo(0, 0);
}
async function wireView() {
  const v = $("#source-video");
  if (v) {
    const id = p.id;
    try {
      const url = await videoSource(p);
      if (!v.isConnected || id !== p.id) return;
      if (url) v.src = url;
      v.addEventListener("play", () => {
        v.parentElement.classList.add("playing");
        $(".play-big").hidden = true;
        $(".play-big").style.display = "none";
        $("#small-play").innerHTML = icon("pause", 14);
      });
      v.addEventListener("pause", () => {
        if (!v.isConnected) return;
        v.parentElement.classList.remove("playing");
        $(".play-big").style.display = "grid";
        $("#small-play").innerHTML = icon("play", 14);
      });
      v.addEventListener("timeupdate", () => {
        if (!v.isConnected) return;
        $("#video-time").textContent =
          clock(v.currentTime) + " / " + clock(p.duration);
        $("#seek").value = String((1000 * v.currentTime) / p.duration);
      });
      $("#seek").oninput = (e) => {
        v.currentTime = (+e.target.value / 1000) * p.duration;
      };
    } catch {
      toast("The original video is unavailable in this browser session.");
    }
  }
  if ($("#rotate"))
    $("#rotate").oninput = (e) => {
      angle = +e.target.value;
      $(".drawing").innerHTML = floorSVG(p, "3d", angle);
    };
  if ($("#compare"))
    $("#compare").oninput = (e) =>
      $(".stage-preview").style.setProperty("--cut", e.target.value + "%");
  if ($("#stage-photo"))
    $("#stage-photo").onchange = (e) => {
      stageId = e.target.value;
      render();
    };
  if ($("#verify"))
    $("#verify").onchange = (e) => {
      if (!p.rooms.length) {
        e.target.checked = false;
        return;
      }
      p.planVerified = e.target.checked;
      save();
      render();
    };
  if ($("#export-form")) {
    const form = $("#export-form");
    form.onsubmit = (e) => {
      e.preventDefault();
      readListing();
      save();
      render();
      toast("Listing details saved.");
    };
    form.elements.lang.onchange = () => draftDescription();
    form.elements.purpose.onchange = () => draftDescription();
  }
}
function readListing() {
  const form = $("#export-form");
  if (!form) return;
  const d = new FormData(form);
  p.brand = d.get("brand").trim();
  p.language = d.get("lang");
  p.purpose = d.get("purpose");
  p.description = d.get("description").trim();
}
function draftDescription() {
  readListing();
  p.description = "";
  $("#export-form").elements.description.value = descriptionFor(p);
}
function modal(title, html, cleanup) {
  if (modalCleanup) {
    modalCleanup();
    modalCleanup = null;
  }
  modalCleanup = cleanup || null;
  $("#modal-body").innerHTML =
    '<div class="modal-head"><h2>' +
    esc(title) +
    "</h2>" +
    ib("Close dialog", "close", "close") +
    "</div>" +
    html;
  const d = $("#modal");
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
function closeModal() {
  if (busy) return;
  $("#modal").close();
}
$("#modal").addEventListener("close", () => {
  if (modalCleanup) {
    modalCleanup();
    modalCleanup = null;
  }
  if (importing) cancelImport = true;
});
$("#modal").addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
function fail(e) {
  busy = false;
  toast(e.message || String(e));
  if ($("#operation-error"))
    $("#operation-error").textContent = e.message || String(e);
}
function guide() {
  modal(
    "Capture the apartment",
    '<p class="sub">Record one continuous 5–10 minute walkthrough. Keep the rear camera facing the apartment.</p>' +
      [
        [
          "Start at the entrance",
          "Show the front door and the adjoining hallway. Hold the phone level at chest height.",
        ],
        [
          "Trace each room",
          "Walk slowly around the perimeter. Pan from floor to ceiling and show every wall, corner and window.",
        ],
        [
          "Connect the rooms",
          "Walk through each doorway on camera. Return through the same doorway before moving to the next room.",
        ],
        [
          "Check coverage",
          "Mark each room in guided capture. Revisit dark or incomplete areas and measure one visible wall for scale.",
        ],
      ]
        .map(
          ([h, d], i) =>
            '<div class="guide-step"><b>0' +
            (i + 1) +
            "</b><div><h4>" +
            h +
            "</h4><p>" +
            d +
            "</p></div></div>",
        )
        .join("") +
      '<div class="form-footer">' +
      btn("Start a scan", "new", "plus", "primary") +
      "</div>",
  );
}
async function projects() {
  if (hosted) return listCloud();
  let list = [];
  try {
    list = await dbOp("projects", "readonly", (s) => s.getAll());
  } catch {}
  if (!list.some((x) => x.id === "sample")) list.unshift(demoProject());
  if (!list.some((x) => x.id === p.id)) list.push(p);
  modal(
    "Your projects",
    '<div class="projects-list">' +
      list
        .map(
          (x) =>
            '<button data-project="' +
            esc(x.id) +
            '">' +
            icon("building", 20) +
            "<span><b>" +
            esc(x.name) +
            "</b><small>" +
            esc(
              x.example ? "Illustrated sample" : x.address || "Local project",
            ) +
            "</small></span>" +
            (x.id === p.id ? icon("check", 16) : "") +
            "</button>",
        )
        .join("") +
      '</div><div class="form-footer">' +
      btn("New scan", "new", "plus", "primary") +
      "</div>",
  );
}
let draftName = "",
  draftAddress = "";
function newScan(reset = true) {
  if (hosted && !cloudUser) {
    workspaceDialog(() => newScan(reset));
    return;
  }
  if (reset) {
    chosenFile = null;
    markers = [];
    draftName = "";
    draftAddress = "";
  }
  modal(
    "New apartment scan",
    '<form id="new-project" class="form-grid">' +
      field(
        "Property name",
        '<input required maxlength="90" id="property-name" placeholder="e.g. Mitte apartment" value="' +
          esc(draftName) +
          '">',
      ) +
      field(
        "Address or neighbourhood",
        '<input id="property-address" maxlength="160" placeholder="e.g. Mitte, Berlin" value="' +
          esc(draftAddress) +
          '">',
      ) +
      '<input type="file" id="video-file" accept="video/*,.mov,.mp4,.webm" class="visually-hidden" tabindex="-1"><button type="button" class="drop" id="drop">' +
      icon("upload", 25) +
      '<b id="file-name">' +
      (chosenFile ? esc(chosenFile.name) : "Choose a walkthrough video") +
      "</b><small>Drop a video here · MP4, MOV or WebM" +
      (hosted ? " · up to 384 MiB" : "") +
      '</small></button><button type="button" class="text-btn" data-act="test-video">Use a two-room test recording ↗</button><button type="button" class="btn" data-act="record">' +
      icon("video", 16) +
      'Record a guided walkthrough</button><div class="info">' +
      icon("scan", 16) +
      '<span>Start at the entrance, show every corner, and keep recording as you pass through each doorway.</span></div><div id="operation-error" role="alert" class="app-error"></div><div class="form-footer"><button type="submit" class="btn primary">' +
      icon("film", 16) +
      (hosted
        ? "Upload & reconstruct"
        : geometryReady
          ? "Import & reconstruct"
          : "Import walkthrough") +
      "</button></div></form>",
  );
  const pick = (f) => {
    if (!f) return;
    if (
      !f.type.startsWith("video/") &&
      !/\.(mp4|mov|webm|m4v)$/i.test(f.name)
    ) {
      toast("Choose a video file.");
      return;
    }
    chosenFile = f;
    markers = [];
    $("#file-name").textContent = f.name;
    if (!$("#property-name").value)
      $("#property-name").value = f.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ");
  };
  $("#drop").onclick = () => $("#video-file").click();
  $("#video-file").onchange = (e) => pick(e.target.files[0]);
  $("#drop").ondragover = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag");
  };
  $("#drop").ondragleave = (e) => e.currentTarget.classList.remove("drag");
  $("#drop").ondrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag");
    pick(e.dataTransfer.files[0]);
  };
  $("#new-project").onsubmit = (e) => {
    e.preventDefault();
    if (!chosenFile) {
      $("#operation-error").textContent =
        "Choose or record a walkthrough first.";
      return;
    }
    draftName = $("#property-name").value.trim();
    draftAddress = $("#property-address").value.trim();
    if (!draftName) {
      $("#operation-error").textContent = "Enter a property name.";
      return;
    }
    importFile().catch(fail);
  };
}
async function importFile() {
  const file = chosenFile;
  if (!file) return;
  if (hosted) return uploadCloud(file, draftName, draftAddress, markers);
  const id = uid();
  cancelImport = false;
  importing = true;
  modal(
    "Reading your walkthrough",
    '<div class="form-grid"><p class="sub">Finding sharp, well-lit frames across the full recording.</p><div class="progress"><span id="progress-value" style="width:0%"></span></div><p class="busy-line" id="progress-text">Opening video…</p><div class="app-error" id="operation-error"></div></div>',
  );
  let extracted;
  try {
    extracted = await extractVideo(
      file,
      (pct, txt) => {
        if ($("#progress-value"))
          $("#progress-value").style.width = pct * 100 + "%";
        if ($("#progress-text")) $("#progress-text").textContent = txt;
      },
      () => cancelImport,
    );
  } catch (e) {
    if (!cancelImport) {
      importing = false;
      newScan(false);
      fail(e);
    }
    return;
  } finally {
    importing = false;
  }
  if (cancelImport) return;
  const roomNotes = markers
    .filter((m) => m.missing?.length)
    .map((m) => m.name + " still needs " + m.missing.join(", ") + ".");
  p = {
    id,
    name: draftName,
    address: draftAddress,
    example: false,
    footage: file.name,
    ...extracted,
    markers,
    rooms: [],
    staged: {},
    notes: [...extracted.notes, ...roomNotes],
    brand: "",
    language: "de",
    purpose: "Sale",
    description: "",
    planVerified: false,
    planSource: "",
  };
  memoryVideos.set(id, file);
  try {
    await dbOp("videos", "readwrite", (s) => s.put(file, id));
  } catch {
    toast("Video is available for this session. Device storage is full.");
  }
  await save();
  chosenFile = null;
  markers = [];
  closeModal();
  go("plan");
  if (geometryReady) {
    await runGeometry(false);
  } else if (connected) {
    reconstructDialog();
  } else {
    toast(
      "Frames are ready. Start the local scan engine or connect AI to generate a layout.",
    );
  }
}
function stopCapture() {
  if (!capture) return;
  const current = capture;
  capture = null;
  clearInterval(current.timer);
  if (current.rec?.state === "recording") current.rec.stop();
  current.stream.getTracks().forEach((t) => t.stop());
}
const captureChecks = ["Doorway", "All corners", "Windows"];
async function recordDialog() {
  draftName = $("#property-name")?.value.trim() || draftName;
  draftAddress = $("#property-address")?.value.trim() || draftAddress;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    modal(
      "Record a walkthrough",
      msg(
        "In-browser recording requires a supported browser on localhost or HTTPS. Record with your phone camera, then choose that video here.",
      ) +
        '<div class="form-footer">' +
        btn("Choose a video", "back-new", "upload") +
        "</div>",
    );
    return;
  }
  modal(
    "Guided walkthrough",
    '<p class="sub">Allow the rear camera to begin. Audio is off.</p><div id="operation-error" class="app-error"></div>' +
      btn("Back to upload", "back-new", "upload"),
  );
  const target = $("#modal-body").firstChild;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  } catch {
    throw Error(
      "Camera access is unavailable. Use your camera app and import the recorded video.",
    );
  }
  if (!$("#modal").open || !target.isConnected) {
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  const recType = ["video/mp4", "video/webm;codecs=vp8", "video/webm"].find(
    (t) => MediaRecorder.isTypeSupported(t),
  );
  let rec;
  try {
    rec = new MediaRecorder(stream, recType ? { mimeType: recType } : {});
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const chunks = [],
    state = {
      stream,
      rec,
      checks: new Set(),
      marks: [],
      start: Date.now(),
      roomStart: 0,
      timer: null,
      finish: false,
    };
  capture = state;
  modal(
    "Guided walkthrough",
    '<div class="form-grid"><div class="record-stage"><video id="live" muted autoplay playsinline></video><span class="capture-tag"><i></i><span id="elapsed">REC 0:00</span></span></div><div class="capture-hints" id="hints">Start at the front door. Pan slowly across the entrance.</div>' +
      field(
        "Current room",
        '<input id="live-room" maxlength="55" value="Entrance">',
      ) +
      '<div class="field">Mark the areas you have filmed<div class="progress-list">' +
      captureChecks
        .map((c) => '<button data-check="' + c + '">' + c + "</button>")
        .join("") +
      '</div></div><div class="actions">' +
      btn("Next room", "next-room", "plus") +
      btn("Finish recording", "finish-record", "check", "primary") +
      "</div></div>",
    () => stopCapture(),
  );
  $("#live").srcObject = stream;
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    if (!state.finish) return;
    const mime = rec.mimeType || "video/webm",
      blob = new Blob(chunks, { type: mime });
    chosenFile = new File(
      [blob],
      "Apartment walkthrough." + (mime.includes("mp4") ? "mp4" : "webm"),
      { type: mime },
    );
    markers = state.marks;
    newScan(false);
  };
  rec.start(500);
  state.timer = setInterval(() => {
    if (!$("#live")) return;
    $("#elapsed").textContent =
      "REC " + clock((Date.now() - state.start) / 1000);
    if (!$("#live").videoWidth) return;
    const stats = frameStats($("#live")),
      missing = captureChecks.filter((x) => !state.checks.has(x));
    $("#hints").textContent =
      stats.lum < 45
        ? "Low light. Turn on a light and repeat this section."
        : stats.edge < 2.8
          ? "Few clear edges. Hold still and show the wall junctions."
          : missing.length
            ? "Still to capture in this room: " +
              missing.join(", ").toLowerCase() +
              "."
            : "Room checklist complete. Walk through the doorway to the next room.";
  }, 1000);
}
function markRoom(finish) {
  if (!capture) return;
  const state = capture,
    time = (Date.now() - state.start) / 1000;
  state.marks.push({
    name: $("#live-room").value.trim() || "Room " + (state.marks.length + 1),
    time: state.roomStart,
    end: time,
    missing: captureChecks.filter((x) => !state.checks.has(x)),
  });
  state.roomStart = time;
  if (finish) {
    state.finish = true;
    stopCapture();
  } else {
    state.checks.clear();
    $("#live-room").value = "Room " + (state.marks.length + 1);
    $$("[data-check]").forEach((x) => x.classList.remove("done"));
    toast("Room marker saved. Keep filming through the doorway.");
  }
}
async function connectionStatus() {
  if (hosted) {
    try {
      const status = await cloudAPI("status");
      processorOnline = status.geometry;
      return status.staging;
    } catch {
      return false;
    }
  }
  if (location.protocol === "file:") return false;
  try {
    const r = await fetch("/api/status", { cache: "no-store" });
    if (!r.ok) return false;
    const status = await r.json();
    geometryReady = status.geometry === true;
    return status.connected === true;
  } catch {
    return false;
  }
}
function connectDialog() {
  if (hosted) {
    modal(
      "Studio services",
      '<div class="form-grid">' +
        msg(
          processorOnline
            ? "The scan processor is online."
            : "Walkthroughs are queued in your workspace until the scan processor is online.",
        ) +
        msg(
          connected
            ? "Virtual staging is available for your photographs."
            : "Virtual staging is in preview. The sample includes two furnished views. Generating new views requires the studio owner to connect an image provider.",
        ) +
        "</div>",
    );
    return;
  }
  const local =
    location.protocol !== "file:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
  modal(
    "AI connection",
    '<div class="form-grid">' +
      (connected
        ? msg(
            "The local server has an AI connection. Reconstruction and virtual staging are available.",
          )
        : local
          ? '<p class="sub">Connect OpenAI to generate a draft layout from chronological video frames and stage your own rooms. Requests use your API account.</p><form id="key-form" class="form-grid">' +
            field(
              "OpenAI API key",
              '<input name="key" type="password" autocomplete="off" required placeholder="sk-…">',
            ) +
            '<small class="stamp">Held in memory by this local server.</small><button class="btn primary" type="submit">Connect for this session</button></form>'
          : msg(
              "Open Start Raumscan.command in the prototype folder to run the local AI service. Then connect your API account in this panel.",
            )) +
      '<div id="operation-error" class="app-error"></div></div>',
  );
  if ($("#key-form"))
    $("#key-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await postAI("connect", { key: new FormData(e.target).get("key") });
        connected = true;
        connectDialog();
        toast("API key set for this server session.");
      } catch (err) {
        fail(err);
      }
    };
}
function reconstructDialog() {
  if (!connected) {
    connectDialog();
    return;
  }
  if (!p.frames.length) {
    toast("Import a walkthrough to reconstruct its layout.");
    return;
  }
  modal(
    "Reconstruct apartment layout",
    '<div class="form-grid"><p class="sub">Send up to 60 time-ordered frames from this walkthrough to OpenAI. The model will infer observed rooms, approximate proportions, doors and windows, and flag uncertain connections.</p>' +
      msg(
        "The result is a rectangular-room draft. A measured wall establishes scale. Unseen spaces and hidden openings need an on-site check.",
      ) +
      (p.rooms.length
        ? msg(
            "Generating a new draft will replace the current room geometry.",
            "warning",
          )
        : "") +
      '<div class="form-footer">' +
      btn("Generate draft plan", "run-reconstruct", "scan", "primary") +
      "</div></div>",
  );
}
function operation(title, message) {
  busy = true;
  modal(
    title,
    '<p class="sub" id="op-status">' +
      esc(message) +
      '</p><div class="app-error" id="operation-error"></div>',
  );
  $("#modal-body .icon-btn").disabled = true;
}
function operationError(e) {
  busy = false;
  $("#modal-body .icon-btn").disabled = false;
  if ($("#op-status"))
    $("#op-status").textContent = "The operation could not be completed.";
  fail(e);
}
async function reconstruct() {
  operation("Reconstructing floor plan", "Preparing the walkthrough frames…");
  try {
    let frames = [];
    for (const f of p.frames) {
      frames.push({ t: +f.time.toFixed(2), src: await tinyImage(f.src) });
    }
    $("#op-status").textContent =
      "Reviewing room transitions, visible walls and openings…";
    const result = await postAI("reconstruct", {
      frames,
      markers: p.markers || [],
      duration: p.duration,
    });
    if (!result.rooms?.length)
      throw Error(
        "Too little layout evidence. Check the coverage notes or film a slower pass. " +
          (result.notes || []).join(" "),
      );
    p.rooms = result.rooms;
    p.notes = [...new Set([...(p.notes || []), ...result.notes])];
    p.planVerified = false;
    p.planSource = "Video-inferred draft";
    for (const f of p.photos) {
      const match = (result.views || []).find(
        (x) => f.time >= x.start && f.time < x.end,
      );
      const room = p.rooms.find((r) => r.id === match?.room);
      if (room) {
        f.room = room.id;
        f.name = room.name;
      }
    }
    p.description = "";
    await save();
    busy = false;
    closeModal();
    go("plan");
    toast("Draft layout ready. Review the room geometry and scale.");
  } catch (e) {
    operationError(e);
  }
}
function geometrySettings() {
  modal(
    "Local reconstruction",
    '<div class="form-grid"><p class="sub">Match visual features across the recording, recover camera positions and fit rectangular rooms to observed walls. The video is processed on this computer.</p><div class="fields">' +
      field(
        "Camera height (m)",
        '<input id="camera-height" type="number" min=".5" max="2.7" step=".01" value="1.5">',
      ) +
      field(
        "Horizontal field of view (°)",
        '<input id="camera-fov" type="number" min="30" max="120" value="68">',
      ) +
      "</div>" +
      msg(
        "Use the main camera at 1×. Verify the estimated scale against a measured wall. Review proposed doors and windows against the footage.",
      ) +
      (p.rooms.length
        ? msg("This will replace the current room geometry.", "warning")
        : "") +
      '<div class="form-footer">' +
      btn("Reconstruct locally", "run-geometry", "scan", "primary") +
      "</div></div>",
  );
}
async function runGeometry(fromSettings) {
  const height = fromSettings ? Number($("#camera-height").value) : 1.5,
    fov = fromSettings ? Number($("#camera-fov").value) : 68;
  if (!(height >= 0.5 && height <= 2.7 && fov >= 30 && fov <= 120)) {
    toast("Enter a camera height of 0.5–2.7 m and a field of view of 30–120°.");
    return;
  }
  operation(
    "Reconstructing your apartment",
    "Opening the original walkthrough on the local scan engine…",
  );
  try {
    const blob = memoryVideos.get(p.id) || (await getVideo(p.id));
    if (!blob)
      throw Error(
        "The original walkthrough is unavailable. Reimport the video.",
      );
    const res = await fetch("/api/geometry", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Scan-Height": String(height),
        "X-Scan-Fov": String(fov),
      },
      body: blob,
    });
    if (!res.ok) {
      const j = await res.json();
      throw Error(j.error || "Local reconstruction failed.");
    }
    const reader = res.body.getReader(),
      decoder = new TextDecoder();
    let pending = "",
      result = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.error) throw Error(event.error);
        if (event.result) result = event.result;
        else
          $("#op-status").textContent =
            event.phase +
            " · " +
            event.percent +
            "% · " +
            event.positions +
            " camera positions";
      }
    }
    if (!result?.rooms?.length)
      throw Error(
        "Insufficient geometry to enclose a room. Review the capture coverage.",
      );
    p.rooms = result.rooms;
    p.notes = [...new Set([...p.notes, ...result.notes])];
    p.planSource = "Local multiview reconstruction";
    p.planVerified = false;
    p.description = "";
    for (const f of p.photos) {
      const interval = result.views.find(
        (v) => v.start <= f.time && v.end > f.time,
      );
      const room = p.rooms.find((r) => r.id === interval?.room);
      if (room) {
        f.room = room.id;
        f.name = room.name;
      }
    }
    await save();
    busy = false;
    closeModal();
    go("plan");
    toast(
      "Recovered " +
        p.rooms.length +
        " room" +
        (p.rooms.length === 1 ? "" : "s") +
        ". Check the model against the apartment.",
    );
  } catch (e) {
    busy = false;
    p.notes = [...new Set([...p.notes, e.message])];
    await save();
    modal(
      "Scan needs review",
      '<div class="form-grid">' +
        msg(e.message, "warning") +
        '<p class="sub">Your source video and selected frames are saved. Review the footage, add measured rooms, or request an AI-assisted draft.</p><div class="actions">' +
        btn("Review floor plan", "dismiss-plan", "plan", "primary") +
        btn("AI-assisted draft", "reconstruct", "stage") +
        "</div></div>",
    );
  }
}
function editRoom(id) {
  const isNew = id === "new",
    r = isNew
      ? {
          id: uid(),
          name: "",
          x: p.rooms.length ? Math.max(...p.rooms.map((q) => q.x + q.w)) : 0,
          y: 0,
          w: 4,
          h: 3,
          openings: [],
        }
      : p.rooms.find((q) => q.id === id);
  if (!r) return;
  const number = (l, k, v, min) =>
    field(
      l,
      '<input required name="' +
        k +
        '" type="number" step=".01" min="' +
        min +
        '" max="1000" value="' +
        Number(v).toFixed(2) +
        '">',
    );
  modal(
    isNew ? "Add measured room" : "Edit room",
    '<form class="form-grid" id="room-form">' +
      field(
        "Room name",
        '<input required name="name" maxlength="50" value="' +
          esc(r.name) +
          '" placeholder="e.g. Living room">',
      ) +
      '<div class="fields">' +
      number("Width (m)", "w", r.w, 0.2) +
      number("Depth (m)", "h", r.h, 0.2) +
      number("Left position (m)", "x", r.x, -1000) +
      number("Top position (m)", "y", r.y, -1000) +
      '</div><div class="field">Doors and windows<div id="openings"></div></div>' +
      btn("Add an opening", "add-opening", "plus") +
      '<div id="operation-error" class="app-error"></div><div class="form-footer">' +
      (!isNew ? btn("Remove room", "remove-room:" + r.id, "trash") : "") +
      '<button class="btn primary" type="submit">Save room</button></div></form>',
  );
  function add(o) {
    const row = document.createElement("div");
    row.className = "opening-row";
    row.style =
      "display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 22px;gap:4px;margin:6px 0;align-items:end";
    row.innerHTML =
      field(
        "Type",
        '<select name="kind"><option>door</option><option>window</option></select>',
      ) +
      field(
        "Wall",
        '<select name="side">' +
          ["N", "E", "S", "W"]
            .map(
              (d, i) =>
                '<option value="' +
                d +
                '">' +
                ["Top", "Right", "Bottom", "Left"][i] +
                "</option>",
            )
            .join("") +
          "</select>",
      ) +
      number("Start (m)", "at", o.at, 0) +
      number("Span (m)", "width", o.width, 0.1) +
      '<button aria-label="Remove opening" type="button" class="text-btn">' +
      icon("close", 15) +
      "</button>";
    row.querySelector('[name="kind"]').value = o.kind;
    row.querySelector('[name="side"]').value = o.side;
    row.querySelector("button").onclick = () => row.remove();
    $("#openings").append(row);
  }
  r.openings.forEach(add);
  $('[data-act="add-opening"]').onclick = () =>
    add(opening("door", "N", 0, 0.85));
  $("#room-form").onsubmit = (e) => {
    e.preventDefault();
    const d = new FormData(e.target),
      next = {
        ...r,
        name: d.get("name").trim(),
        w: +d.get("w"),
        h: +d.get("h"),
        x: +d.get("x"),
        y: +d.get("y"),
        openings: [],
      };
    if (!next.name) {
      fail(Error("Enter a room name."));
      return;
    }
    for (const row of $$(".opening-row")) {
      const val = (n) => row.querySelector('[name="' + n + '"]').value;
      const o = {
        kind: val("kind"),
        side: val("side"),
        at: +val("at"),
        width: +val("width"),
      };
      if (o.at + o.width > ("NS".includes(o.side) ? next.w : next.h) + 0.001) {
        fail(
          Error("An opening extends past its wall. Adjust its start or span."),
        );
        return;
      }
      next.openings.push(o);
    }
    if (
      p.rooms.some(
        (q) =>
          q.id !== r.id &&
          Math.min(q.x + q.w, next.x + next.w) - Math.max(q.x, next.x) >
            0.015 &&
          Math.min(q.y + q.h, next.y + next.h) - Math.max(q.y, next.y) > 0.015,
      )
    ) {
      fail(
        Error("This room overlaps another room. Adjust its position or size."),
      );
      return;
    }
    if (isNew) p.rooms.push(next);
    else p.rooms = p.rooms.map((q) => (q.id === r.id ? next : q));
    p.planVerified = false;
    p.description = "";
    save();
    closeModal();
    render();
  };
}
function calibrate() {
  const r = p.rooms.find((x) => x.id === $("#scale-room")?.value),
    n = Number($("#ref-length")?.value);
  if (!r || !Number.isFinite(n) || n < 0.1 || n > 150) {
    toast(
      "Choose a room and enter its measured wall length, from 0.1 to 150 m.",
    );
    return;
  }
  const scale = n / r.w;
  for (const room of p.rooms) {
    for (const k of ["x", "y", "w", "h"]) room[k] *= scale;
    for (const o of room.openings) {
      o.at *= scale;
      o.width *= scale;
    }
  }
  p.planVerified = false;
  p.description = "";
  save();
  render();
  toast("Applied the reference length to the complete plan.");
}
async function editPhoto(id) {
  const f = p.photos.find((v) => v.id === id);
  if (!f) return;
  const adjust = { ...defaultAdjust(), ...f.adjust };
  modal(
    "Refine photograph",
    '<form id="photo-editor" class="form-grid"><img class="preview-shot" id="adjust-preview" alt="Photograph preview" src="' +
      esc(f.preview || f.src) +
      '">' +
      field(
        "Photo caption",
        '<input required maxlength="80" name="name" value="' +
          esc(f.name) +
          '">',
      ) +
      field(
        "Assign to room",
        '<select name="room"><option value="">Unassigned</option>' +
          p.rooms
            .map(
              (r) =>
                '<option value="' +
                esc(r.id) +
                '" ' +
                (r.id === f.room ? "selected" : "") +
                ">" +
                esc(r.name) +
                "</option>",
            )
            .join("") +
          "</select>",
      ) +
      '<label class="check-field"><input type="checkbox" name="enhance" ' +
      (adjust.enhance ? "checked" : "") +
      '> Auto exposure, white balance and sharpening</label><div class="fields">' +
      field(
        "Vertical perspective",
        '<input name="vertical" type="range" min="-16" max="16" step="1" value="' +
          adjust.vertical +
          '">',
      ) +
      field(
        "Level horizon",
        '<input name="roll" type="range" min="-8" max="8" step=".25" value="' +
          adjust.roll +
          '">',
      ) +
      '</div><div class="form-footer">' +
      btn("Download JPEG", "jpg:" + f.id, "download") +
      '<button type="submit" class="btn primary">Save photo</button></div></form>',
  );
  const form = $("#photo-editor"),
    opts = () => ({
      enhance: form.elements.enhance.checked,
      vertical: +form.elements.vertical.value,
      roll: +form.elements.roll.value,
    });
  const preview = async () => {
    const token = ++previewSerial,
      url = await processPhoto(f.src, opts(), 850);
    if (token === previewSerial && $("#adjust-preview"))
      $("#adjust-preview").src = url;
  };
  let timer;
  form.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => preview().catch(fail), 100);
  };
  preview().catch(fail);
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const edited = opts(),
        url = await processPhoto(f.src, edited, 750);
      f.name = form.elements.name.value.trim() || f.name;
      f.room = form.elements.room.value;
      f.adjust = edited;
      f.preview = url;
      await save();
      closeModal();
      render();
    } catch (err) {
      fail(err);
    }
  };
  $('[data-act="jpg:' + f.id + '"]').onclick = async () => {
    try {
      downloadBlob(
        new Blob([await asBytes(await processPhoto(f.src, opts()))], {
          type: "image/jpeg",
        }),
        safeName(f.name) + ".jpg",
      );
    } catch (err) {
      fail(err);
    }
  };
}
async function stageGenerate() {
  if (!connected) {
    connectDialog();
    return;
  }
  const f = stagedPhoto();
  if (!f) return;
  modal(
    "Generate staged view",
    '<div class="form-grid"><p class="sub">Send this photograph to OpenAI to furnish it in the ' +
      esc(style) +
      " style. The studio reuses any saved furniture reference for the same room and style.</p>" +
      msg(
        "Review all furniture positions and architectural details before including the result in your listing.",
      ) +
      '<div class="form-footer">' +
      btn("Generate image", "run-stage", "stage", "primary") +
      "</div></div>",
  );
}
async function runStage() {
  const f = stagedPhoto();
  operation(
    "Furnishing the room",
    "Generating a staged image using your room photograph…",
  );
  try {
    const same = p.photos.find(
        (v) => v.room && v.room === f.room && p.staged?.[v.id]?.style === style,
      ),
      ref = same ? p.staged[same.id].src : null;
    const data = await postAI("stage", {
      style,
      image: await tinyImage(
        p.example && f.id === "living" ? asset("empty.jpg") : f.src,
        1536,
      ),
      reference: ref ? await tinyImage(ref, 1024) : null,
      room: p.rooms.find((r) => r.id === f.room)?.name || f.name,
    });
    p.staged[f.id] = { style, src: data.image, use: false };
    await save();
    busy = false;
    closeModal();
    render();
  } catch (e) {
    operationError(e);
  }
}
function batchStageDialog() {
  const chosen = p.photos.filter((f) => f.selected);
  if (!chosen.length) {
    toast("Select photographs in Photography first.");
    return;
  }
  if (!connected) {
    connectDialog();
    return;
  }
  const count = chosen.filter(
    (f) => p.staged[f.id]?.style !== style && !stageView(f),
  ).length;
  modal(
    "Stage selected photographs",
    '<div class="form-grid"><p class="sub">Apply ' +
      esc(style) +
      " furnishings across " +
      chosen.length +
      " selected photographs. Each room uses its own furniture reference across views.</p>" +
      msg(
        count +
          " new image edits will use your connected OpenAI account. Existing views in this style are reused. Completed images are saved as each one finishes.",
      ) +
      '<div class="form-footer">' +
      btn("Stage selected photographs", "run-batch", "stage", "primary") +
      "</div></div>",
  );
}
async function runBatch() {
  const chosen = p.photos.filter((f) => f.selected);
  operation("Staging the apartment", "Preparing selected photographs…");
  let complete = 0;
  try {
    for (const f of chosen) {
      $("#op-status").textContent =
        "Staging " + f.name + " · " + (complete + 1) + " of " + chosen.length;
      let src = stageView(f);
      if (!src) {
        const related = p.photos.find(
          (v) => v.room && v.room === f.room && p.staged[v.id]?.style === style,
        );
        const data = await postAI("stage", {
          style,
          image: await tinyImage(
            p.example && f.id === "living" ? asset("empty.jpg") : f.src,
            1536,
          ),
          reference: related
            ? await tinyImage(p.staged[related.id].src, 1024)
            : null,
          room: p.rooms.find((r) => r.id === f.room)?.name || f.name,
        });
        src = data.image;
      }
      p.staged[f.id] = { style, src, use: true };
      await save();
      complete++;
    }
    busy = false;
    closeModal();
    render();
    toast(complete + " staged photographs are ready for review in the exposé.");
  } catch (e) {
    operationError(
      Error(complete + " of " + chosen.length + " views saved. " + e.message),
    );
  }
}
async function exportAction(kind) {
  readListing();
  await save();
  operation("Preparing listing files", "Processing the selected photographs…");
  try {
    await exportProject(p, kind, (t) => ($("#op-status").textContent = t));
    busy = false;
    closeModal();
    toast(
      kind === "pdf" ? "Exposé PDF downloaded." : "Listing package downloaded.",
    );
  } catch (e) {
    operationError(e);
  }
}
async function testRecording() {
  const button = $('[data-act="test-video"]');
  button.disabled = true;
  const submit = $("#new-project button[type=submit]");
  submit.disabled = true;
  button.textContent = "Loading test recording…";
  try {
    const response = await fetch(asset("test-scan.mp4"));
    if (!response.ok) throw Error("The sample recording is unavailable.");
    chosenFile = new File([await response.blob()], "Two-room calibration.mp4", {
      type: "video/mp4",
    });
    markers = [];
    $("#file-name").textContent = chosenFile.name;
    $("#property-name").value = "Two-room test apartment";
    $("#property-address").value = "Synthetic calibration scene";
    toast("Test recording ready. The two rooms each measure 4 × 4 m.");
  } finally {
    button.disabled = false;
    submit.disabled = false;
    button.textContent = "Use a two-room test recording ↗";
  }
}
const actions = {
  "test-video": testRecording,
  new: () => newScan(),
  "dismiss-plan": () => {
    closeModal();
    go("plan");
  },
  "back-new": () => newScan(false),
  guide,
  projects,
  workspace: () => workspaceDialog(),
  close: closeModal,
  menu: () => document.body.classList.toggle("rail-open"),
  record: recordDialog,
  "next-room": () => markRoom(false),
  "finish-record": () => markRoom(true),
  connect: connectDialog,
  plan: () => go("plan"),
  export: () => go("export"),
  reconstruct: reconstructDialog,
  "geometry-settings": geometrySettings,
  "run-geometry": () => runGeometry(true),
  "run-reconstruct": reconstruct,
  calibrate,
  draft: draftDescription,
  "generate-stage": stageGenerate,
  "use-original": () => {
    const f = stagedPhoto();
    p.staged[f.id].use = false;
    save();
    render();
    toast("Original photograph selected for export.");
  },
  "batch-stage": batchStageDialog,
  "run-batch": runBatch,
  "run-stage": runStage,
  "use-stage": () => {
    const f = stagedPhoto();
    p.staged[f.id] = { src: stageView(f), style, use: true };
    f.selected = true;
    save();
    render();
    toast("Staged photograph selected for the exposé.");
  },
  "download-plan": async () => {
    if (!p.rooms.length) return;
    downloadBlob(
      new Blob([await asBytes(await rasterPlan(p))], { type: "image/png" }),
      safeName(p.name) + "-floor-plan.png",
    );
  },
  pdf: () => exportAction("pdf"),
  zip: () => exportAction("zip"),
  play: async () => {
    const v = $("#source-video");
    if (!v) return;
    if (v.paused) {
      try {
        if (hosted && p.cloud && !v.getAttribute("src")) {
          toast("Loading your private walkthrough…");
          const source = await cloudVideo(p);
          if (!v.isConnected) return;
          v.src = source;
        }
        await v.play();
      } catch {
        toast(
          "This video cannot be played in this browser. Try a current browser with H.264 support.",
        );
      }
    } else v.pause();
  },
  fullscreen: async () => {
    let v = $("#source-video");
    if (v.parentElement.requestFullscreen)
      await v.parentElement.requestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    else go("capture");
  },
};
document.addEventListener("click", async (e) => {
  if (
    document.body.classList.contains("rail-open") &&
    !e.target.closest('#rail,[data-act="menu"]')
  ) {
    document.body.classList.remove("rail-open");
    return;
  }
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.page) {
      go(b.dataset.page);
      return;
    }
    if (b.dataset.mode) {
      planMode = b.dataset.mode;
      render();
      return;
    }
    if (b.dataset.style) {
      style = b.dataset.style;
      render();
      return;
    }
    if (b.dataset.filter) {
      photoFilter = b.dataset.filter;
      render();
      return;
    }
    if (b.dataset.project) {
      const next = b.dataset.project;
      if (next !== p.id) {
        const saved = await dbOp("projects", "readonly", (s) =>
          s.get(next),
        ).catch(() => null);
        if (saved) p = saved;
        else if (next === "sample") p = demoProject();
        else return;
        stageId = "";
        photoFilter = "all";
        try {
          localStorage.setItem("raumscan-current", p.id);
        } catch {}
      }
      closeModal();
      go("overview");
      return;
    }
    if (b.dataset.seek) {
      const v = $("#source-video");
      if (v) {
        v.currentTime = +b.dataset.seek;
        await v.play();
      }
      return;
    }
    if (b.dataset.check && capture) {
      const value = b.dataset.check;
      if (capture.checks.has(value)) capture.checks.delete(value);
      else capture.checks.add(value);
      b.classList.toggle("done", capture.checks.has(value));
      b.setAttribute("aria-pressed", String(capture.checks.has(value)));
      return;
    }
    const act = b.dataset.act || "";
    if (act.startsWith("room:")) {
      editRoom(act.slice(5));
      return;
    }
    if (act.startsWith("photo:")) {
      editPhoto(act.slice(6));
      return;
    }
    if (act.startsWith("remove-room:")) {
      const id = act.slice(12);
      modal(
        "Remove this room?",
        msg("Its walls and openings will be removed from this project.") +
          '<div class="form-footer">' +
          btn("Keep room", "close") +
          btn("Remove room", "confirm-remove:" + id, "trash", "primary") +
          "</div>",
      );
      return;
    }
    if (act.startsWith("confirm-remove:")) {
      const id = act.slice(15);
      p.rooms = p.rooms.filter((r) => r.id !== id);
      for (const f of p.photos) if (f.room === id) f.room = "";
      p.planVerified = false;
      p.description = "";
      save();
      closeModal();
      render();
      return;
    }
    if (actions[act]) await actions[act]();
  } catch (err) {
    fail(err);
  }
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.select) {
    const f = p.photos.find((q) => q.id === e.target.dataset.select);
    if (f) {
      f.selected = e.target.checked;
      save();
      render();
    }
  }
});
async function init() {
  if (hosted) {
    const hash = location.hash.slice(1);
    if (pages.some((x) => x[0] === hash)) page = hash;
    render();
    try {
      await cloudBoot();
    } catch (e) {
      toast(e.message);
    }
    connected = await connectionStatus();
    loaded = true;
    render();
    return;
  }
  try {
    const own = localStorage.getItem("raumscan-current");
    if (own) {
      const stored = await dbOp("projects", "readonly", (s) => s.get(own));
      if (stored) p = stored;
    }
  } catch {
    saveOK = false;
  }
  const hash = location.hash.slice(1);
  if (pages.some((x) => x[0] === hash)) page = hash;
  render();
  connected = await connectionStatus();
  loaded = true;
  if (page === "plan") render();
}
init();
