import logoUrl from "../assets/logo.png";
import { POINTS } from "./gamify";

// Draws a 1080×1920 (Instagram story) summary of a finished workout and
// returns it as a PNG blob.

const W = 1080;
const H = 1920;
const YELLOW = "#FFE234";
const DISPLAY = "'Barlow Condensed', Inter, sans-serif";
const BODY = "Inter, -apple-system, sans-serif";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Word-wraps `text` into lines no wider than `maxWidth`.
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Shrinks the font until `text` fits on one line.
function fitFont(ctx, text, weight, family, start, maxWidth) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    size -= 4;
  } while (ctx.measureText(text).width > maxWidth && size > 40);
}

export async function drawSummaryCard({ name, title, date, stats, line, level }) {
  await Promise.all([
    document.fonts?.load(`800 120px "Barlow Condensed"`),
    document.fonts?.load(`700 40px Inter`),
    document.fonts?.load(`500 40px Inter`),
  ]).catch(() => {});

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background: black with a soft yellow glow at the top.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, 1100);
  glow.addColorStop(0, "rgba(255,226,52,0.28)");
  glow.addColorStop(1, "rgba(255,226,52,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Mountain line, a nod to the crossing.
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 640);
  [[140, 560], [260, 610], [420, 480], [560, 590], [700, 520], [860, 600], [1080, 470]].forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  // Everything is laid out top to bottom with a running `y`, and must end
  // above SAFE_BOTTOM: Instagram covers roughly the bottom 250px of a story.
  const SAFE_BOTTOM = H - 230;
  let y = 90;

  try {
    const logo = await loadImage(logoUrl);
    ctx.drawImage(logo, W / 2 - 100, y, 200, 200);
  } catch {
    // no logo, no problem
  }
  y += 200 + 56;

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `700 30px ${BODY}`;
  ctx.fillText("COACHED BY FLORIAN TEATIU", W / 2, y);
  y += 150;

  ctx.fillStyle = YELLOW;
  ctx.font = `800 140px ${DISPLAY}`;
  ctx.fillText("WORKOUT", W / 2, y);
  y += 128;
  ctx.fillText("COMPLETE", W / 2, y);
  y += 118;

  ctx.fillStyle = "#fff";
  fitFont(ctx, title.toUpperCase(), 800, DISPLAY, 88, W - 160);
  ctx.fillText(title.toUpperCase(), W / 2, y);
  y += 58;

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 34px ${BODY}`;
  ctx.fillText(`${name} · ${date}`, W / 2, y);
  y += 56;

  // 2×2 stat tiles.
  const tiles = stats.slice(0, 4);
  const tileW = 440;
  const tileH = 184;
  const gap = 32;
  const x0 = (W - tileW * 2 - gap) / 2;
  tiles.forEach((t, i) => {
    const x = x0 + (i % 2) * (tileW + gap);
    const ty = y + Math.floor(i / 2) * (tileH + gap);
    roundRect(ctx, x, ty, tileW, tileH, 32);
    ctx.fillStyle = "#141414";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = t.highlight ? YELLOW : "#fff";
    ctx.textAlign = "left";
    fitFont(ctx, t.value, 800, DISPLAY, 96, tileW - 80);
    ctx.fillText(t.value, x + 40, ty + 104);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `700 26px ${BODY}`;
    ctx.fillText(t.label.toUpperCase(), x + 40, ty + 152);
  });
  y += Math.ceil(tiles.length / 2) * (tileH + gap) + 36;

  // Level bar.
  if (level) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = `700 32px ${BODY}`;
    ctx.fillText(`Level ${level.number} · ${level.name}`, x0, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `500 28px ${BODY}`;
    ctx.fillText(`${level.xp} ${POINTS}`, W - x0, y);
    y += 26;
    roundRect(ctx, x0, y, W - x0 * 2, 16, 8);
    ctx.fillStyle = "#2a2a2a";
    ctx.fill();
    roundRect(ctx, x0, y, Math.max(16, (W - x0 * 2) * Math.min(1, level.progress)), 16, 8);
    ctx.fillStyle = YELLOW;
    ctx.fill();
    y += 16 + 44;
  }

  // Footer (tag) sits under the quote; the quote shrinks if needed so both fit.
  const FOOTER_GAP = 64;
  if (line) {
    const boxW = W - x0 * 2;
    const maxBoxH = SAFE_BOTTOM - FOOTER_GAP - y;
    let size = 38;
    let lines;
    let lineH;
    let boxH;
    for (;;) {
      ctx.font = `600 ${size}px ${BODY}`;
      lines = wrap(ctx, `“${line}”`, boxW - 80);
      lineH = Math.round(size * 1.32);
      boxH = 44 + lines.length * lineH + 18 + 34 + 30; // top pad, quote, gap, signature, bottom pad
      if (boxH <= maxBoxH || size <= 28) break;
      size -= 2;
    }
    roundRect(ctx, x0, y, boxW, boxH, 32);
    ctx.fillStyle = "rgba(255,226,52,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,226,52,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${size}px ${BODY}`;
    lines.forEach((l, i) => ctx.fillText(l, x0 + 40, y + 44 + size * 0.85 + i * lineH));
    ctx.fillStyle = YELLOW;
    ctx.font = `800 28px ${BODY}`;
    ctx.fillText("— FLORIAN", x0 + 40, y + 44 + lines.length * lineH + 18 + 26);
    y += boxH;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = YELLOW;
  ctx.font = `800 34px ${BODY}`;
  ctx.fillText("@FLORIANTEATIU", W / 2, Math.min(y + FOOTER_GAP, SAFE_BOTTOM));

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// Opens the phone's share sheet (Instagram, Messages…) with the image, or
// downloads it where sharing files isn't supported.
export async function shareImage(blob, filename = "nordic-challenge-workout.png") {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Workout complete" });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
