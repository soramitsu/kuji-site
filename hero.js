"use strict";

// The opening scene: Abe no Seimei cuts the nine strokes and they become the mark.
// Everything is a pure function of time, so skipping, replaying and resizing
// only ever call render() with a different moment.
(() => {
  const hero = document.querySelector(".hero");
  const svg = hero && hero.querySelector("#hero-svg");
  if (!svg) return;
  const root = document.documentElement;
  const stage = hero.querySelector(".hero-stage");
  const $ = (selector) => svg.querySelector(selector);
  const $$ = (selector) => [...svg.querySelectorAll(selector)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 820px), (max-aspect-ratio: 1/1)");

  // The nine strokes on the mark's 358 × 376 reference, in cutting order.
  // A row is given by its upper edge, a column by its left edge.
  const STROKES = [
    { row: true, from: [12, 40], to: [341, 33], w: 34 },
    { row: false, from: [50, 12], to: [51, 368], w: 36 },
    { row: true, from: [11, 108], to: [341, 105], w: 32 },
    { row: false, from: [122, 11], to: [125, 366], w: 30 },
    { row: true, from: [12, 176], to: [342, 172], w: 32 },
    { row: false, from: [194, 9], to: [196, 365], w: 34 },
    { row: true, from: [13, 241], to: [342, 236], w: 34 },
    { row: false, from: [268, 7], to: [273, 364], w: 33 },
    { row: true, from: [13, 303], to: [342, 299], w: 38 },
  ];
  for (const stroke of STROKES) {
    const [x0, y0] = stroke.from;
    const [x1, y1] = stroke.to;
    const half = stroke.w / 2;
    stroke.a = stroke.row ? [x0, y0 + half] : [x0 + half, y0];
    stroke.b = stroke.row ? [x1, y1 + half] : [x1 + half, y1];
  }

  const DEG = Math.PI / 180;
  const SHOULDER = { x: 1087, y: 556 };
  const CHANT = { x: 1150, y: 404, a: 82 };
  const LATTICE_CUT = { cx: 800, cy: 500, s: 0.62 };
  const LATTICE_REST = { cx: 745, cy: 470, s: 0.82 };
  const HAND_SCALE = 0.75;
  const TIP = { x: -7, y: -4 };
  const WRIST = { x: 134, y: 6 };

  // Seconds.
  const T_ZOOM = 0.95;
  const T_REACH = 1.3;
  const T_CUT = 2.25;
  const DRAW = 0.21;
  const GAP = 0.12;
  const T_CUTS_END = T_CUT + 9 * DRAW + 8 * GAP;
  const T_SEAL = T_CUTS_END + 0.06;
  const T_PULL = T_SEAL + 0.36;
  const T_END = T_PULL + 1.5;

  const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
  const span = (t, from, to) => clamp01((t - from) / (to - from));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out = (t) => 1 - Math.pow(1 - t, 3);
  const fix = (n) => Math.round(n * 100) / 100;

  const lattice = $("#h-lattice");
  const clips = $$(".h-clip");
  const glows = $$(".h-trail");
  const cores = glows.map((glow) => {
    const core = glow.cloneNode();
    core.setAttribute("class", "h-core");
    glow.parentNode.append(core);
    return core;
  });
  for (const path of [...glows, ...cores]) path.setAttribute("pathLength", "1");
  const kanjiGroup = $("#h-kanji");
  const kanji = $$(".h-kj");
  const ring = $("#h-ring");
  const latticeGlow = $("#h-latglow-c");
  const hand = $("#h-hand");
  const tipGlow = $("#h-tip");
  const tipCore = $("#h-tipcore");
  const sleeve = $("#h-sleeve");
  const lining = $("#h-lining");
  const folds = $("#h-folds");
  const pleat = $("#h-pleat");
  const lace = $("#h-lace");
  const tipBloom = $("#h-tipbloom");
  const sparks = $("#h-sparks");
  const cords = $("#h-cords");
  const dolls = $$(".h-doll").map((el) => ({
    el,
    x: +el.dataset.x,
    y: +el.dataset.y,
    r: +el.dataset.r,
    s: +el.dataset.s,
    // where it rests on a tall, narrow stage, if that differs
    narrowY: el.dataset.ny ? +el.dataset.ny : null,
  }));
  const chant = [...hero.querySelectorAll(".hero-chant i")];
  const skip = hero.querySelector("#hero-skip");
  const replay = hero.querySelector("#hero-replay");

  // ---- camera -------------------------------------------------------------

  let width = 0;
  let height = 0;
  let shots = null;

  // Place the focus rectangle inside a part of the stage given in fractions.
  function fit(focus, area, bottom) {
    const k = Math.min(
      ((area.r - area.l) * width) / focus.w,
      ((area.b - area.t) * height) / focus.h,
    );
    const cx = focus.x + focus.w / 2 - (((area.l + area.r) / 2 - 0.5) * width) / k;
    const cy = bottom
      ? focus.y + focus.h - ((area.b - 0.5) * height) / k
      : focus.y + focus.h / 2 - (((area.t + area.b) / 2 - 0.5) * height) / k;
    return { cx, cy, k };
  }

  function measure() {
    width = stage.clientWidth || 1;
    height = stage.clientHeight || 1;
    const tall = narrow.matches;
    shots = {
      wide: fit({ x: 775, y: 60, w: 940, h: 900 }, { l: 0.04, r: 0.96, t: 0.07, b: 0.95 }),
      close: tall
        ? fit({ x: 668, y: 356, w: 330, h: 300 }, { l: 0.04, r: 0.96, t: 0.1, b: 0.88 })
        : fit({ x: 598, y: 336, w: 440, h: 330 }, { l: 0.05, r: 0.95, t: 0.1, b: 0.9 }),
      rest: tall
        ? fit({ x: 580, y: 140, w: 800, h: 640 }, { l: 0, r: 1, t: 0.1, b: 0.52 })
        : fit({ x: 578, y: 120, w: 930, h: 850 }, { l: 0.45, r: 1, t: 0.1, b: 1 }, true),
    };
  }

  function mix(a, b, t) {
    return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), k: a.k * Math.pow(b.k / a.k, t) };
  }

  function look(camera) {
    const w = width / camera.k;
    const h = height / camera.k;
    svg.setAttribute(
      "viewBox",
      `${fix(camera.cx - w / 2)} ${fix(camera.cy - h / 2)} ${fix(w)} ${fix(h)}`,
    );
  }

  // ---- what is where at a given moment -------------------------------------

  function latticeAt(t) {
    const p = inOut(span(t, T_SEAL + 0.1, T_END - 0.25));
    return {
      cx: lerp(LATTICE_CUT.cx, LATTICE_REST.cx, p),
      cy: lerp(LATTICE_CUT.cy, LATTICE_REST.cy, p),
      s: lerp(LATTICE_CUT.s, LATTICE_REST.s, p),
    };
  }

  const place = (L, [x, y]) => ({ x: L.cx + L.s * (x - 179), y: L.cy + L.s * (y - 188) });
  const cutStart = (index) => T_CUT + index * (DRAW + GAP);
  const cutProgress = (index, t) => out(span(t, cutStart(index), cutStart(index) + DRAW));

  // Fingertip position and the hand's angle. 0° points left, 90° points up.
  function handAt(t, L) {
    if (t <= T_REACH) return CHANT;
    const first = place(L, STROKES[0].a);
    if (t < T_CUT) {
      const p = inOut(span(t, T_REACH, T_CUT));
      const lift = Math.sin(p * Math.PI) * 46;
      return {
        x: lerp(CHANT.x, first.x, p),
        y: lerp(CHANT.y, first.y, p) - lift,
        a: lerp(CHANT.a, 24, p),
      };
    }
    for (let index = 0; index < 9; index++) {
      const stroke = STROKES[index];
      const t0 = cutStart(index);
      const a = place(L, stroke.a);
      const b = place(L, stroke.b);
      if (t < t0 + DRAW) {
        const p = cutProgress(index, t);
        return {
          x: lerp(a.x, b.x, p),
          y: lerp(a.y, b.y, p),
          a: stroke.row ? lerp(22, 31, p) : lerp(31, 19, p),
        };
      }
      if (index < 8 && t < t0 + DRAW + GAP) {
        const next = STROKES[index + 1];
        const to = place(L, next.a);
        const p = inOut(span(t, t0 + DRAW, t0 + DRAW + GAP));
        const swing = Math.sin(p * Math.PI) * 26;
        return {
          x: lerp(b.x, to.x, p) + (stroke.row ? swing * 0.5 : swing),
          y: lerp(b.y, to.y, p) + (stroke.row ? swing : -swing * 0.2),
          a: lerp(stroke.row ? 31 : 19, next.row ? 22 : 31, p),
        };
      }
    }
    const last = place(L, STROKES[8].b);
    if (t < T_PULL) return { x: last.x, y: last.y, a: 31 };
    const p = inOut(span(t, T_PULL, T_END - 0.3));
    const lift = Math.sin(p * Math.PI) * 30;
    return {
      x: lerp(last.x, CHANT.x, p),
      y: lerp(last.y, CHANT.y, p) - lift,
      a: lerp(31, CHANT.a, p),
    };
  }

  function handFrame(pose) {
    const c = Math.cos(pose.a * DEG);
    const s = Math.sin(pose.a * DEG);
    const ox = pose.x - (TIP.x * c - TIP.y * s) * HAND_SCALE;
    const oy = pose.y - (TIP.x * s + TIP.y * c) * HAND_SCALE;
    return {
      c,
      s,
      ox,
      oy,
      wx: ox + (WRIST.x * c - WRIST.y * s) * HAND_SCALE,
      wy: oy + (WRIST.x * s + WRIST.y * c) * HAND_SCALE,
    };
  }

  // The wide sleeve is a sheet hanging from the arm. Stretched out it is a wing
  // from shoulder to wrist; with the hand raised it is a banner below the wrist.
  // `late` is an earlier pose: the open end trails a little behind the hand.
  function drawSleeve(now, late) {
    const back = { x: now.s, y: -now.c };
    const W = { x: now.wx, y: now.wy };
    const lagX = (late.wx - now.wx) * 0.8;
    const lagY = (late.wy - now.wy) * 0.8;
    const reach = Math.hypot(W.x - SHOULDER.x, W.y - SHOULDER.y);
    const u = inOut(span(reach, 120, 250));
    const A = { x: W.x + back.x * 28, y: W.y + back.y * 28 };
    const B = { x: W.x - back.x * 31, y: W.y - back.y * 31 };
    const bend = Math.sqrt(Math.max(0, 175 * 175 - (reach / 2) * (reach / 2))) * 0.72;
    const E = { x: (SHOULDER.x + W.x) / 2 - bend * 0.1, y: (SHOULDER.y + W.y) / 2 + bend };
    const K = {
      x: B.x + lerp(-8, 10, u) + lagX * 0.9,
      y: Math.max(A.y, B.y) + lerp(212, 174, u) + lagY * 0.4,
    };
    const right = Math.max(E.x, W.x);
    const P = { x: lerp(right + 74, SHOULDER.x - 10, u), y: lerp(E.y - 8, SHOULDER.y - 30, u) };
    const Q = { x: lerp(right + 60, SHOULDER.x + 28, u), y: lerp(E.y + 118, SHOULDER.y + 200, u) };
    const mid = (a, b, dx, dy) => ({ x: (a.x + b.x) / 2 + dx, y: (a.y + b.y) / 2 + dy });
    const c1 = mid(A, P, lerp(22, 0, u), lerp(-14, 12 + bend * 0.22, u));
    const c2 = mid(P, Q, lerp(12, 4, u), 0);
    const c3 = mid(Q, K, lagX * 0.3, lerp(20, 34, u));
    const cx = (A.x + P.x + Q.x + K.x + B.x) / 5;
    const cy = (A.y + P.y + Q.y + K.y + B.y) / 5;
    const edge = mid(K, B, 0, 0);
    const away = Math.hypot(edge.x - cx, edge.y - cy) || 1;
    const nx = (edge.x - cx) / away;
    const ny = (edge.y - cy) / away;
    const c4 = { x: edge.x + nx * 7, y: edge.y + ny * 7 };
    const at = (point) => `${fix(point.x)} ${fix(point.y)}`;
    sleeve.setAttribute(
      "d",
      `M${at(A)}Q${at(c1)} ${at(P)}Q${at(c2)} ${at(Q)}Q${at(c3)} ${at(K)}Q${at(c4)} ${at(B)}Z`,
    );
    // the vermilion lining shows at the open end
    const bulge = lerp(16, 40, u);
    lining.setAttribute(
      "d",
      `M${at(B)}Q${fix(edge.x + nx * bulge)} ${fix(edge.y + ny * bulge)} ${at(K)}Q${fix(edge.x - nx * 30)} ${fix(edge.y - ny * 30)} ${at(B)}Z`,
    );
    // a hanging pleat, two folds, the lacing along the open end and its cords
    const h1 = { x: lerp(K.x, Q.x, 0.3), y: lerp(K.y, Q.y, 0.3) + 6 };
    const h2 = { x: lerp(K.x, Q.x, 0.62), y: lerp(K.y, Q.y, 0.62) + 8 };
    const top = mid(A, B, -nx * 26, -ny * 26);
    pleat.setAttribute("d", `M${at(top)}Q${fix(h1.x - 8)} ${fix((top.y + h1.y) / 2)} ${at(h1)}L${at(h2)}Q${fix(h2.x - 4)} ${fix((top.y + h2.y) / 2)} ${at(top)}Z`);
    const f1 = mid(A, P, 0, 0);
    folds.setAttribute(
      "d",
      `M${fix(lerp(f1.x, P.x, 0.5))} ${fix(lerp(f1.y, P.y, 0.5) + 16)}Q${fix((P.x + Q.x) / 2 - 24)} ${fix((P.y + Q.y) / 2)} ${fix(lerp(K.x, Q.x, 0.82))} ${fix(lerp(K.y, Q.y, 0.82) + 2)}`,
    );
    const inset = 11;
    lace.setAttribute(
      "d",
      `M${fix(B.x - nx * inset)} ${fix(B.y - ny * inset + 10)}Q${fix(c4.x - nx * inset)} ${fix(c4.y - ny * inset)} ${fix(K.x - nx * inset)} ${fix(K.y - ny * inset - 12)}`,
    );
    cords.setAttribute(
      "d",
      `M${fix(K.x - nx * 4)} ${fix(K.y - 3)}q${fix(-3 - lagX * 0.2)} 20 ${fix(-1 - lagX * 0.3)} 40` +
        `M${fix(K.x - nx * 13)} ${fix(K.y - 3)}q${fix(-1 - lagX * 0.2)} 17 ${fix(3 - lagX * 0.3)} 33`,
    );
  }

  function clipPoints(stroke, p) {
    if (p <= 0) return "0,0 0,0 0,0";
    const [x0, y0] = stroke.from;
    const [x1, y1] = stroke.to;
    const w = stroke.w;
    const over = p >= 1 ? 5 : 0;
    if (stroke.row) {
      const xe = x0 + (x1 - x0) * p + over;
      const ye = y0 + (y1 - y0) * p;
      return `${x0 - 5},${y0 - 0.8} ${fix(xe)},${fix(ye - 0.8)} ${fix(xe)},${fix(ye + w + 0.8)} ${x0 - 5},${y0 + w + 0.8}`;
    }
    const xe = x0 + (x1 - x0) * p;
    const ye = y0 + (y1 - y0) * p + over;
    return `${x0 - 0.8},${y0 - 5} ${x0 + w + 0.8},${y0 - 5} ${fix(xe + w + 0.8)},${fix(ye)} ${fix(xe - 0.8)},${fix(ye)}`;
  }

  // ---- one frame -----------------------------------------------------------

  let state = "";
  function setState(next) {
    if (next === state) return;
    state = next;
    hero.dataset.scene = next;
  }

  function render(t) {
    const L = latticeAt(t);
    lattice.setAttribute(
      "transform",
      `translate(${fix(L.cx)} ${fix(L.cy)}) scale(${fix(L.s * 1000) / 1000}) translate(-179 -188)`,
    );

    // strokes
    const sealed = t >= T_SEAL ? Math.pow(1 - span(t, T_SEAL, T_SEAL + 0.9), 2) : 0;
    let cutting = -1;
    for (let index = 0; index < 9; index++) {
      const p = cutProgress(index, t);
      clips[index].setAttribute("points", clipPoints(STROKES[index], p));
      const since = t - (cutStart(index) + DRAW);
      const fresh = p <= 0 ? 0 : since < 0 ? 1 : Math.exp(-since * 3.2);
      const heat = Math.max(fresh, sealed);
      glows[index].setAttribute("stroke-dasharray", `${fix(p)} 1`);
      cores[index].setAttribute("stroke-dasharray", `${fix(p)} 1`);
      glows[index].style.opacity = fix(heat * 0.55);
      cores[index].style.opacity = fix(Math.min(1, heat * 1.2));
      if (t >= cutStart(index)) cutting = index;
      const beat = t - cutStart(index);
      const flash = beat < 0 ? 0 : beat < 0.06 ? beat / 0.06 : Math.exp(-(beat - 0.06) * 8);
      kanji[index].style.opacity = t >= T_PULL ? 0 : fix(flash * 0.62);
    }
    kanjiGroup.setAttribute("transform", `translate(${fix(L.cx)} ${fix(L.cy)}) scale(${fix(L.s / 0.62)})`);
    chant.forEach((el, index) => {
      el.classList.toggle("on", index <= cutting);
      el.classList.toggle("now", index === cutting && t < T_SEAL);
    });

    // the seal lands
    const ripple = span(t, T_SEAL, T_SEAL + 0.8);
    ring.setAttribute("r", fix(60 + out(ripple) * 520));
    ring.style.opacity = t < T_SEAL || ripple >= 1 ? 0 : fix((1 - ripple) * 0.8);
    latticeGlow.style.opacity = fix(Math.min(1, cutProgress(8, t) * 0.5 + sealed + span(t, T_SEAL, T_END) * 0.6));

    // hand and sleeve
    const pose = handAt(t, L);
    const now = handFrame(pose);
    const late = handFrame(handAt(t - 0.13, latticeAt(t - 0.13)));
    hand.setAttribute(
      "transform",
      `translate(${fix(now.ox)} ${fix(now.oy)}) rotate(${fix(pose.a)}) scale(${HAND_SCALE})`,
    );
    drawSleeve(now, late);
    const lit = span(t, T_REACH + 0.3, T_CUT) * (1 - span(t, T_PULL, T_PULL + 0.7));
    const spark = cutting >= 0 && t < T_CUTS_END ? 1 : 0.55;
    tipGlow.style.opacity = fix(lit * spark);
    tipCore.style.opacity = fix(lit);
    tipBloom.style.opacity = fix(lit * spark * 0.7);

    // sparks fly where a cut ends, and the camera takes the blow
    let burst = "";
    let kick = 0;
    for (let index = 0; index < 9; index++) {
      const since = t - (cutStart(index) + DRAW * 0.8);
      if (since < 0 || since > 0.34) continue;
      const end = place(L, STROKES[index].b);
      const p = since / 0.34;
      const from = 10 + out(p) * 46;
      const to = from + (1 - p) * 26;
      for (let ray = 0; ray < 7; ray++) {
        const angle = (ray * 51 + index * 37 + (STROKES[index].row ? -70 : 20)) * DEG;
        const c = Math.cos(angle);
        const sn = Math.sin(angle);
        burst += `M${fix(end.x + c * from)} ${fix(end.y + sn * from)}L${fix(end.x + c * to)} ${fix(end.y + sn * to)}`;
      }
      sparks.style.opacity = fix(1 - p);
      kick = Math.max(kick, Math.exp(-since * 16));
    }
    sparks.setAttribute("d", burst);

    // paper servants leave the seal
    for (const [index, doll] of dolls.entries()) {
      const p = out(span(t, T_SEAL + index * 0.07, T_SEAL + 1.25 + index * 0.07));
      const x = lerp(L.cx, doll.x, p);
      const restY = narrow.matches && doll.narrowY !== null ? doll.narrowY : doll.y;
      const y = lerp(L.cy, restY, p) - Math.sin(p * Math.PI) * 40;
      const scale = lerp(0.08, doll.s, p);
      doll.el.setAttribute(
        "transform",
        `translate(${fix(x)} ${fix(y)}) rotate(${fix(doll.r + (1 - p) * 260)}) scale(${fix(scale * 1000) / 1000}) translate(-50 -70)`,
      );
      doll.el.style.opacity = fix(Math.min(1, p * 5));
    }

    // camera
    let camera;
    if (t < T_ZOOM) {
      camera = { ...shots.wide, k: shots.wide.k * (1 + 0.05 * (t / T_ZOOM)) };
    } else {
      const wide = { ...shots.wide, k: shots.wide.k * 1.05 };
      const follow = {
        cx: shots.close.cx + (pose.x - L.cx) * 0.1,
        cy: shots.close.cy + (pose.y - L.cy) * 0.1,
        k: shots.close.k * (1 + 0.035 * Math.sin(Math.PI * span(t, T_SEAL, T_SEAL + 0.3)) + 0.014 * kick),
      };
      camera = mix(wide, follow, inOut(span(t, T_ZOOM, T_CUT - 0.05)));
      if (t > T_PULL) camera = mix(camera, shots.rest, inOut(span(t, T_PULL, T_END)));
    }
    look(camera);
    stage.style.opacity = fix(span(t, 0, 0.45));

    setState(t < T_ZOOM + 0.25 ? "wide" : t < T_PULL ? "cut" : t < T_END ? "pull" : "rest");
  }

  // ---- running it ----------------------------------------------------------

  let frame = 0;
  let began = 0;
  let playing = false;

  function settle() {
    cancelAnimationFrame(frame);
    frame = 0;
    playing = false;
    measure();
    render(T_END);
    root.classList.remove("intro-pending", "intro-playing");
    hero.classList.remove("hero--intro");
    hero.classList.add("hero--done");
    skip.hidden = true;
    replay.hidden = reduceMotion.matches;
  }

  function tick(time) {
    const t = (time - began) / 1000;
    if (t >= T_END) {
      settle();
      return;
    }
    render(t);
    frame = requestAnimationFrame(tick);
  }

  function play() {
    cancelAnimationFrame(frame);
    measure();
    playing = true;
    root.classList.remove("intro-pending");
    root.classList.add("intro-playing");
    hero.classList.remove("hero--done");
    hero.classList.add("hero--intro");
    skip.hidden = false;
    render(0);
    began = performance.now();
    frame = requestAnimationFrame(tick);
  }

  window.kujiHeroStarted = true;
  skip.addEventListener("click", settle);
  replay.addEventListener("click", () => {
    window.scrollTo({ top: 0 });
    play();
  });
  addEventListener("keydown", (event) => {
    if (playing && event.key === "Escape") settle();
  });
  addEventListener(
    "scroll",
    () => {
      if (playing && scrollY > 24) settle();
    },
    { passive: true },
  );
  addEventListener("resize", () => {
    measure();
    if (!playing) render(T_END);
  });
  narrow.addEventListener("change", () => {
    measure();
    if (!playing) render(T_END);
  });
  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) settle();
    else replay.hidden = false;
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      hero.classList.toggle("hero--away", !entry.isIntersecting);
    }).observe(hero);
  }

  if (reduceMotion.matches || scrollY > 24 || (location.hash && location.hash !== "#top")) settle();
  else play();
})();
