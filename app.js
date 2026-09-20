import { jingzhe } from "./data/solar-terms.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  stream: null,
  demo: false,
  tracked: false,
  warmth: 0,
  thundered: false,
  phenology: new Set(),
  observation: "",
  city: "",
  frame: 0,
  lastTrackAt: 0,
  marker: null
};

const video = $("#camera");
const analysis = $("#analysis");
const arCanvas = $("#ar-canvas");
const aCtx = analysis.getContext("2d", { willReadFrequently: true });
const arCtx = arCanvas.getContext("2d");

function showScreen(name) {
  $$(".screen").forEach((screen) => screen.classList.toggle("is-active", screen.dataset.screen === name));
}

function resetExperience() {
  state.warmth = 0;
  state.thundered = false;
  state.phenology.clear();
  state.observation = "";
  $("#warmth").value = "0";
  $("#sun-control").classList.remove("is-hidden");
  $("#thunder").classList.add("is-hidden");
  $("#phenology-buttons").classList.add("is-hidden");
  $("#record-button").classList.add("is-hidden");
  $("#instruction").textContent = "缓缓拖动日轮，让大地升温";
  $$("#phenology-buttons button").forEach((button) => button.classList.remove("done"));
  $$(".step-dots i").forEach((dot, index) => dot.classList.toggle("active", index === 0));
}

async function startCamera(demo = false) {
  state.demo = demo;
  resetExperience();
  showScreen("camera");
  $("#permission-error").classList.add("is-hidden");

  if (demo) {
    const viewWidth = arCanvas.clientWidth || innerWidth;
    const viewHeight = arCanvas.clientHeight || innerHeight;
    state.tracked = true;
    state.marker = { cx: viewWidth / 2, cy: viewHeight * .43, width: Math.min(viewWidth * .68, 380), angle: 0 };
    updateTrackingUI(true, "演示模式 · 卡片已定位");
    startLoop();
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = state.stream;
    await video.play();
    startLoop();
  } catch (error) {
    console.error(error);
    $("#permission-error").classList.remove("is-hidden");
  }
}

function stopCamera() {
  cancelAnimationFrame(state.frame);
  state.frame = 0;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  video.srcObject = null;
}

function startLoop() {
  cancelAnimationFrame(state.frame);
  const loop = (time) => {
    fitCanvas();
    if (!state.demo && video.readyState >= 2 && time - state.lastTrackAt > 90) {
      trackMarker();
      state.lastTrackAt = time;
    }
    drawAR(time);
    state.frame = requestAnimationFrame(loop);
  };
  state.frame = requestAnimationFrame(loop);
}

function fitCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const viewWidth = arCanvas.clientWidth || innerWidth;
  const viewHeight = arCanvas.clientHeight || innerHeight;
  const width = Math.round(viewWidth * dpr);
  const height = Math.round(viewHeight * dpr);
  if (arCanvas.width !== width || arCanvas.height !== height) {
    arCanvas.width = width;
    arCanvas.height = height;
    arCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function trackMarker() {
  const w = 192;
  const h = Math.max(108, Math.round(w * video.videoHeight / video.videoWidth));
  analysis.width = w;
  analysis.height = h;
  aCtx.drawImage(video, 0, 0, w, h);
  const pixels = aCtx.getImageData(0, 0, w, h).data;
  const colors = { cyan: [0,0,0], magenta: [0,0,0], yellow: [0,0,0], green: [0,0,0] };

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      let key = "";
      if (b > 125 && g > 110 && r < 115 && b > r * 1.25 && g > r * 1.15) key = "cyan";
      else if (r > 135 && b > 105 && g < 115 && r > g * 1.28 && b > g * 1.15) key = "magenta";
      else if (r > 145 && g > 125 && b < 85 && r > b * 1.55 && g > b * 1.45) key = "yellow";
      else if (g > 105 && r < 120 && b < 145 && g > r * 1.22 && g > b * 1.08) key = "green";
      if (key) { colors[key][0] += x; colors[key][1] += y; colors[key][2] += 1; }
    }
  }

  const points = Object.fromEntries(Object.entries(colors).map(([key, value]) => [key, value[2] > 5 ? { x: value[0] / value[2], y: value[1] / value[2] } : null]));
  const valid = Object.values(points).every(Boolean);
  if (!valid) {
    state.tracked = false;
    updateTrackingUI(false, "正在寻找节气卡");
    return;
  }

  const topWidth = distance(points.cyan, points.magenta);
  const bottomWidth = distance(points.green, points.yellow);
  const leftHeight = distance(points.cyan, points.green);
  const geometryValid = topWidth > 28 && bottomWidth > 28 && leftHeight > 34 && points.cyan.x < points.magenta.x && points.green.x < points.yellow.x;
  if (!geometryValid) {
    state.tracked = false;
    updateTrackingUI(false, "请正对卡片并保持稳定");
    return;
  }

  const rawCx = (points.cyan.x + points.magenta.x + points.yellow.x + points.green.x) / 4;
  const rawCy = (points.cyan.y + points.magenta.y + points.yellow.y + points.green.y) / 4;
  const viewWidth = arCanvas.clientWidth || innerWidth;
  const viewHeight = arCanvas.clientHeight || innerHeight;
  const coverScale = Math.max(viewWidth / video.videoWidth, viewHeight / video.videoHeight);
  const offsetX = (viewWidth - video.videoWidth * coverScale) / 2;
  const offsetY = (viewHeight - video.videoHeight * coverScale) / 2;
  const videoX = rawCx / w * video.videoWidth;
  const videoY = rawCy / h * video.videoHeight;
  const markerWidth = ((topWidth + bottomWidth) / 2) / w * video.videoWidth * coverScale;
  const angle = Math.atan2(points.magenta.y - points.cyan.y, points.magenta.x - points.cyan.x);
  const next = { cx: videoX * coverScale + offsetX, cy: videoY * coverScale + offsetY, width: markerWidth, angle };
  state.marker = state.marker ? smoothMarker(state.marker, next, .28) : next;
  state.tracked = true;
  updateTrackingUI(true, "已识别惊蛰卡");
}

function smoothMarker(previous, next, amount) {
  return {
    cx: previous.cx + (next.cx - previous.cx) * amount,
    cy: previous.cy + (next.cy - previous.cy) * amount,
    width: previous.width + (next.width - previous.width) * amount,
    angle: previous.angle + (next.angle - previous.angle) * amount
  };
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function updateTrackingUI(tracked, message) {
  $("#tracking-state").textContent = message;
  $("#scan-frame").classList.toggle("tracked", tracked);
  $("#story-caption").classList.toggle("show", tracked);
}

function drawAR(time) {
  arCtx.clearRect(0, 0, arCanvas.clientWidth || innerWidth, arCanvas.clientHeight || innerHeight);
  if (!state.tracked || !state.marker) return;

  const { cx, cy, width, angle } = state.marker;
  const scale = Math.max(.55, Math.min(1.35, width / 340));
  const warmth = state.warmth / 100;
  arCtx.save();
  arCtx.translate(cx, cy);
  arCtx.rotate(angle);
  arCtx.scale(scale, scale);

  const glow = arCtx.createRadialGradient(0, -10, 10, 0, -10, 155);
  glow.addColorStop(0, `rgba(234,190,104,${.2 + warmth * .34})`);
  glow.addColorStop(1, "rgba(135,177,126,0)");
  arCtx.fillStyle = glow;
  arCtx.fillRect(-170, -170, 340, 340);

  drawSoil(arCtx, warmth, time);
  drawSun(arCtx, warmth);
  if (state.thundered) drawThunder(arCtx, time);
  drawPhenology(arCtx, time);
  arCtx.restore();
}

function drawSoil(ctx, warmth, time) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 28, 142, 76, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${Math.round(50 + warmth * 30)},${Math.round(67 + warmth * 32)},49,.84)`;
  ctx.fill();
  ctx.clip();

  ctx.strokeStyle = "rgba(221,205,160,.45)";
  ctx.lineWidth = 1.2;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 25, -18);
    ctx.bezierCurveTo(i * 19, 15, i * 31, 45, i * 17, 92);
    ctx.stroke();
  }
  if (warmth > .55) {
    ctx.strokeStyle = "rgba(190,215,158,.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 55);
    ctx.quadraticCurveTo(-7, 16, 3, -24 - warmth * 34);
    ctx.stroke();
  }
  const pulse = 1 + Math.sin(time / 280) * .08;
  ctx.fillStyle = "rgba(224,192,115,.92)";
  ctx.beginPath();
  ctx.ellipse(-38, 39, 9 * pulse, 5 * pulse, -.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(232,218,176,.48)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 28, 142, 76, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSun(ctx, warmth) {
  const y = 52 - warmth * 210;
  ctx.save();
  ctx.translate(-112 + warmth * 224, y);
  ctx.fillStyle = `rgba(235,188,94,${.45 + warmth * .5})`;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(248,218,139,.7)";
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(33, 0); ctx.stroke();
  }
  ctx.restore();
}

function drawThunder(ctx, time) {
  const flash = Math.max(0, Math.sin(time / 110)) * .7;
  ctx.save();
  ctx.fillStyle = `rgba(255,248,205,${flash})`;
  ctx.beginPath();
  ctx.moveTo(14, -128); ctx.lineTo(-5, -76); ctx.lineTo(15, -82); ctx.lineTo(-12, -30); ctx.lineTo(42, -92); ctx.lineTo(19, -87); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(225,231,219,.82)";
  ctx.beginPath();
  ctx.arc(-35, -128, 27, Math.PI, 0); ctx.arc(0, -142, 35, Math.PI, 0); ctx.arc(38, -126, 28, Math.PI, 0); ctx.lineTo(64,-115); ctx.lineTo(-62,-115); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPhenology(ctx, time) {
  if (state.phenology.has("桃始华")) {
    ctx.strokeStyle = "#5e3e35"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(16,-8); ctx.quadraticCurveTo(62,-58,92,-94); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const x = 44 + i * 9, y = -46 - i * 9 + Math.sin(time / 400 + i) * 2;
      ctx.fillStyle = "rgba(228,145,143,.94)"; ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
    }
  }
  if (state.phenology.has("仓庚鸣")) {
    ctx.save(); ctx.translate(-82,-70 + Math.sin(time/300)*3); ctx.fillStyle="#d9b34d"; ctx.beginPath(); ctx.ellipse(0,0,19,12,-.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(13,-2); ctx.lineTo(29,3); ctx.lineTo(14,6); ctx.fill(); ctx.restore();
  }
  if (state.phenology.has("鹰化为鸠")) {
    ctx.strokeStyle="rgba(240,238,216,.8)"; ctx.lineWidth=2;
    for (let i=0;i<3;i++){const x=-42+i*42,y=-122-Math.sin(time/500+i)*7;ctx.beginPath();ctx.arc(x,y,13,Math.PI*1.08,Math.PI*1.86);ctx.arc(x+23,y,13,Math.PI*1.14,Math.PI*1.92);ctx.stroke();}
  }
}

function advanceToThunder() {
  $("#sun-control").classList.add("is-hidden");
  $("#thunder").classList.remove("is-hidden");
  $("#instruction").textContent = "暖意已至，云层正在聚集";
  setStep(1);
}

function setStep(index) {
  $$(".step-dots i").forEach((dot, i) => dot.classList.toggle("active", i === index));
}

function playThunder() {
  state.thundered = true;
  navigator.vibrate?.([40, 35, 90]);
  playThunderSound();
  $("#thunder").classList.add("is-hidden");
  $("#phenology-buttons").classList.remove("is-hidden");
  $("#instruction").textContent = "春雷惊百虫，依次发现惊蛰三候";
  setStep(2);
}

function playThunderSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContext();
    const length = audio.sampleRate * 1.1;
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * .32));
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 180;
    source.buffer = buffer; source.connect(filter).connect(audio.destination); source.start();
  } catch (_) { /* Sound is an enhancement, not a blocker. */ }
}

function unlockPhenology(button) {
  state.phenology.add(button.dataset.phenology);
  button.classList.add("done");
  $("#story-caption small").textContent = `惊蛰 · ${button.querySelector("b").textContent}`;
  $("#story-caption strong").textContent = phenologyCopy[button.dataset.phenology];
  if (state.phenology.size === jingzhe.phenology.length) {
    $("#phenology-buttons").classList.add("is-hidden");
    $("#record-button").classList.remove("is-hidden");
    $("#instruction").textContent = "三候已见，留下你今天的观察";
    setStep(3);
  }
}

const phenologyCopy = {
  "桃始华": "桃花开始绽放，春意有了可以被看见的颜色。",
  "仓庚鸣": "黄鹂感受到春阳，以清亮的鸣声回应时序。",
  "鹰化为鸠": "古人以鸟的变化，描述季节中阴阳之气的转换。"
};

function openRecord() { stopCamera(); showScreen("record"); }

function updateRecordButton() {
  state.city = $("#city").value.trim();
  $("#make-card").disabled = !(state.observation && state.city);
}

function makeResult() {
  const date = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date());
  $("#result-date").textContent = date;
  $("#result-observation").textContent = state.observation;
  $("#result-city").textContent = state.city;
  localStorage.setItem("houjian-jingzhe", JSON.stringify({ date, observation: state.observation, city: state.city }));
  showScreen("result");
}

function saveResult() {
  $("#save-note").textContent = "请使用手机系统截屏保存节气签。";
}

$("#start-ar").addEventListener("click", () => startCamera(false));
$("#open-demo").addEventListener("click", () => startCamera(true));
$("#error-demo").addEventListener("click", () => startCamera(true));
$("#back-home").addEventListener("click", () => { stopCamera(); showScreen("intro"); });
$("#show-help").addEventListener("click", () => $("#help-dialog").showModal());
$(".dialog-close").addEventListener("click", () => $("#help-dialog").close());
$("#help-dialog").addEventListener("click", (event) => { if (event.target === $("#help-dialog")) $("#help-dialog").close(); });
$("#warmth").addEventListener("input", (event) => {
  state.warmth = Number(event.target.value);
  if (state.warmth >= 92) advanceToThunder();
});
$("#thunder").addEventListener("click", playThunder);
$$("#phenology-buttons button").forEach((button) => button.addEventListener("click", () => unlockPhenology(button)));
$("#record-button").addEventListener("click", openRecord);
$("#record-back").addEventListener("click", () => startCamera(state.demo));
$$("#observation-grid button").forEach((button) => button.addEventListener("click", () => {
  $$("#observation-grid button").forEach((item) => item.classList.remove("selected"));
  button.classList.add("selected");
  state.observation = button.dataset.value;
  updateRecordButton();
}));
$("#city").addEventListener("input", updateRecordButton);
$("#make-card").addEventListener("click", makeResult);
$("#restart").addEventListener("click", () => startCamera(state.demo));
$("#save-card").addEventListener("click", saveResult);
window.addEventListener("pagehide", stopCamera);
