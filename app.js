const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const statusNode = document.getElementById("status");
const stage = document.getElementById("spaceStage");
const hologram = document.getElementById("hologram");
const ctx = overlay.getContext("2d");

const PARTICLE_COUNT = 100;
const particles = [];
let trackerPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let pinchStrength = 0.4;
let stageRect = stage.getBoundingClientRect();
let handTrackingActive = false;

function resizeOverlay() {
  const { width, height } = video.getBoundingClientRect();
  overlay.width = width;
  overlay.height = height;
  stageRect = stage.getBoundingClientRect();
}

function spawnParticles() {
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const node = document.createElement("span");
    node.className = "particle";
    stage.appendChild(node);

    particles.push({
      node,
      x: Math.random() * stage.clientWidth,
      y: Math.random() * stage.clientHeight,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
    });
  }
}

function updateHologram() {
  const localX = trackerPoint.x - stageRect.left;
  const localY = trackerPoint.y - stageRect.top;

  const x = Math.max(20, Math.min(stageRect.width - 20, localX));
  const y = Math.max(20, Math.min(stageRect.height - 20, localY));

  hologram.style.left = `${x}px`;
  hologram.style.top = `${y}px`;

  const scale = 0.8 + pinchStrength * 1.4;
  const glow = 15 + pinchStrength * 35;
  hologram.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;
  hologram.style.filter = `drop-shadow(0 0 ${glow.toFixed(0)}px rgba(34, 211, 238, 0.9))`;
}

function animateParticles() {
  const localX = trackerPoint.x - stageRect.left;
  const localY = trackerPoint.y - stageRect.top;

  particles.forEach((particle, index) => {
    const dx = localX - particle.x;
    const dy = localY - particle.y;
    const dist = Math.hypot(dx, dy) + 0.001;
    const force = Math.max(0, 120 - dist) / 3000;

    particle.vx += (dx / dist) * force;
    particle.vy += (dy / dist) * force;

    particle.vx += Math.sin((index + performance.now() / 700) * 0.03) * 0.01;
    particle.vy += Math.cos((index + performance.now() / 900) * 0.03) * 0.01;

    particle.vx *= 0.98;
    particle.vy *= 0.98;

    particle.x = (particle.x + particle.vx + stageRect.width) % stageRect.width;
    particle.y = (particle.y + particle.vy + stageRect.height) % stageRect.height;

    particle.node.style.transform = `translate(${particle.x.toFixed(1)}px, ${particle.y.toFixed(1)}px) scale(${(0.7 + pinchStrength).toFixed(2)})`;
    particle.node.style.background = index % 2 === 0 ? "#22d3ee" : "#f472b6";
    particle.node.style.opacity = (0.3 + pinchStrength * 0.7).toFixed(2);
  });
}

function frame() {
  updateHologram();
  animateParticles();
  requestAnimationFrame(frame);
}

function updateStatus(message) {
  statusNode.textContent = message;
}

function setFallbackMouseControl() {
  stage.addEventListener("pointermove", (event) => {
    trackerPoint = { x: event.clientX, y: event.clientY };
  });
  updateStatus("Using mouse fallback control. Move pointer over stage.");
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (results.multiHandLandmarks?.length) {
    handTrackingActive = true;
    const hand = results.multiHandLandmarks[0];

    drawConnectors(ctx, hand, HAND_CONNECTIONS, { color: "#22d3ee", lineWidth: 4 });
    drawLandmarks(ctx, hand, { color: "#f472b6", lineWidth: 2 });

    const indexTip = hand[8];
    const thumbTip = hand[4];

    trackerPoint = {
      x: (1 - indexTip.x) * stageRect.width + stageRect.left,
      y: indexTip.y * stageRect.height + stageRect.top,
    };

    const pinchDistance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    pinchStrength = Math.max(0.15, Math.min(1.2, 0.18 / pinchDistance));

    updateStatus("Hand detected: steer with index finger, pinch to boost hologram.");
  } else if (handTrackingActive) {
    updateStatus("Hand lost. Keep your hand in frame or use mouse fallback.");
  }

  ctx.restore();
}

async function initHandTracking() {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onResults);

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 960,
    height: 720,
  });

  await camera.start();
  resizeOverlay();
  updateStatus("Camera live. Raise your hand to start controlling the hologram.");
}

async function init() {
  spawnParticles();
  resizeOverlay();
  requestAnimationFrame(frame);

  window.addEventListener("resize", resizeOverlay);

  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    await initHandTracking();
  } catch (error) {
    console.error(error);
    updateStatus("Camera/gesture access failed. Mouse fallback enabled.");
    setFallbackMouseControl();
  }
}

init();
