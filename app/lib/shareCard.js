import logoUrl from "../assets/logo.png";

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

  try {
    const logo = await loadImage(logoUrl);
    ctx.drawImage(logo, W / 2 - 80, 120, 160, 160);
  } catch {
    // no logo, no problem
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `700 30px ${BODY}`;
  ctx.fillText("THE NORDIC CHALLENGE", W / 2, 340);

  ctx.fillStyle = YELLOW;
  ctx.font = `800 150px ${DISPLAY}`;
  ctx.fillText("WORKOUT", W / 2, 520);
  ctx.fillText("COMPLETE", W / 2, 660);

  ctx.fillStyle = "#fff";
  fitFont(ctx, title.toUpperCase(), 800, DISPLAY, 96, W - 160);
  ctx.fillText(title.toUpperCase(), W / 2, 790);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 36px ${BODY}`;
  ctx.fillText(`${name} · ${date}`, W / 2, 850);

  // 2×2 stat tiles.
  const tiles = stats.slice(0, 4);
  const tileW = 440;
  const tileH = 220;
  const gap = 40;
  const x0 = (W - tileW * 2 - gap) / 2;
  const y0 = 920;
  tiles.forEach((t, i) => {
    const x = x0 + (i % 2) * (tileW + gap);
    const y = y0 + Math.floor(i / 2) * (tileH + gap);
    roundRect(ctx, x, y, tileW, tileH, 36);
    ctx.fillStyle = "#141414";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = t.highlight ? YELLOW : "#fff";
    ctx.textAlign = "left";
    fitFont(ctx, t.value, 800, DISPLAY, 110, tileW - 80);
    ctx.fillText(t.value, x + 40, y + 125);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `700 28px ${BODY}`;
    ctx.fillText(t.label.toUpperCase(), x + 40, y + 180);
  });

  // Level bar.
  let y = y0 + tileH * 2 + gap + 70;
  if (level) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = `700 34px ${BODY}`;
    ctx.fillText(`Level ${level.number} · ${level.name}`, x0, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `500 30px ${BODY}`;
    ctx.fillText(`${level.xp} XP`, W - x0, y);
    y += 30;
    roundRect(ctx, x0, y, W - x0 * 2, 18, 9);
    ctx.fillStyle = "#2a2a2a";
    ctx.fill();
    roundRect(ctx, x0, y, Math.max(18, (W - x0 * 2) * Math.min(1, level.progress)), 18, 9);
    ctx.fillStyle = YELLOW;
    ctx.fill();
    y += 90;
  }

  // Coach quote.
  if (line) {
    ctx.font = `600 40px ${BODY}`;
    const lines = wrap(ctx, `“${line}”`, W - x0 * 2 - 80).slice(0, 3);
    const boxH = 60 + lines.length * 54 + 60;
    roundRect(ctx, x0, y, W - x0 * 2, boxH, 36);
    ctx.fillStyle = "rgba(255,226,52,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,226,52,0.35)";
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    lines.forEach((l, i) => ctx.fillText(l, x0 + 40, y + 80 + i * 54));
    ctx.fillStyle = YELLOW;
    ctx.font = `800 30px ${BODY}`;
    ctx.fillText("— FLORIAN", x0 + 40, y + 80 + lines.length * 54 + 16);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `700 28px ${BODY}`;
  ctx.fillText("TRAIN WITH FLORIAN · THE NORDIC CHALLENGE", W / 2, H - 90);

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
