"use strict";

// The opening scene: Abe no Seimei cuts the nine strokes and they become the mark.
// The scene is pictures on layers, moved by one camera. Everything is a pure
// function of time, so skipping, replaying and resizing only ever call render()
// with a different moment.
(() => {
  // Pictures are found from this script's own address, so the same script serves
  // the English page at the root and each translation one folder down.
  const here = document.currentScript ? document.currentScript.src : location.href;
  const hero = document.querySelector(".hero");
  const stage = hero && hero.querySelector(".hero-stage");
  const svg = stage && stage.querySelector("#hero-svg");
  if (!svg) return;
  const root = document.documentElement;
  // Everything the scene needs is found before anything is changed. If a piece
  // is missing, the resting frame the stylesheet lays out is left as it is.
  const need = (el, what) => {
    if (!el) throw new Error(`opening scene: no ${what}`);
    return el;
  };
  const count = (list, n, what) => {
    if (list.length !== n) throw new Error(`opening scene: ${list.length} ${what}, not ${n}`);
    return list;
  };
  const $ = (selector) => need(stage.querySelector(selector), selector);
  const $$ = (selector) => [...stage.querySelectorAll(selector)];
  const restingView = svg.getAttribute("viewBox");
  try {
    setUp();
  } catch (error) {
    root.classList.remove("intro-pending", "intro-playing");
    hero.classList.remove("hero--live", "hero--intro");
    for (const el of [stage, ...$$("img, div, span")]) {
      for (const property of ["width", "transform", "opacity"]) el.style.removeProperty(property);
    }
    svg.setAttribute("viewBox", restingView);
    console.error(error);
  }

  function setUp() {
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = matchMedia("(max-width: 820px), (max-aspect-ratio: 1/1)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

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

    // Where the mark hangs while it is cut and where it comes to rest, in the
    // scene's own units (the same units as the viewBox of #hero-svg).
    const LATTICE_CUT = { cx: 800, cy: 500, s: 0.62 };
    const LATTICE_REST = { cx: 745, cy: 470, s: 0.82 };

    // Seconds.
    const T_ZOOM = 1.1;
    const T_REACH = 1.5;
    const T_CUT = 2.4;
    const DRAW = 0.21;
    const GAP = 0.12;
    const T_CUTS_END = T_CUT + 9 * DRAW + 8 * GAP;
    const T_SEAL = T_CUTS_END + 0.06;
    const T_PULL = T_SEAL + 0.36;
    const T_END = T_PULL + 1.6;

    const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
    const span = (t, from, to) => clamp01((t - from) / (to - from));
    const lerp = (a, b, t) => a + (b - a) * t;
    const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const out = (t) => 1 - Math.pow(1 - t, 3);
    const fix = (n) => Math.round(n * 100) / 100;
    const fine = (n) => Math.round(n * 10000) / 10000;

    // ---- the layers -----------------------------------------------------------

    // Every layer says where it sits in the scene through --x, --y, --w and
    // --h on its element (the stylesheet lays the resting frame out from the same
    // numbers when this script never runs) and how far behind the figure it is
    // through data-depth: 0 is the figure's own distance, 1 is infinitely far,
    // and below 0 is nearer the lens.
    const dense = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const numbers = (el) => {
      const style = getComputedStyle(el);
      return (name) => parseFloat(style.getPropertyValue(name)) || 0;
    };
    // A picture is laid out so that one of its pixels is one pixel of the
    // screen, and only ever scaled from there: it stays as sharp as it was made
    // however far the camera goes in.
    const ownWidth = (img) => {
      const laid = +img.getAttribute("width") / dense;
      if (!(laid > 0)) throw new Error("opening scene: a picture without a width");
      return laid;
    };
    const layers = $$(".hs-l").map((el) => {
      const number = numbers(el);
      return {
        el,
        x: number("--x"),
        y: number("--y"),
        w: number("--w"),
        h: number("--h"),
        depth: parseFloat(el.dataset.depth || "0"),
        natural: el.tagName === "IMG" ? ownWidth(el) : number("--n") || number("--w"),
      };
    });
    const sky = $("#hs-sky");
    const skySoft = $("#hs-sky-soft");
    const seimei = $("#hs-seimei");
    const seimeiSoft = $("#hs-seimei-soft");
    const handEl = $("#hs-hand");
    const handLit = $("#hs-hand-lit");
    const veil = $("#hs-veil");

    // The cutting hand: one drawing that turns about its fingertip.
    const HAND = {
      tipX: +handEl.dataset.tipX / dense,
      tipY: +handEl.dataset.tipY / dense,
      // the way the fingers point in the drawing: 0° is left, 90° is up
      angle: +handEl.dataset.angle,
      // scene units per laid-out pixel of the drawing
      unit: +handEl.dataset.unit * dense,
    };
    if (![HAND.tipX, HAND.tipY, HAND.angle, HAND.unit].every(Number.isFinite)) {
      throw new Error("opening scene: the hand's numbers are missing");
    }
    const pictures = [...layers.filter((layer) => layer.el.tagName === "IMG").map((layer) => layer.el), handEl, handLit];
    // the light on the fingers is a smaller picture of the same hand, cut from
    // the same corner, so the fingertip is at the same pixel in both
    handLit.style.setProperty("--tx", `${fix((+handEl.dataset.tipX / +handLit.getAttribute("width")) * 100)}%`);
    handLit.style.setProperty("--ty", `${fix((+handEl.dataset.tipY / +handLit.getAttribute("height")) * 100)}%`);
    handLit.style.setProperty("--tr", `${fix(ownWidth(handEl) * 0.44)}px`);

    const lattice = $("#h-lattice");
    const clips = count($$(".h-clip"), 9, "clipping shapes");
    const cores = count($$(".h-core"), 9, "strokes");
    for (const path of cores) path.setAttribute("pathLength", "1");
    // The light around a stroke is three pictures of a glow: a cap, a middle that
    // stretches as the stroke grows, and the cap again turned round at the head.
    // No blur has to be worked out while the scene runs.
    const GLOW = 104; // how far the light reaches from the stroke, in the mark's units
    const INSET = 12;
    const svgEl = (name, attributes) => {
      const el = document.createElementNS("http://www.w3.org/2000/svg", name);
      for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
      return el;
    };
    const halos = STROKES.map((stroke) => {
      const [ax, ay] = stroke.a;
      const [bx, by] = stroke.b;
      // the light starts and stops a little inside the stroke, so that its hot
      // ends lie under the mark and only the travelling head shows
      const length = Math.hypot(bx - ax, by - ay);
      const group = svgEl("g", {
        class: "h-halo",
        transform: `translate(${ax} ${ay}) rotate(${fix((Math.atan2(by - ay, bx - ax) * 180) / Math.PI)}) translate(${INSET} 0)`,
      });
      const piece = (file, width) =>
        svgEl("image", {
          href: new URL(`assets/photo/${file}`, here).href,
          x: 0,
          y: -GLOW,
          width,
          height: GLOW * 2,
          preserveAspectRatio: "none",
        });
      const tail = piece("glow-cap.png", GLOW);
      tail.setAttribute("x", -GLOW);
      const body = piece("glow-mid.png", 0);
      const head = piece("glow-cap.png", GLOW);
      group.append(tail, body, head);
      $("#h-halos").append(group);
      return { group, body, head, length };
    });
    const kanjiGroup = $("#h-kanji");
    const kanji = count($$(".h-kj"), 9, "characters");
    const ring = $("#h-ring");
    const flash = $("#h-flash");
    const latticeGlow = $("#h-latglow-c");
    const markImage = $("#h-mark");
    const sparks = $("#h-sparks");
    const sparksGlow = $("#h-sparks-glow");
    const dolls = $$(".hs-doll").map((el) => {
      const number = numbers(el);
      return {
        el,
        x: number("--x"),
        y: number("--y"),
        r: number("--r"),
        s: number("--s"),
        depth: parseFloat(el.dataset.depth || "0"),
        // where it rests on a tall, narrow stage, if that differs
        narrowY: number("--ny") || null,
      };
    });
    const chant = [...hero.querySelectorAll(".hero-chant i")];
    const skip = need(hero.querySelector("#hero-skip"), "skip button");
    const replay = need(hero.querySelector("#hero-replay"), "replay button");

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
      // On a wide stage the scene at rest keeps to the right of the words: of
      // the page's side padding and the widest line of the introduction.
      const pad = Math.min(110, Math.max(22, 0.063 * width));
      const from = Math.min(0.6, Math.max(0.45, (pad + 450) / width));
      shots = {
        wide: tall
          ? fit({ x: 930, y: 110, w: 620, h: 900 }, { l: 0, r: 1, t: 0.08, b: 0.9 })
          : fit({ x: 775, y: 90, w: 940, h: 900 }, { l: 0.04, r: 0.96, t: 0.06, b: 1 }, true),
        // The close shot keeps the mark toward the right of the frame, so that
        // the sleeve always leaves the picture however far the hand reaches.
        close: tall
          ? fit({ x: 668, y: 372, w: 300, h: 256 }, { l: 0.03, r: 1, t: 0.1, b: 0.86 })
          : fit({ x: 640, y: 356, w: 330, h: 288 }, { l: 0.24, r: 1, t: 0.1, b: 0.9 }),
        rest: tall
          ? fit({ x: 580, y: 140, w: 800, h: 640 }, { l: 0, r: 1, t: 0.1, b: 0.52 })
          : fit({ x: 578, y: 120, w: 930, h: 850 }, { l: from, r: 1, t: 0.1, b: 1 }, true),
      };
    }

    function mix(a, b, t) {
      return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), k: a.k * Math.pow(b.k / a.k, t) };
    }

    // What the camera is for something at another distance: far things move and
    // grow less than the figure, near things more. At rest every distance agrees.
    function seenAt(camera, depth) {
      if (!depth) return camera;
      const near = 1 - depth;
      const rest = shots.rest;
      return {
        cx: rest.cx + (camera.cx - rest.cx) * near,
        cy: rest.cy + (camera.cy - rest.cy) * near,
        k: rest.k * Math.pow(camera.k / rest.k, near),
      };
    }

    function look(camera) {
      const w = width / camera.k;
      const h = height / camera.k;
      svg.setAttribute(
        "viewBox",
        `${fix(camera.cx - w / 2)} ${fix(camera.cy - h / 2)} ${fix(w)} ${fix(h)}`,
      );
      for (const layer of layers) {
        const c = seenAt(camera, layer.depth);
        const s = (c.k * layer.w) / layer.natural;
        layer.el.style.transform = `matrix(${fine(s)},0,0,${fine(s)},${fix((layer.x - c.cx) * c.k + width / 2)},${fix((layer.y - c.cy) * c.k + height / 2)})`;
      }
    }

    // ---- what is where at a given moment -------------------------------------

    function latticeAt(t) {
      // it goes to its resting place as the camera pulls back, and no sooner:
      // on a narrow stage it would leave the frame if it went ahead
      const p = inOut(span(t, T_PULL, T_END));
      return {
        cx: lerp(LATTICE_CUT.cx, LATTICE_REST.cx, p),
        cy: lerp(LATTICE_CUT.cy, LATTICE_REST.cy, p),
        s: lerp(LATTICE_CUT.s, LATTICE_REST.s, p),
      };
    }

    const place = (L, [x, y]) => ({ x: L.cx + L.s * (x - 179), y: L.cy + L.s * (y - 188) });
    const cutStart = (index) => T_CUT + index * (DRAW + GAP);
    const cutProgress = (index, t) => out(span(t, cutStart(index), cutStart(index) + DRAW));

    // Fingertip position, the hand's angle (0° points left, 90° points up) and
    // how much of the hand is in the picture.
    function handAt(t, L) {
      const first = place(L, STROKES[0].a);
      if (t < T_CUT) {
        // it comes in from beyond the right edge, low, and rises to the first
        // stroke; it sets out once the figure has gone out of focus
        const p = out(span(t, T_REACH + 0.3, T_CUT));
        return {
          x: lerp(first.x + 600, first.x, p),
          y: lerp(first.y + 130, first.y, p) - Math.sin(p * Math.PI) * 22,
          a: lerp(8, 23, p),
          on: t < T_REACH + 0.3 ? 0 : 1,
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
            a: stroke.row ? lerp(22, 29, p) : lerp(30, 20, p),
            on: 1,
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
            a: lerp(stroke.row ? 29 : 20, next.row ? 22 : 30, p),
            on: 1,
          };
        }
      }
      // the last stroke ends at the right; the hand leaves the way it came
      const last = place(L, STROKES[8].b);
      const p = inOut(span(t, T_SEAL + 0.12, T_PULL + 0.5));
      return {
        x: last.x + p * 230,
        y: last.y + p * 70 - Math.sin(p * Math.PI) * 14,
        a: lerp(29, 10, p),
        on: 1 - span(t, T_PULL - 0.1, T_PULL + 0.38),
      };
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

    // paper servants leave the seal
    function placeDolls(t, L, camera) {
      for (const [index, doll] of dolls.entries()) {
        const p = out(span(t, T_SEAL + index * 0.07, T_SEAL + 1.25 + index * 0.07));
        const restY = narrow.matches && doll.narrowY !== null ? doll.narrowY : doll.y;
        const x = lerp(L.cx, doll.x, p);
        const y = lerp(L.cy, restY, p) - Math.sin(p * Math.PI) * 40;
        const c = seenAt(camera, doll.depth * p);
        const scale = lerp(0.08, doll.s, p) * c.k;
        doll.el.style.transform = `translate(${fix((x - c.cx) * c.k + width / 2)}px,${fix((y - c.cy) * c.k + height / 2)}px) rotate(${fix(doll.r + (1 - p) * 260)}deg) scale(${fine(scale)})`;
        doll.el.style.opacity = fix(Math.min(1, p * 5));
      }
    }

    let state = "";
    function setState(next) {
      if (next === state) return;
      state = next;
      hero.dataset.scene = next;
    }

    // `lean` is a small push of the camera at rest, from the pointer.
    function render(t, lean) {
      const L = latticeAt(t);
      lattice.setAttribute(
        "transform",
        `translate(${fix(L.cx)} ${fix(L.cy)}) scale(${fix(L.s * 1000) / 1000}) translate(-179 -188)`,
      );

      // strokes: each is drawn white-hot, glows vermilion, and cools into the mark
      const sealed = t >= T_SEAL ? Math.pow(1 - span(t, T_SEAL, T_SEAL + 0.9), 2) : 0;
      let cutting = -1;
      let heatSum = 0;
      for (let index = 0; index < 9; index++) {
        const p = cutProgress(index, t);
        clips[index].setAttribute("points", clipPoints(STROKES[index], p));
        const since = t - (cutStart(index) + DRAW);
        const fresh = p <= 0 ? 0 : since < 0 ? 1 : Math.exp(-since * 3.2);
        const heat = Math.max(fresh, sealed);
        heatSum += heat;
        cores[index].setAttribute("stroke-dasharray", `${fix(p)} 1`);
        cores[index].style.opacity = fix(Math.min(1, heat * 1.25));
        const halo = halos[index];
        const reach = fix(Math.max(0, Math.min(halo.length * p, halo.length - INSET) - INSET));
        halo.body.setAttribute("width", reach);
        halo.head.setAttribute("transform", `translate(${reach + GLOW} 0) scale(-1 1)`);
        halo.group.style.opacity = p <= 0 ? 0 : fix(heat);
        if (t >= cutStart(index)) cutting = index;
        const beat = t - cutStart(index);
        const flash = beat < 0 ? 0 : beat < 0.06 ? beat / 0.06 : Math.exp(-(beat - 0.06) * 8);
        kanji[index].style.opacity = t >= T_PULL ? 0 : fix(flash * 0.5);
      }
      kanjiGroup.setAttribute("transform", `translate(${fix(L.cx)} ${fix(L.cy)}) scale(${fix(L.s / 0.62)})`);
      chant.forEach((el, index) => {
        el.classList.toggle("on", index <= cutting);
        el.classList.toggle("now", index === cutting && t < T_SEAL);
      });

      // the seal lands
      const ripple = span(t, T_SEAL, T_SEAL + 0.8);
      ring.setAttribute("r", fix(60 + out(ripple) * 520));
      ring.style.opacity = t < T_SEAL || ripple >= 1 ? 0 : fix((1 - ripple) * 0.45);
      // and for an instant everything is light
      const sinceSeal = t - T_SEAL;
      flash.style.opacity = sinceSeal < 0 ? 0 : fix(sinceSeal < 0.05 ? sinceSeal / 0.05 : Math.exp(-(sinceSeal - 0.05) * 7));
      const settled = span(t, T_SEAL, T_END);
      latticeGlow.style.opacity = fix(Math.min(1, heatSum * 0.14 + sealed * 0.6 + settled * 0.5));
      // the mark itself is hot while it is new
      markImage.style.opacity = fix(1 - 0.12 * (1 - settled));

      // sparks fly where a cut ends, and the camera takes the blow
      let burst = "";
      let kick = 0;
      let sparkOpacity = 0;
      for (let index = 0; index < 9; index++) {
        const since = t - (cutStart(index) + DRAW * 0.8);
        if (since < 0 || since > 0.4) continue;
        const end = place(L, STROKES[index].b);
        const p = since / 0.4;
        for (let ray = 0; ray < 11; ray++) {
          // each ember has its own speed, leaves a streak behind it and falls a
          // little as it flies
          const seed = ((ray * 73 + index * 151) % 97) / 97;
          const angle = (ray * 33 + index * 37 + seed * 20 + (STROKES[index].row ? -70 : 20)) * (Math.PI / 180);
          const reach = (14 + seed * 66) * out(p);
          const streak = (10 + seed * 30) * (1 - p) * (1 - p);
          const c = Math.cos(angle);
          const sn = Math.sin(angle);
          const fall = 22 * p * p;
          burst += `M${fix(end.x + c * (reach - streak))} ${fix(end.y + sn * (reach - streak) + fall)}L${fix(end.x + c * reach)} ${fix(end.y + sn * reach + fall)}`;
        }
        sparkOpacity = Math.max(sparkOpacity, 1 - p * p);
        kick = Math.max(kick, Math.exp(-since * 16));
      }
      sparks.setAttribute("d", burst);
      sparksGlow.setAttribute("d", burst);
      sparks.style.opacity = fix(sparkOpacity);
      sparksGlow.style.opacity = fix(sparkOpacity * 0.5);

      // camera
      const pose = handAt(t, L);
      let camera;
      let near = 0; // 0 in the wide and resting shots, 1 in the close shot
      if (t < T_ZOOM) {
        camera = { ...shots.wide, k: shots.wide.k * (1 + 0.06 * (t / T_ZOOM)) };
      } else {
        const wide = { ...shots.wide, k: shots.wide.k * 1.06 };
        const follow = {
          cx: shots.close.cx + (pose.x - L.cx) * 0.12,
          cy: shots.close.cy + (pose.y - L.cy) * 0.12,
          k: shots.close.k * (1 + 0.035 * Math.sin(Math.PI * span(t, T_SEAL, T_SEAL + 0.3)) + 0.014 * kick),
        };
        near = inOut(span(t, T_ZOOM, T_CUT - 0.1));
        camera = mix(wide, follow, near);
        if (t > T_PULL) {
          const back = inOut(span(t, T_PULL, T_END));
          camera = mix(camera, shots.rest, back);
          near = 1 - back;
        }
      }
      if (lean) camera = { cx: camera.cx + lean.x, cy: camera.cy + lean.y, k: camera.k };
      look(camera);

      // focus: going in, the figure and the sky fall out of focus behind the hand
      const soft = span(near, 0.12, 0.62);
      skySoft.style.opacity = fix(soft);
      sky.style.opacity = soft >= 1 ? 0 : 1;
      // the out-of-focus figure is whole before the sharp one over it lets go,
      // so the moon never shows through him
      seimeiSoft.style.opacity = fix(span(near, 0.08, 0.3) * (1 - 0.25 * span(near, 0.6, 1)));
      seimei.style.opacity = fix(1 - span(near, 0.3, 0.58));
      veil.style.opacity = fix(0.34 * span(near, 0.3, 1));

      // the hand
      const lit = span(t, T_CUT - 0.25, T_CUT) * (1 - span(t, T_SEAL + 0.1, T_PULL + 0.3));
      const flare = cutting >= 0 && t < T_CUTS_END ? 1 : 0.6;
      const shown = pose.on;
      if (shown <= 0) {
        handEl.style.opacity = 0;
        handLit.style.opacity = 0;
      } else {
        const turn = pose.a - HAND.angle;
        const scale = HAND.unit * camera.k;
        const transform = `translate(${fix((pose.x - camera.cx) * camera.k + width / 2)}px,${fix((pose.y - camera.cy) * camera.k + height / 2)}px) rotate(${fix(turn)}deg) scale(${fine(scale)}) translate(${-HAND.tipX}px,${-HAND.tipY}px)`;
        handEl.style.transform = transform;
        handLit.style.transform = transform;
        handEl.style.opacity = fix(shown);
        handLit.style.opacity = fix(shown * lit * flare);
      }

      placeDolls(t, L, camera);

      stage.style.opacity = fix(span(t, 0, 0.5));
      setState(t < T_ZOOM + 0.25 ? "wide" : t < T_PULL ? "cut" : t < T_END ? "pull" : "rest");
    }

    // ---- running it ----------------------------------------------------------

    let frame = 0;
    let began = 0;
    let playing = false;
    // true until the scene has either started or gone to rest for the first time
    let undecided = true;
    // true while a replay asked for from the keyboard holds the focus on Skip
    let heldFocus = false;

    // At rest the camera leans a few units toward the pointer, so the layers part.
    const lean = { x: 0, y: 0, toX: 0, toY: 0, frame: 0 };
    function leanStep() {
      lean.frame = 0;
      if (playing) return;
      lean.x += (lean.toX - lean.x) * 0.07;
      lean.y += (lean.toY - lean.y) * 0.07;
      const still = Math.abs(lean.toX - lean.x) < 0.02 && Math.abs(lean.toY - lean.y) < 0.02;
      if (still) {
        lean.x = lean.toX;
        lean.y = lean.toY;
      }
      // only the camera moves: the mark stays as the last frame drew it
      const camera = { cx: shots.rest.cx + lean.x, cy: shots.rest.cy + lean.y, k: shots.rest.k };
      look(camera);
      placeDolls(T_END, latticeAt(T_END), camera);
      if (!still) lean.frame = requestAnimationFrame(leanStep);
    }
    function leanTo(x, y) {
      lean.toX = x;
      lean.toY = y;
      if (!lean.frame && !playing) lean.frame = requestAnimationFrame(leanStep);
    }
    hero.addEventListener("pointermove", (event) => {
      if (playing || reduceMotion.matches || !finePointer.matches || event.pointerType !== "mouse") return;
      const box = hero.getBoundingClientRect();
      leanTo(((event.clientX - box.left) / box.width - 0.5) * 26, ((event.clientY - box.top) / box.height - 0.5) * 14);
    });
    hero.addEventListener("pointerleave", () => leanTo(0, 0));

    function settle() {
      undecided = false;
      cancelAnimationFrame(frame);
      frame = 0;
      playing = false;
      lean.x = lean.y = lean.toX = lean.toY = 0;
      measure();
      render(T_END);
      root.classList.remove("intro-pending", "intro-playing");
      hero.classList.remove("hero--intro");
      hero.classList.add("hero--done");
      const focused = heldFocus || document.activeElement === skip;
      heldFocus = false;
      skip.hidden = true;
      replay.hidden = reduceMotion.matches;
      if (focused && !replay.hidden) replay.focus({ preventScroll: true });
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
      undecided = false;
      cancelAnimationFrame(frame);
      measure();
      playing = true;
      root.classList.remove("intro-pending");
      root.classList.add("intro-playing");
      hero.classList.remove("hero--done");
      hero.classList.add("hero--intro");
      skip.hidden = false;
      // the words are hidden while the scene plays, and the focus with them:
      // hand it to Skip, and give it back when the scene is over
      if (hero.contains(document.activeElement) && document.activeElement !== skip) {
        heldFocus = true;
        skip.focus({ preventScroll: true });
      }
      render(0);
      began = performance.now();
      frame = requestAnimationFrame(tick);
    }

    for (const img of pictures) img.style.width = `${ownWidth(img)}px`;
    hero.classList.add("hero--live");
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
      if (!playing) render(T_END, lean);
    });
    narrow.addEventListener("change", () => {
      measure();
      if (!playing) render(T_END, lean);
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

    // The scene is pictures, so it opens when they have arrived and can be drawn.
    // If one is slow or fails, the words do not wait: the scene goes straight to
    // rest. The page's head gave the words four seconds in all; whatever of that
    // is left is the longest the pictures are waited for.
    const wanted = () =>
      !reduceMotion.matches && scrollY <= 24 && (!location.hash || location.hash === "#top");
    const left = (window.kujiIntroBy || 0) - Date.now();
    measure();
    window.kujiHeroStarted = true;
    if (!wanted() || left <= 0 || !root.classList.contains("intro-pending")) {
      settle();
    } else {
      const drawn = (img) =>
        img.decode
          ? img.decode()
          : new Promise((yes, no) => {
              if (img.complete) (img.naturalWidth ? yes : no)();
              else {
                img.addEventListener("load", yes, { once: true });
                img.addEventListener("error", no, { once: true });
              }
            });
      const begin = (start) => {
        if (!undecided) return;
        if (start && wanted()) play();
        else settle();
      };
      Promise.all([sky, skySoft, seimei, seimeiSoft, handEl].map(drawn)).then(
        () => begin(true),
        () => begin(false),
      );
      setTimeout(() => begin(false), Math.min(2600, left));
    }
  }
})();
