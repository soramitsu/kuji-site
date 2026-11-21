"use strict";

(() => {
  const root = document.documentElement;
  root.classList.add("js");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const hasObserver = "IntersectionObserver" in window;

  /* ---------- Header: background once scrolled, progress hairline ---------- */
  const mast = document.querySelector(".mast");
  const system = document.querySelector(".system");
  const contact = document.querySelector(".contact");
  let frame = 0;

  function paint() {
    frame = 0;
    const y = window.scrollY;
    mast.classList.toggle("is-scrolled", y > 24);
    const max = root.scrollHeight - window.innerHeight;
    mast.style.setProperty(
      "--progress",
      max > 0 ? Math.min(1, y / max).toFixed(4) : "0",
    );
    if (reduceMotion.matches) return;
    if (system && system.classList.contains("is-live")) {
      const top = system.getBoundingClientRect().top;
      system.style.setProperty(
        "--spin",
        ((window.innerHeight - top) * 0.035).toFixed(2),
      );
    }
    if (contact && contact.classList.contains("is-live")) {
      const box = contact.getBoundingClientRect();
      const offset =
        (box.top + box.height / 2 - window.innerHeight / 2) /
        window.innerHeight;
      contact.style.setProperty(
        "--sy",
        Math.max(-1, Math.min(1, offset)).toFixed(3),
      );
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  reduceMotion.addEventListener("change", () => {
    system?.style.removeProperty("--spin");
    contact?.style.removeProperty("--sy");
    schedule();
  });
  schedule();

  /* ---------- Header: mark the section being read ---------- */
  const navTargets = new Map();
  for (const link of mast.querySelectorAll('nav a[href^="#"]')) {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) navTargets.set(target, link);
  }
  if (hasObserver) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          navTargets
            .get(entry.target)
            .classList.toggle("is-current", entry.isIntersecting);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    navTargets.forEach((_, target) => navObserver.observe(target));
  }

  /* ---------- Loops run only while their section is on screen ---------- */
  const liveObserver = hasObserver
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            entry.target.classList.toggle("is-live", entry.isIntersecting);
          schedule();
        },
        { rootMargin: "120px 0px" },
      )
    : null;
  document.querySelectorAll("[data-live]").forEach((element) => {
    if (liveObserver) liveObserver.observe(element);
    else element.classList.add("is-live");
  });

  /* ---------- Reveal on scroll ---------- */
  const revealHooks = new Map();
  function reveal(element) {
    element.classList.add("is-in");
    const hook = revealHooks.get(element);
    if (hook) hook();
  }

  /* Evidence drawings: play when the card arrives, again on hover */
  document.querySelectorAll(".evi").forEach((card, index) => {
    const drawing = card.querySelector(".vis");
    if (!drawing) return;
    let busyUntil = 0;
    const play = (base) => {
      if (reduceMotion.matches) return;
      drawing.style.setProperty("--base", base + "s");
      drawing.classList.remove("play");
      void drawing.getBoundingClientRect();
      drawing.classList.add("play");
      busyUntil = performance.now() + (base + 3.9) * 1000;
    };
    revealHooks.set(card, () => play(0.55 + index * 0.15));
    card.addEventListener("pointerenter", () => {
      if (card.classList.contains("is-in") && performance.now() > busyUntil)
        play(0);
    });
  });

  /* ---------- The ransomware playback ---------- */
  const stage = document.querySelector("#stage");
  const replay = document.querySelector("#replay");
  const status = document.querySelector("#play-status");
  if (stage && replay && status) {
    const TOTAL = 294;
    const lines = [...stage.querySelectorAll(".ln")];
    const [command, note, blank, header, firstFinding, secondFinding] = lines;
    /* What the behavior model adds after the findings: its count, then its advisory. */
    const [modelCount, ...modelAdvisory] = lines.filter((line) =>
      line.classList.contains("ln-model"),
    );
    const typedLength =
      Number(getComputedStyle(command).getPropertyValue("--n")) ||
      command.querySelector(".typed").textContent.length;
    const marks = stage.querySelector(".marks");
    const counter = stage.querySelector(".count-num");
    const slips = [...stage.querySelectorAll(".slip")];
    const replayLabel = replay.querySelector(".replay-label");

    /* One mark per simulated event; they carry no labels. */
    let seed = 20261121;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < TOTAL; index++) {
      const mark = document.createElement("i");
      mark.style.setProperty("--i", index);
      mark.style.setProperty("--r", (random() * 50 - 25).toFixed(1) + "deg");
      fragment.append(mark);
    }
    marks.append(fragment);
    marks.classList.add("has-marks");

    let timers = [];
    let reading = 0;
    let playing = false;
    const at = (delay, action) => timers.push(setTimeout(action, delay));
    const setRead = (value) => {
      marks.style.setProperty("--read", value.toFixed(2));
      counter.textContent = String(
        Math.max(0, Math.min(TOTAL, Math.floor(value))),
      ).padStart(3, "0");
    };
    const thunk = () => {
      stage.classList.remove("thunk");
      void stage.offsetWidth;
      stage.classList.add("thunk");
    };
    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimationFrame(reading);
    };

    function finish() {
      stop();
      playing = false;
      stage.classList.remove("is-playing", "is-typing");
      lines.forEach((line) => line.classList.add("on"));
      slips.forEach((slip) => slip.classList.add("on", "stamped"));
      command.style.setProperty("--k", typedLength);
      marks.style.setProperty("--read", TOTAL + 40);
      counter.textContent = String(TOTAL);
      status.textContent = "294 events · 2 findings";
      replayLabel.textContent = "Replay";
      replay.disabled = false;
    }

    function arm() {
      stop();
      stage.classList.add("is-armed");
      stage.classList.remove("is-playing");
      lines.forEach((line) => line.classList.remove("on"));
      command.classList.add("on");
      slips.forEach((slip) => slip.classList.remove("on", "stamped"));
      command.style.setProperty("--k", 0);
      setRead(-20);
    }

    function play() {
      if (reduceMotion.matches) {
        finish();
        return;
      }
      arm();
      playing = true;
      stage.classList.add("is-playing", "is-typing");
      status.textContent = "Reading simulated events…";
      replayLabel.textContent = "Playing";
      replay.disabled = true;

      let time = 380;
      for (let typed = 1; typed <= typedLength; typed++) {
        at(time, () => command.style.setProperty("--k", typed));
        time += 36 + (typed % 4 === 0 ? 34 : 0);
      }
      time += 300;
      at(time, () => {
        stage.classList.remove("is-typing");
        note.classList.add("on");
      });
      time += 450;
      const duration = 2600;
      at(time, () => {
        const start = performance.now();
        const step = (now) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased =
            progress < 0.5
              ? 2 * progress * progress
              : 1 - (-2 * progress + 2) ** 2 / 2;
          setRead(eased * (TOTAL + 20));
          if (progress < 1) reading = requestAnimationFrame(step);
        };
        reading = requestAnimationFrame(step);
      });
      time += duration + 260;
      at(time, () => {
        blank.classList.add("on");
        header.classList.add("on");
      });
      time += 620;
      at(time, () => {
        firstFinding.classList.add("on");
        slips[0].classList.add("on");
      });
      time += 380;
      at(time, () => {
        slips[0].classList.add("stamped");
        thunk();
      });
      time += 640;
      at(time, () => {
        secondFinding.classList.add("on");
        slips[1].classList.add("on");
      });
      time += 380;
      at(time, () => {
        slips[1].classList.add("stamped");
        thunk();
      });
      time += 760;
      at(time, () => modelCount?.classList.add("on"));
      time += 460;
      at(time, () => modelAdvisory.forEach((line) => line.classList.add("on")));
      time += 900;
      at(time, finish);
    }

    replay.hidden = false;
    replay.addEventListener("click", play);
    reduceMotion.addEventListener("change", () => {
      if (reduceMotion.matches && playing) finish();
    });

    /* Autoplay once, when the playback first comes into view. */
    if (hasObserver && !reduceMotion.matches) {
      arm();
      const autoplay = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          autoplay.disconnect();
          play();
        },
        { threshold: 0.3 },
      );
      autoplay.observe(stage);
    }
  }

  /* ---------- Copy the demo command ---------- */
  const copy = document.querySelector("#copy");
  const commandText = document.querySelector("#command");
  const copyStatus = document.querySelector("#copy-status");
  if (copy && commandText && copyStatus) {
    copy.hidden = false;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(commandText.textContent);
        copy.textContent = "Copied";
        copyStatus.textContent = "Demo command copied.";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(commandText);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copyStatus.textContent =
          "Command selected. Use your device’s copy command.";
        copy.textContent = "Selected";
      }
    });
  }

  /* ---------- The app screenshot leans toward the pointer ---------- */
  const appStage = document.querySelector(".app-stage");
  if (appStage) {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let tiltFrame = 0;
    const tilt = () => {
      tiltFrame = 0;
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      appStage.style.setProperty("--tx", currentX.toFixed(3));
      appStage.style.setProperty("--ty", currentY.toFixed(3));
      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.002)
        tiltFrame = requestAnimationFrame(tilt);
    };
    appStage.addEventListener("pointermove", (event) => {
      if (!finePointer.matches || reduceMotion.matches) return;
      const box = appStage.getBoundingClientRect();
      targetX = ((event.clientX - box.left) / box.width) * 2 - 1;
      targetY = ((event.clientY - box.top) / box.height) * 2 - 1;
      if (!tiltFrame) tiltFrame = requestAnimationFrame(tilt);
    });
    appStage.addEventListener("pointerleave", () => {
      targetX = targetY = 0;
      if (!tiltFrame) tiltFrame = requestAnimationFrame(tilt);
    });
  }

  /* ---------- Start observing reveals last, once every hook exists ---------- */
  const revealed = document.querySelectorAll("[data-reveal]");
  if (hasObserver && !reduceMotion.matches) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          revealObserver.unobserve(entry.target);
          reveal(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    revealed.forEach((element) => revealObserver.observe(element));
  } else {
    revealed.forEach(reveal);
  }
})();
