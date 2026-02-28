// p5.js + ml5.js
// "Hide the tail" — vertical tail that drops down from the ceiling
// - Video is mirrored, BUT text is NOT mirrored
// - Touch tail with index fingertip -> it zips back in
// - More wiggly + capped length (won't cross the whole camera)

let video;
let handPose;
let hands = [];

let isMirror = true;

// --- tail settings ---
const PHRASE = ["to", "hide", "one's", "tail"];
const REPEAT = 10;
const TOTAL_SEG = REPEAT;

const WORD_GAP = 60;    // ✅ spacing between words (px) (45~90)
const WORD_SIZE = 22;

// ✅ extra wiggle controls
const SWAY_AMP = 28;          // stronger wiggle
const SWAY_FREQ = 0.075;      // faster wiggle
const CURL_AMP = 22;          // secondary curl amount
const CURL_FREQ = 0.12;       // secondary curl speed
const WIGGLE_STEPS = 3.8;     // how many bends along the tail

// ✅ stop the tail before it crosses the whole camera
const MAX_DROP_RATIO = 0.75;  // 0..1 of canvas height (0.45면 더 위에서 멈춤)
const DROP_MIN = 0.35; // 최소 길이(화면 높이 비율)
const DROP_MAX = 0.85; // 최대 길이(화면 높이 비율)

let tail = null;

const SHOW_SPEED = 0.030;
const HIDE_SPEED = 0.085;
const WAIT_MS = 2000;

const TAP_RADIUS = 28;

function preload() {
  handPose = ml5.handPose(); // if error: ml5.handpose()
}

function setup() {
  createCanvas(640, 480);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handPose.detectStart(video, gotHands);

  textAlign(CENTER, CENTER);
  textSize(WORD_SIZE);
  textStyle(BOLD);

  spawnTail();
}

function draw() {
  background(0);

  // ✅ Mirror ONLY the video (text is drawn after, outside this transform)
  if (isMirror) {
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height);
    pop();
  } else {
    image(video, 0, 0, width, height);
  }

  const tipModel = getIndexFingertipModel();
  const tip = tipModel ? modelToScreenPoint(tipModel) : null;

  updateTail(tip);
  drawTail();
}

function gotHands(results) {
  hands = results;
}

function getIndexFingertipModel() {
  if (!hands || hands.length === 0) return null;
  const hand = hands[0];

  if (hand.keypoints && hand.keypoints.length > 8) {
    const kp = hand.keypoints[8];
    return { x: kp.x, y: kp.y };
  }
  if (hand.landmarks && hand.landmarks.length > 8) {
    const lm = hand.landmarks[8];
    return { x: lm[0], y: lm[1] };
  }
  return null;
}

function modelToScreenPoint(p) {
  // ✅ When video is mirrored, flip x so interaction matches what you see
  return { x: isMirror ? width - p.x : p.x, y: p.y };
}

// --- tail logic ---
function spawnTail() {
  // ✅ Always from the ceiling, going DOWN (vertical tail)
  const anchor = { x: random(80, width - 80), y: 0 };
  const dir = { x: 0, y: 1 };

  tail = {
    anchor,
    dir,
    t: 0,
    state: "showing",     // showing | shown | hiding | waiting
    waitUntil: 0,
    phase: random(TWO_PI),
    maxDropRatio: random(DROP_MIN, DROP_MAX)
  };
}

function updateTail(tip) {
  if (!tail) return;

  if (tail.state === "showing") {
    tail.t += SHOW_SPEED;
    if (tail.t >= 1) {
      tail.t = 1;
      tail.state = "shown";
    }
  } else if (tail.state === "hiding") {
    tail.t -= HIDE_SPEED;
    if (tail.t <= 0) {
      tail.t = 0;
      tail.state = "waiting";
      tail.waitUntil = millis() + WAIT_MS;
    }
  } else if (tail.state === "waiting") {
    if (millis() >= tail.waitUntil) spawnTail();
  } else if (tail.state === "shown") {
    if (tip && isTipHittingTail(tip.x, tip.y)) {
      tail.state = "hiding";
    }
  }

  // ✅ faster wiggle
  tail.phase += SWAY_FREQ;
}

function isTipHittingTail(tx, ty) {
  const pts = computeTailPoints();
  for (const p of pts) {
    if (dist(tx, ty, p.x, p.y) < TAP_RADIUS) return true;
  }
  return false;
}

function computeTailPoints() {
  const out = [];

  // ✅ cap the max drop so it doesn't cross the whole camera
  const maxLWords = WORD_GAP * (TOTAL_SEG - 1);
  const maxLDrop = height * tail.maxDropRatio;

  const maxL = min(maxLWords, maxLDrop);

  const L = maxL * easeOutCubic(tail.t);

  const dx = tail.dir.x;
  const dy = tail.dir.y;

  // perpendicular for sway
  const px = -dy;
  const py = dx;

  for (let i = 0; i < TOTAL_SEG; i++) {
    const along = i * WORD_GAP;
    if (along > L) break;

    const u = i / max(1, TOTAL_SEG - 1);

    // ✅ more wiggly: layered sine waves + more bends along the tail
    const bend = u * WIGGLE_STEPS * TWO_PI;
    const sway1 = sin(tail.phase + bend) * SWAY_AMP;
    const sway2 = sin(tail.phase * 1.7 + bend * 1.35 + CURL_FREQ) * CURL_AMP;
    const sway = (sway1 + sway2) * u;

    const x = tail.anchor.x + dx * along + px * sway;
    const y = tail.anchor.y + dy * along + py * sway;

    out.push({ x, y });
  }

  if (out.length === 0) out.push({ x: tail.anchor.x, y: tail.anchor.y });
  return out;
}

function drawTail() {
  if (!tail) return;
  if (tail.t <= 0) return;

  const pts = computeTailPoints();

  fill(0);
  stroke(255);
  strokeWeight(6);

  textSize(WORD_SIZE);
  textStyle(BOLD);

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const word = PHRASE[i % PHRASE.length];

    push();
    translate(p.x, p.y);

    // ✅ Always vertical text
    rotate(HALF_PI);

    text(word, 0, 0);
    pop();
  }
}

function easeOutCubic(t) {
  return 1 - pow(1 - t, 3);
}

function keyPressed() {
  if (key === "m" || key === "M") isMirror = !isMirror;
  if (key === "r" || key === "R") spawnTail();
}