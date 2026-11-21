(() => {
  "use strict";

  const section = document.querySelector(".nine");
  if (!section) return;

  const buttons = [...section.querySelectorAll(".nine-cut")];
  const replay = section.querySelector(".nine-replay");
  const drawn = section.querySelector("#nine-drawn");
  const current = section.querySelector("#nine-current rect");
  const ink = section.querySelector(".nine-ink");
  const red = section.querySelector(".nine-vermilion");
  const ghost = section.querySelector(".nine-ghost use");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  // [start x, start y, end x, end y, width] along the upper or left edge
  // of each impression, in the order used by assets/brand/tools/generate.mjs.
  const strokes = [
    [12, 40, 341, 33, 34],
    [50, 12, 51, 368, 36],
    [11, 108, 341, 105, 32],
    [122, 11, 125, 366, 30],
    [12, 176, 342, 172, 32],
    [194, 9, 196, 365, 34],
    [13, 241, 342, 236, 34],
    [268, 7, 273, 364, 33],
    [13, 303, 342, 299, 38],
  ];

  // Each engraved plate is 320 × 32 before the brand transform. Draw along
  // its local x axis with 1.5 units of bleed to clear the uneven ink edges.
  const fullWidth = 323;
  const clips = strokes.map(([x, y, endX, endY, width], index) => {
    const column = index % 2 === 1;
    const matrix = [
      (endX - x) / 320, (endY - y) / 320,
      column ? width / 32 : 0, column ? 0 : width / 32,
      x, y,
    ];
    const rect = current.cloneNode(false);
    rect.setAttribute("transform", `matrix(${matrix.join(" ")})`);
    drawn.appendChild(rect);
    return rect;
  });

  let observer;
  let frame = 0;
  let touchTimer;
  let active = -1;

  function finish() {
    cancelAnimationFrame(frame);
    clearTimeout(touchTimer);
    if (active !== -1) buttons[active].classList.remove("nine-cut--active");
    active = -1;
    current.setAttribute("width", "0");
    ink.removeAttribute("clip-path");
    red.removeAttribute("opacity");
    section.classList.remove("nine--inspect", "nine--sequence");
  }

  function select(index) {
    if (active !== -1) buttons[active].classList.remove("nine-cut--active");
    active = index;
    buttons[index].classList.add("nine-cut--active");
    current.setAttribute("transform", clips[index].getAttribute("transform"));
  }

  function animate(duration, paint, done) {
    const start = performance.now();
    function tick(now) {
      const elapsed = Math.min(duration, Math.max(0, now - start));
      paint(elapsed);
      if (elapsed < duration) frame = requestAnimationFrame(tick);
      else if (done) done();
    }
    tick(start);
  }

  function widthAt(elapsed) {
    const t = Math.min(1, elapsed / 215);
    return fullWidth * (1 - (1 - t) ** 2);
  }

  function stopAutoplay() {
    observer?.disconnect();
    observer = undefined;
  }

  function inspect(index, restart = false) {
    if (index === active && !restart && section.classList.contains("nine--inspect")) return;
    stopAutoplay();
    finish();
    select(index);
    ghost.setAttribute("href", buttons[index].querySelector("use").getAttribute("href"));
    section.classList.add("nine--inspect");
    if (reduced.matches) current.setAttribute("width", fullWidth);
    else animate(215, elapsed => current.setAttribute("width", widthAt(elapsed)));
  }

  function playAll() {
    stopAutoplay();
    finish();
    if (reduced.matches) return;
    for (const clip of clips) clip.setAttribute("width", "0");
    section.classList.add("nine--sequence");
    ink.setAttribute("clip-path", "url(#nine-drawn)");
    const beat = 300;
    animate(beat * clips.length, elapsed => {
      const index = Math.min(clips.length - 1, Math.floor(elapsed / beat));
      if (index !== active) {
        // Finish earlier cuts even when the browser skips a frame or a beat.
        for (let i = Math.max(0, active); i < index; i++) clips[i].setAttribute("width", fullWidth);
        select(index);
      }
      const age = elapsed - index * beat;
      const width = widthAt(age);
      clips[index].setAttribute("width", width);
      current.setAttribute("width", width);
      red.setAttribute("opacity", Math.min(1, (beat - age) / 72));
    }, finish);
  }

  function leave(index) {
    if (active === index && section.classList.contains("nine--inspect")) finish();
  }

  buttons.forEach((button, index) => {
    let touch = false;
    button.addEventListener("pointerenter", event => {
      if (event.pointerType !== "touch") inspect(index);
    });
    button.addEventListener("pointerleave", event => {
      if (event.pointerType !== "touch") leave(index);
    });
    button.addEventListener("pointerdown", event => {
      touch = event.pointerType === "touch";
    });
    button.addEventListener("focus", () => inspect(index));
    button.addEventListener("blur", () => leave(index));
    button.addEventListener("click", event => {
      inspect(index, true);
      // A tap has no hover exit. Give the impression a moment, then lift it.
      if (touch && event.detail > 0) touchTimer = setTimeout(() => leave(index), 1250);
    });
    button.disabled = false;
  });
  replay.addEventListener("click", playAll);
  replay.disabled = false;
  reduced.addEventListener("change", finish);

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(entries => {
      if (observer && entries.some(entry => entry.intersectionRatio >= 0.18)) playAll();
    }, { threshold: 0.18 });
    observer.observe(section.querySelector(".nine-print"));
  }
})();
