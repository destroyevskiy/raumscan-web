"use strict";
const hosted =
  (location.protocol === "https:" &&
    !["localhost", "127.0.0.1"].includes(location.hostname)) ||
  new URLSearchParams(location.search).has("cloud");
const CLOUD_URL = "https://sibcbqvatdnwsvqstvpg.supabase.co";
const PUBLIC_KEY = "sb_publishable_H52HZCITeRoDPZ3DwlI_-A_NXNSh9a0";
const client = hosted
  ? window.supabase.createClient(CLOUD_URL, PUBLIC_KEY)
  : null;
const PART = 8 * 1024 * 1024;
const summaryColumns =
  "id,name,address,filename,mime,parts,state,phase,progress,revision";
const versionById = new Map(),
  writes = new Map();
let lastWake = 0;
let cloudUser,
  jobTimer,
  cloudSync = "Saved to workspace",
  cloudSelection = "",
  processorOnline = false;
function checked(result) {
  if (result.error) throw Error(result.error.message);
  return result.data;
}
async function cloudAPI(action, body = {}) {
  const {
    data: { session },
  } = await client.auth.getSession();
  const response = await fetch(
    CLOUD_URL + "/functions/v1/studio?action=" + action,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: PUBLIC_KEY,
        ...(session ? { Authorization: "Bearer " + session.access_token } : {}),
      },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "The studio could not complete this request.");
  return data;
}
const digest = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
function localSet(key, value) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}
async function useCode(code) {
  code = code.trim().replace(/[\s-]/g, "").toLowerCase();
  if (!/^[a-f0-9]{48}$/.test(code))
    throw Error("Enter the full 48-character workspace key.");
  const email =
    (await digest(new TextEncoder().encode(code))) + "@pilot.raumscan.invalid";
  const { user } = checked(
    await client.auth.signInWithPassword({ email, password: code }),
  );
  cloudUser = user;
  localSet("raumscan-workspace-key", code);
  render();
}
function workspaceDialog(next) {
  if (cloudUser) {
    modal(
      "Your private workspace",
      '<div class="form-grid"><p>Use your workspace key on another device to open these scans. Anyone with the key can view and edit them.</p><div id="key-display"></div><div class="actions"><button class="btn" id="reveal-key">Show workspace key</button><button class="btn" id="signout">Sign out on this device</button></div></div>',
    );
    $("#reveal-key").onclick = () =>
      showKey(localStorage.getItem("raumscan-workspace-key"));
    $("#signout").onclick = async () => {
      try {
        await Promise.all([...writes.values()]);
        checked(await client.auth.signOut({ scope: "local" }));
        clearTimeout(jobTimer);
        cloudUser = null;
        cloudSelection = "";
        versionById.clear();
        localSet("raumscan-workspace-key", "");
        localSet("raumscan-cloud-current", "");
        for (const v of srcCache.values()) URL.revokeObjectURL(v);
        srcCache.clear();
        memoryVideos.clear();
        p = demoProject();
        closeModal();
        go("overview");
      } catch (e) {
        fail(e);
      }
    };
    return;
  }
  modal(
    "Open a private workspace",
    '<div class="form-grid"><p>Keep your walkthroughs, plans and listing photos together. A private workspace key lets you return from another device.</p><button class="btn primary" id="create-workspace">Create a workspace</button><form id="open-workspace" class="form-grid">' +
      field(
        "Already have a workspace key?",
        '<input id="workspace-key" type="password" autocomplete="off" placeholder="Enter your workspace key" required>',
      ) +
      '<button class="btn" type="submit">Open workspace</button></form><div class="app-error" id="operation-error" role="alert"></div></div>',
  );
  $("#create-workspace").onclick = async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const { code } = await cloudAPI("workspace");
      await useCode(code);
      modal(
        "Save your workspace key",
        '<div class="form-grid"><p>Keep this key in your password manager. It opens your private projects on any device.</p><div id="key-display"></div><button id="workspace-continue" class="btn primary">Continue to studio</button></div>',
      );
      showKey(code);
      $("#workspace-continue").onclick = () => {
        closeModal();
        if (next) next();
        else projects();
      };
    } catch (err) {
      b.disabled = false;
      fail(err);
    }
  };
  $("#open-workspace").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.target.querySelector("button");
    b.disabled = true;
    try {
      await useCode($("#workspace-key").value);
      closeModal();
      if (next) next();
      else projects();
    } catch (err) {
      b.disabled = false;
      fail(err);
    }
  };
}
function showKey(key) {
  const node = $("#key-display");
  if (!key) {
    node.textContent =
      "The key was cleared from this device. Use your saved copy.";
    return;
  }
  node.innerHTML =
    '<label class="field">Workspace key<input readonly id="display-key" spellcheck="false"></label><button class="text-btn" id="copy-key">Copy workspace key</button>';
  $("#display-key").value = key;
  $("#copy-key").onclick = async () => {
    try {
      await navigator.clipboard.writeText(key);
      toast("Workspace key copied.");
    } catch {
      $("#display-key").select();
    }
  };
}
async function cloudBoot() {
  cloudUser = (await client.auth.getSession()).data.session?.user || null;
  const id = localStorage.getItem("raumscan-cloud-current");
  if (cloudUser && id)
    try {
      await openCloud(id, false);
    } catch (e) {
      toast(e.message);
    }
}
async function listCloud() {
  const rows = cloudUser
    ? checked(
        await client
          .from("scans")
          .select(summaryColumns)
          .order("created_at", { ascending: false }),
      )
    : [];
  modal(
    "Your projects",
    '<div class="projects-list">' +
      [
        ...rows,
        {
          id: "sample",
          name: "Charlottenburg apartment",
          phase: "Illustrated sample",
        },
      ]
        .map(
          (r) =>
            '<button data-cloud-id="' +
            esc(r.id) +
            '">' +
            icon("building", 20) +
            "<span><b>" +
            esc(r.name) +
            "</b><small>" +
            esc(r.phase) +
            "</small></span></button>",
        )
        .join("") +
      '</div><div class="form-footer">' +
      btn("Workspace key", "workspace", "settings") +
      btn("New scan", "new", "plus", "primary") +
      "</div>",
  );
  $$("[data-cloud-id]").forEach(
    (b) => (b.onclick = () => openCloud(b.dataset.cloudId).catch(fail)),
  );
}
async function openCloud(id, navigate = true) {
  clearTimeout(jobTimer);
  cloudSelection = id;
  if (id === "sample") {
    p = demoProject();
    localSet("raumscan-cloud-current", "");
    closeModal();
    go("overview");
    return;
  }
  const row = checked(
    await client
      .from("scans")
      .select(summaryColumns + ",doc")
      .eq("id", id)
      .single(),
  );
  if (cloudSelection !== id) return;
  localSet("raumscan-cloud-current", id);
  if (row.state !== "ready") {
    if (
      ["queued", "working"].includes(row.state) &&
      Date.now() - lastWake > 90000
    ) {
      lastWake = Date.now();
      cloudAPI("wake", { id }).catch(() => {});
    }
    const isUpload = row.state === "uploading",
      isFailed = row.state === "failed";
    modal(
      row.name,
      '<div class="form-grid"><p id="job-phase" role="status">' +
        esc(row.phase) +
        '</p><progress max="100" value="' +
        Number(row.progress) +
        '"></progress><p class="sub">' +
        (isUpload
          ? "Choose the same recording to resume the upload."
          : isFailed
            ? "Retry or choose another recording."
            : "Your video is stored privately. You can close the studio and reopen this project on another device.") +
        '</p><div class="actions">' +
        (isFailed
          ? '<button class="btn primary" id="retry-job">Retry processing</button>'
          : isUpload
            ? btn("Resume upload", "new", "upload")
            : "") +
        btn("All projects", "projects", "folder") +
        '</div><div id="operation-error" class="app-error"></div></div>',
      () => clearTimeout(jobTimer),
    );
    if (isFailed)
      $("#retry-job").onclick = async () => {
        try {
          checked(await client.rpc("retry_scan", { scan_id: id }));
          await cloudAPI("wake", { id });
          await openCloud(id);
        } catch (e) {
          fail(e);
        }
      };
    if (!isUpload && !isFailed)
      jobTimer = setTimeout(() => openCloud(id).catch(fail), 4500);
    return;
  }
  const doc = row.doc;
  if (!doc || typeof doc !== "object")
    throw Error("This project is missing its results.");
  const all = [...doc.frames, ...doc.photos],
    prefix = cloudUser.id + "/" + id + "/";
  const paths = [
    ...new Set(
      all
        .map((f) => f.asset)
        .filter((a) => typeof a === "string" && a.startsWith(prefix)),
    ),
  ];
  const signed = paths.length
    ? checked(
        await client.storage
          .from("walkthroughs")
          .createSignedUrls(paths, 21600),
      )
    : [];
  const map = new Map(signed.map((v) => [v.path, v.signedUrl]));
  for (const f of all) f.src = map.get(f.asset) || "";
  if (cloudSelection !== id) return;
  p = { ...doc, cloud: true, id, parts: row.parts, mime: row.mime };
  versionById.set(id, row.revision);
  cloudSync = "Saved to workspace";
  saveOK = true;
  closeModal();
  if (navigate) go("overview");
  else render();
}
async function uploadCloud(file, name, address, markers) {
  if (!cloudUser) {
    workspaceDialog(() => newScan(false));
    return;
  }
  if (!file.size || file.size > 384 * 1024 * 1024)
    throw Error(
      "Choose a video up to 384 MiB. Export larger recordings at a lower bitrate.",
    );
  busy = true;
  modal(
    "Uploading your walkthrough",
    '<div class="form-grid"><p>Keep this tab open until the upload finishes. You can resume an interrupted upload by selecting the same video.</p><progress id="up-bar" max="100" value="0"></progress><p id="up-phase" role="status">Identifying the recording…</p><div class="app-error" id="operation-error"></div></div>',
  );
  try {
    const parts = Math.ceil(file.size / PART),
      hashes = [];
    for (let i = 0; i < parts; i++)
      hashes.push(
        await digest(await file.slice(i * PART, (i + 1) * PART).arrayBuffer()),
      );
    const fingerprint = await digest(new TextEncoder().encode(hashes.join("")));
    const id = checked(
      await client.rpc("start_scan", {
        title: name,
        location: address,
        filename: file.name,
        mime: file.type || "video/mp4",
        fingerprint,
        bytes: file.size,
        markers,
      }),
    );
    const row = checked(
      await client.from("scans").select("state").eq("id", id).single(),
    );
    if (row.state === "uploading") {
      const bucket = client.storage.from("walkthroughs"),
        folder = cloudUser.id + "/" + id + "/input";
      const existing = new Map(
        checked(await bucket.list(folder, { limit: 100 })).map((x) => [
          x.name,
          x.metadata?.size,
        ]),
      );
      for (let i = 0; i < parts; i++) {
        const key = String(i).padStart(3, "0"),
          blob = file.slice(i * PART, (i + 1) * PART);
        $("#up-phase").textContent =
          "Uploading part " + (i + 1) + " of " + parts;
        if (existing.get(key) !== blob.size) {
          const res = await bucket.upload(folder + "/" + key, blob, {
            contentType: "application/octet-stream",
          });
          if (res.error && !/duplicate|already exists/i.test(res.error.message))
            throw Error(res.error.message);
        }
        $("#up-bar").value = (100 * (i + 1)) / parts;
      }
      await cloudAPI("enqueue", { id });
    }
    memoryVideos.set(id, file);
    chosenFile = null;
    busy = false;
    await openCloud(id);
  } catch (e) {
    busy = false;
    throw e;
  } finally {
    busy = false;
  }
}
function saveCloud(project) {
  const doc = structuredClone(project),
    id = doc.id;
  for (const f of [...doc.frames, ...doc.photos]) delete f.src;
  delete doc.parts;
  delete doc.mime;
  cloudSync = "Saving…";
  statusBar();
  const before = writes.get(id) || Promise.resolve();
  const next = before
    .then(async () => {
      const revision = checked(
        await client.rpc("save_scan", {
          scan_id: id,
          expected_revision: versionById.get(id),
          document: doc,
        }),
      );
      versionById.set(id, revision);
      if (p.id === id) {
        cloudSync = "Saved to workspace";
        statusBar();
      }
    })
    .catch((e) => {
      if (p.id === id) {
        cloudSync = "Edits unsaved";
        statusBar();
        toast(e.message);
      }
    });
  writes.set(id, next);
  return next;
}
async function cloudVideo(project) {
  if (srcCache.has(project.id)) return srcCache.get(project.id);
  const local = memoryVideos.get(project.id);
  if (local) {
    const url = URL.createObjectURL(local);
    srcCache.set(project.id, url);
    return url;
  }
  const parts = [];
  for (let i = 0; i < project.parts; i++)
    parts.push(
      checked(
        await client.storage
          .from("walkthroughs")
          .download(
            cloudUser.id +
              "/" +
              project.id +
              "/input/" +
              String(i).padStart(3, "0"),
          ),
      ),
    );
  const url = URL.createObjectURL(
    new Blob(parts, { type: project.mime || "video/mp4" }),
  );
  srcCache.set(project.id, url);
  return url;
}
