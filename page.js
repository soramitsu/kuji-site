"use strict";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const hero = document.querySelector(".hero");
const art = hero.querySelector(".hero-art");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
let pointerX = 0;
let pointerY = 0;
let currentX = 0;
let currentY = 0;
let frame = 0;

function paintDepth() {
  frame = 0;
  const bounds = hero.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, -bounds.top / bounds.height));
  currentX += (pointerX - currentX) * 0.13;
  currentY += (pointerY - currentY) * 0.13;
  art.style.setProperty("--rx", currentX.toFixed(3));
  art.style.setProperty("--ry", currentY.toFixed(3));
  art.style.setProperty("--scroll", progress.toFixed(3));
  if (Math.abs(pointerX - currentX) + Math.abs(pointerY - currentY) > 0.003)
    scheduleDepth();
}

function scheduleDepth() {
  if (
    !reduceMotion.matches &&
    !frame &&
    window.scrollY < hero.offsetTop + hero.offsetHeight + 30
  ) {
    frame = requestAnimationFrame(paintDepth);
  }
}

hero.addEventListener("pointermove", (event) => {
  if (!finePointer.matches || reduceMotion.matches) return;
  const area = hero.getBoundingClientRect();
  pointerX = (2 * (event.clientX - area.left)) / area.width - 1;
  pointerY = (2 * (event.clientY - area.top)) / area.height - 1;
  scheduleDepth();
});
hero.addEventListener("pointerleave", () => {
  pointerX = 0;
  pointerY = 0;
  scheduleDepth();
});
window.addEventListener("scroll", scheduleDepth, { passive: true });
reduceMotion.addEventListener("change", () => {
  cancelAnimationFrame(frame);
  frame = 0;
  currentX = currentY = pointerX = pointerY = 0;
  for (const key of ["--rx", "--ry", "--scroll"]) art.style.removeProperty(key);
  scheduleDepth();
});
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("enter");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.17 },
  );
  document
    .querySelectorAll(".system-copy,.app-view,.update-copy,.demo-copy")
    .forEach((el) => observer.observe(el));
}

const playback = document.querySelector(".playback");
const replay = document.querySelector("#replay");
const events = [...playback.querySelectorAll(".event")];
const status = document.querySelector("#play-status");
const replayLabel = replay.querySelector(".replay-label");
const signal = document.querySelector(".signal");
for (let index = 0; index < 72; index++) {
  const line = document.createElement("i");
  const phase = index / 71;
  const envelope = 0.15 + Math.sin(phase * Math.PI) * 0.85;
  line.style.height =
    3 +
    envelope *
      (6 + 21 * Math.abs(Math.sin(index * 5.33) * Math.cos(index * 0.37))) +
    "px";
  line.style.setProperty("--delay", -(index % 9) / 10 + "s");
  signal.append(line);
}

let timers = [];
function finishPlayback() {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  events.forEach((event) => event.classList.remove("waiting"));
  playback.classList.remove("is-playing");
  status.textContent = "294 events · 2 findings";
  replayLabel.textContent = "Replay sequence";
  replay.disabled = false;
}

replay.hidden = false;
replay.addEventListener("click", () => {
  replay.disabled = true;
  replayLabel.textContent = "Playing";
  status.textContent = "Reading simulated events…";
  events.forEach((event) => event.classList.add("waiting"));
  playback.classList.add("is-playing");
  if (reduceMotion.matches) {
    finishPlayback();
    return;
  }
  timers.push(
    setTimeout(() => {
      events[0].classList.remove("waiting");
      status.textContent = "Recovery activity flagged";
    }, 850),
    setTimeout(() => {
      events[1].classList.remove("waiting");
      status.textContent = "File activity flagged";
    }, 1750),
    setTimeout(finishPlayback, 2600),
  );
});
reduceMotion.addEventListener("change", () => {
  if (reduceMotion.matches && replay.disabled) finishPlayback();
});

const copy = document.querySelector("#copy");
const command = document.querySelector("#command");
const copyStatus = document.querySelector("#copy-status");
copy.hidden = false;
copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(command.textContent);
    copy.textContent = "Copied";
    copyStatus.textContent = "Demo command copied.";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(command);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    copyStatus.textContent =
      "Command selected. Use your device’s copy command.";
    copy.textContent = "Selected";
  }
});
