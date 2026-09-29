(() => {
  "use strict";

  const NAME = "angelika";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {  } },
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg, ms = 2400) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
  }

  let soundOn = store.get("sound") === "1";
  let audio;
  const soundBtn = $("#soundToggle");
  soundBtn.setAttribute("aria-pressed", soundOn);
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    store.set("sound", soundOn ? "1" : "0");
    soundBtn.setAttribute("aria-pressed", soundOn);
    if (soundOn) click(true);
  });
  function click(heavy = false) {
    if (!soundOn) return;
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const len = audio.sampleRate * 0.035;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = audio.createBufferSource();
    src.buffer = buf;
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = (heavy ? 1400 : 2600) + Math.random() * 900;
    bp.Q.value = 1.2;
    const g = audio.createGain();
    g.gain.value = 0.5;
    src.connect(bp).connect(g).connect(audio.destination);
    src.start(t);
    const o = audio.createOscillator();
    const og = audio.createGain();
    o.frequency.setValueAtTime(heavy ? 110 : 170, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.06);
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(og).connect(audio.destination);
    o.start(t); o.stop(t + 0.08);
  }

  function visualDown(code) {
    window.KB?.down(code);
    $$(`[data-key="${code}"]`).forEach((el) => el.classList.add("down"));
  }
  function visualUp(code) {
    window.KB?.up(code);
    $$(`[data-key="${code}"]`).forEach((el) => el.classList.remove("down"));
  }
  function tap(code, hold = 90) {
    visualDown(code);
    click(code === "Space" || code === "Enter" || code === "Backspace");
    setTimeout(() => visualUp(code), hold);
  }

  const typedEl = $("#typed");
  let text = "";
  let autoOwned = false;
  let session = 0;
  let idleTimer;
  let heroVisible = true;
  new IntersectionObserver(([e]) => (heroVisible = e.isIntersecting), { threshold: 0.35 }).observe($(".hero"));

  const render = () => (typedEl.textContent = text);

  const PL = { "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z" };
  function codeFor(ch) {
    const low = ch.toLowerCase();
    const base = PL[low] || low;
    if (/[a-z]/.test(base)) return { code: "Key" + base.toUpperCase(), shift: ch !== low, altgr: !!PL[low] };
    if (/[0-9]/.test(ch)) return { code: "Digit" + ch };
    if (ch === " ") return { code: "Space" };
    return { code: { "-": "Minus", "=": "Equal", ",": "Comma", ".": "Period", "/": "Slash", ";": "Semicolon", "'": "Quote" }[ch] };
  }

  async function autoType(str, my) {
    autoOwned = true;
    root.classList.add("typing");
    for (const ch of str) {
      if (my !== session) return false;
      const k = codeFor(ch);
      if (k.shift) visualDown("ShiftLeft");
      if (k.altgr) visualDown("AltRight");
      if (k.code) tap(k.code, 80);
      text += ch; render();
      await sleep(70);
      if (k.shift) visualUp("ShiftLeft");
      if (k.altgr) visualUp("AltRight");
      await sleep(reducedMotion ? 10 : 60 + Math.random() * 110);
    }
    root.classList.remove("typing");
    return true;
  }
  async function autoErase(my) {
    autoOwned = true;
    root.classList.add("typing");
    while (text.length && my === session) {
      tap("Backspace", 50);
      text = text.slice(0, -1); render();
      await sleep(reducedMotion ? 5 : 45);
    }
    root.classList.remove("typing");
  }
  async function restoreName() {
    const my = ++session;
    if (text === NAME) return;
    await autoErase(my);
    if (my !== session) return;
    await sleep(250);
    await autoType(NAME, my);
  }
  function scheduleRestore() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(restoreName, 4500);
  }
  function humanType(ch) {
    if (autoOwned) { text = ""; autoOwned = false; }
    session++;
    root.classList.remove("typing");
    if (ch === "\b") text = text.slice(0, -1);
    else text = (text + ch).slice(-24);
    render();
    scheduleRestore();
  }

  let started = false;
  const start = () => { if (started) return; started = true; autoType(NAME, ++session); };
  addEventListener("kb:ready", () => setTimeout(start, 250));
  setTimeout(start, 3500);

  const SECTIONS = { Digit1: "#about", Digit2: "#projects", Digit3: "#contact" };
  const EMAIL = $("#enterKey").dataset.email;
  const scrollTo = (sel) => $(sel).scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });

  async function copyEmail() {
    tap("Enter", 140);
    try {
      await navigator.clipboard.writeText(EMAIL);
      toast("✓ Copied " + EMAIL);
    } catch {
      location.href = "mailto:" + EMAIL;
    }
  }
  $("#enterKey").addEventListener("click", copyEmail);

  function action(code, ch) {
    if (SECTIONS[code]) { scrollTo(SECTIONS[code]); return true; }
    if (code === "Enter") {
      if (heroVisible) scrollTo("#contact");
      copyEmail();
      return true;
    }
    if (code === "Escape") { scrollTo("#top"); return true; }
    if (!heroVisible) return false;
    if (code === "Backspace") { humanType("\b"); return true; }
    if (ch && ch.length === 1) { humanType(ch); return true; }
    return false;
  }

  addEventListener("keydown", (e) => {
    const el = document.activeElement;
    const onControl = el && el !== document.body && /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    if (!e.repeat) { visualDown(e.code); click(e.code === "Space" || e.code === "Enter"); }
    const altGr = e.getModifierState("AltGraph");
    if (!altGr && (e.ctrlKey || e.metaKey || e.altKey)) return;
    if (onControl && (e.key === "Enter" || e.key === " ")) return;
    if (e.repeat && !/Backspace|Key|Digit|Space/.test(e.code)) return;
    if (action(e.code, e.key)) e.preventDefault();
  });
  addEventListener("keyup", (e) => visualUp(e.code));
  addEventListener("blur", () => $$(".down").forEach((el) => el.classList.remove("down")));

  addEventListener("kb:virtual", (e) => {
    const { code, ch } = e.detail;
    click(code === "Space" || code === "Enter");
    action(code, ch);
  });

  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 20);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const navLinks = $$(".nav nav a");
  const sectionIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting)
      navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$("section[id]").forEach((s) => sectionIO.observe(s));

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  $("#year").textContent = new Date().getFullYear();

  $("#logo").addEventListener("click", (e) => {
    e.preventDefault();
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    location.href = location.pathname;
  });

  console.log("%c⌨  Hi there, DevTools explorer!", "font: 600 15px sans-serif; padding: 6px 10px; border-radius: 6px; background: #0a8f50; color: #fff");
  console.log("The keyboard is Three.js, the rest is plain HTML/CSS/JS. Write to: " + EMAIL);
})();
