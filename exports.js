"use strict";
const safeName = (v) =>
  String(v || "Apartment")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "") || "Apartment";
const asBytes = async (url) =>
  new Uint8Array(await (await fetch(url)).arrayBuffer());
function downloadBlob(blob, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
function exportRoomName(p, name) {
  if (p.language !== "de") return name;
  return (
    {
      "Living room": "Wohnzimmer",
      Bedroom: "Schlafzimmer",
      Kitchen: "Küche",
      Hallway: "Flur",
      Bathroom: "Badezimmer",
    }[name] || name.replace(/^Room (\d+)$/, "Raum $1")
  );
}
async function rasterPlan(p) {
  let c = canvasOf(1500, 1150),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#f9faf5";
  ctx.fillRect(0, 0, c.width, c.height);
  const localized = {
    ...p,
    rooms: p.rooms.map((r) => ({ ...r, name: exportRoomName(p, r.name) })),
  };
  const svg = floorSVG(localized).replace(
      "<svg ",
      '<svg width="1450" height="1000" ',
    ),
    im = await loadImg(
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    );
  ctx.drawImage(im, 25, 24, 1450, 1000);
  ctx.fillStyle = "#38483b";
  ctx.font = "23px Arial";
  ctx.fillText(planCaption(p), 48, 1095);
  return c.toDataURL("image/png");
}
function planCaption(p) {
  const de = p.language === "de",
    a =
      area(p.rooms).toLocaleString(de ? "de-DE" : "en-GB", {
        maximumFractionDigits: 1,
      }) + " m²";
  if (p.example)
    return (de ? "Beispielgrundriss" : "Illustrative sample plan") + " · " + a;
  if (p.planVerified)
    return (
      (de ? "Maße vor Ort geprüft" : "Dimensions reviewed by agent") + " · " + a
    );
  return de
    ? "Grundrissentwurf · Maße geschätzt · vor Ort prüfen"
    : "Draft layout · approximate dimensions · verify on site";
}
function descriptionFor(p) {
  if (p.description) return p.description;
  const de = p.language === "de",
    names = p.rooms.map((r) => exportRoomName(p, r.name));
  const place = p.address ? " in " + p.address : "";
  if (de) {
    return (
      "Diese Wohnung" +
      place +
      " steht " +
      (p.purpose === "Rent" ? "zur Vermietung" : "zum Verkauf") +
      ". " +
      (names.length
        ? "Der Grundriss umfasst " +
          names.join(", ") +
          ". "
        : "") +
      (p.planVerified
        ? "Die geprüfte Fläche beträgt " + fmt(area(p.rooms)) + " m². "
        : "") +
      "Die folgenden Aufnahmen zeigen die Räume der Wohnung."
    );
  }
  return (
    "This apartment" +
    place +
    " is offered for " +
    (p.purpose === "Rent" ? "rent" : "sale") +
    ". " +
    (names.length
      ? "The floor plan includes " + names.join(", ").toLowerCase() + ". "
      : "") +
    (p.planVerified
      ? "The reviewed floor area is " + fmt(area(p.rooms)) + " m². "
      : "") +
    "The following photographs show the apartment room by room."
  );
}
async function chosenImages(p) {
  let items = [];
  for (const photo of p.photos.filter((f) => f.selected)) {
    const staged = p.staged?.[photo.id];
    if (staged?.use && staged.src) {
      items.push({
        name: exportRoomName(p, photo.name),
        style: staged.style,
        src: staged.src,
        staged: true,
      });
    } else {
      const src = await processPhoto(
        photo.src,
        photo.adjust || defaultAdjust(),
      );
      items.push({ name: exportRoomName(p, photo.name), src, staged: false });
    }
  }
  return items;
}
const pdfText = (s) =>
  String(s)
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\xff\n]/g, " ")
    .slice(0, 12000);
async function makePDF(p, imgs, plan) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib,
    doc = await PDFDocument.create(),
    reg = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold),
    serif = await doc.embedFont(StandardFonts.TimesRoman),
    ink = rgb(0.1, 0.18, 0.13),
    muted = rgb(0.33, 0.4, 0.34);
  let page,
    number = 0;
  const de = p.language === "de";
  doc.setTitle(pdfText(p.name));
  doc.setAuthor(pdfText(p.brand || "Raumscan Studio"));
  function newPage(label) {
    page = doc.addPage([595.28, 841.89]);
    number++;
    page.drawText(pdfText((p.brand || "Raumscan Studio").toUpperCase()), {
      x: 42,
      y: 798,
      size: 10,
      font: bold,
      color: ink,
    });
    page.drawLine({
      start: { x: 42, y: 785 },
      end: { x: 553, y: 785 },
      thickness: 0.7,
      color: muted,
    });
    page.drawText(pdfText(label), {
      x: 42,
      y: 30,
      size: 9,
      font: reg,
      color: muted,
    });
    page.drawText(String(number).padStart(2, "0"), {
      x: 530,
      y: 30,
      size: 9,
      font: reg,
      color: muted,
    });
  }
  function lines(t, font, size, width) {
    let out = [],
      line = "";
    for (const word of pdfText(t).split(/\s+/)) {
      const trial = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(trial, size) > width && line) {
        out.push(line);
        line = "";
      }
      if (font.widthOfTextAtSize(word, size) > width) {
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > width) {
            out.push(line);
            line = "";
          }
          line += char;
        }
      } else line = line ? line + " " + word : word;
    }
    if (line) out.push(line);
    return out;
  }
  const textAt = (t, x, y, size, font = reg) =>
    page.drawText(pdfText(t), { x, y, size, font, color: ink });
  const draw = async (src, x, y, w, h) => {
    const bytes = await asBytes(src);
    const pic = src.startsWith("data:image/png")
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
    const b = pic.scaleToFit(w, h);
    page.drawImage(pic, {
      x: x + (w - b.width) / 2,
      y: y + (h - b.height) / 2,
      width: b.width,
      height: b.height,
    });
  };
  const disclosure = p.example
    ? de
      ? "Beispielobjekt · Illustrative Aufnahmen"
      : "Sample property · Illustrative imagery"
    : de
      ? "Immobilienexposé"
      : "Property exposé";
  newPage(disclosure);
  textAt(
    de
      ? p.purpose === "Rent"
        ? "WOHNUNG ZUR MIETE"
        : "WOHNUNG ZUM KAUF"
      : p.purpose === "Rent"
        ? "APARTMENT TO RENT"
        : "APARTMENT FOR SALE",
    42,
    749,
    10,
    bold,
  );
  let y = 706;
  for (const l of lines(p.name, serif, 34, 507)) {
    textAt(l, 42, y, 34, serif);
    y -= 37;
  }
  textAt(p.address, 42, y + 8, 12);
  y -= 18;
  if (imgs[0]) {
    await draw(imgs[0].src, 42, y - 272, 511, 260);
    y -= 292;
    if (imgs[0].staged) {
      textAt(de ? "Virtuell möbliert" : "Virtually staged", 42, y + 5, 9);
      y -= 15;
    }
  }
  for (const l of lines(descriptionFor(p), reg, 12, 505)) {
    if (y < 74) {
      newPage(disclosure);
      y = 746;
    }
    textAt(l, 42, y, 12);
    y -= 18;
  }
  if (plan) {
    newPage(de ? "Grundriss" : "Floor plan");
    textAt(de ? "Grundriss" : "Floor plan", 42, 728, 34, serif);
    await draw(plan, 34, 245, 527, 439);
    let rowY = 224;
    for (const r of p.rooms) {
      if (rowY < 65) {
        newPage(de ? "Raumliste" : "Room schedule");
        rowY = 744;
      }
      textAt(
        exportRoomName(p, r.name) +
          "   " +
          fmt(r.w) +
          " × " +
          fmt(r.h) +
          " m   /   " +
          fmt(r.w * r.h) +
          " m²",
        42,
        rowY,
        11,
      );
      rowY -= 18;
    }
    if (rowY < 65) {
      newPage(disclosure);
      rowY = 744;
    }
    textAt(planCaption(p), 42, rowY - 5, 10);
  }
  for (let i = 0; i < imgs.length; i += 2) {
    newPage(de ? "Fotografien" : "Photography");
    for (let j = 0; j < 2 && i + j < imgs.length; j++) {
      let v = imgs[i + j],
        top = 748 - j * 346;
      textAt(v.name, 42, top, 21, serif);
      await draw(v.src, 42, top - 291, 511, 274);
      if (v.staged)
        textAt(
          (de ? "Virtuell möbliert" : "Virtually staged") + " · " + v.style,
          42,
          top - 310,
          10,
        );
    }
  }
  return await doc.save();
}
async function exportProject(p, kind, progress) {
  const items = await chosenImages(p),
    plan = p.rooms.length ? await rasterPlan(p) : null;
  progress("Building the branded exposé…");
  const pdf = await makePDF(p, items, plan),
    name = safeName(p.name);
  if (kind === "pdf") {
    downloadBlob(
      new Blob([pdf], { type: "application/pdf" }),
      name + "-Expose.pdf",
    );
    return;
  }
  const zip = new JSZip();
  zip.file(name + "-Expose.pdf", pdf);
  zip.file(
    "listing-description.txt",
    p.name +
      "\n" +
      p.address +
      "\n\n" +
      descriptionFor(p) +
      "\n\n" +
      (p.example ? "Illustrative sample property.\n" : "") +
      (plan ? planCaption(p) + "\n" : ""),
  );
  if (plan) zip.file("floor-plan.png", await asBytes(plan));
  for (let i = 0; i < items.length; i++) {
    const v = items[i];
    zip.file(
      "photos/" +
        String(i + 1).padStart(2, "0") +
        "-" +
        safeName(v.name) +
        (v.staged ? "-virtually-staged" : "") +
        ".jpg",
      await asBytes(await processPhoto(v.src, { enhance: false })),
    );
  }
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, name + "-listing-assets.zip");
}
