(async () => {
  "use strict";

  const SPACE_LABEL = "angelika";
  const NAV_LABELS = { Digit1: "about", Digit2: "projects", Digit3: "contact" };

  const canvas = document.getElementById("kb");
  if (!canvas) return;
  const html = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fail = (err) => { console.warn("3D keyboard unavailable:", err); html.classList.add("no-3d"); };

  let THREE, RoundedBoxGeometry, RoomEnvironment;
  try {
    THREE = await import("three");
    ({ RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js"));
    ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js"));
  } catch (err) { fail(err); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) { fail(err); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8c88, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-7, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 9, bottom: -9, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 5;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.17 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.92;
  ground.receiveShadow = true;
  scene.add(ground);

  const board = new THREE.Group();
  scene.add(board);

  const cssVar = (n) => getComputedStyle(html).getPropertyValue(n).trim();
  const readPalette = () => ({
    case: cssVar("--case"),
    plate: cssVar("--plate"),
    alpha: [cssVar("--key-alpha"), cssVar("--key-alpha-ink")],
    mod: [cssVar("--key-mod"), cssVar("--key-mod-ink")],
    accent: [cssVar("--key-accent"), cssVar("--key-accent-ink")],
    dark: [cssVar("--key-dark"), cssVar("--key-dark-ink")],
  });
  let pal = readPalette();

  const L = (s) => [...s].map((c) => ({ code: "Key" + c, label: c, w: 1, type: "alpha", ch: c.toLowerCase() }));
  const k = (code, label, w = 1, type = "alpha", ch) => ({ code, label, w, type, ch });
  const ROWS = [
    [k("Escape", "Esc", 1, "accent"),
      ...[1, 2, 3].map((n) => k("Digit" + n, String(n), 1, "nav", String(n))),
      ...[4, 5, 6, 7, 8, 9, 0].map((n) => k("Digit" + n, String(n), 1, "alpha", String(n))),
      k("Minus", "-", 1, "alpha", "-"), k("Equal", "=", 1, "alpha", "="), k("Backspace", "⌫", 2, "mod")],
    [k("Tab", "Tab", 1.5, "mod"), ...L("QWERTYUIOP"), k("BracketLeft", "["), k("BracketRight", "]"), k("Backslash", "\\", 1.5, "mod")],
    [k("CapsLock", "Caps", 1.75, "mod"), ...L("ASDFGHJKL"), k("Semicolon", ";", 1, "alpha", ";"), k("Quote", "'", 1, "alpha", "'"), k("Enter", "Enter", 2.25, "accent")],
    [k("ShiftLeft", "Shift", 2.25, "mod"), ...L("ZXCVBNM"), k("Comma", ",", 1, "alpha", ","), k("Period", ".", 1, "alpha", "."), k("Slash", "/", 1, "alpha", "/"), k("ShiftRight", "Shift", 2.75, "mod")],
    [k("ControlLeft", "Ctrl", 1.25, "mod"), k("MetaLeft", "◆", 1.25, "mod"), k("AltLeft", "Alt", 1.25, "mod"),
      k("Space", SPACE_LABEL, 6.25, "space", " "),
      k("AltRight", "AltGr", 1.25, "mod"), k("MetaRight", "Fn", 1.25, "mod"), k("ContextMenu", "☰", 1.25, "mod"), k("ControlRight", "Ctrl", 1.25, "mod")],
  ];
  const ROW_TILT = [0.13, 0.07, 0, -0.05, -0.09];

  const GAP = 0.1, CAP_H = 0.44, CAP_D = 1 - GAP, RADIUS = 0.08, TAPER = 0.05;
  const KEY_Y = 0.02 + CAP_H / 2;
  const PX = 170;
  const colorsFor = (type) => pal[{ alpha: "alpha", space: "alpha", mod: "mod", accent: "accent", nav: "dark" }[type]];

  const caseMat = new THREE.MeshStandardMaterial({ color: pal.case, roughness: 0.5 });
  const plateMat = new THREE.MeshStandardMaterial({ color: pal.plate, roughness: 0.8 });
  const caseMesh = new THREE.Mesh(new RoundedBoxGeometry(15.75, 0.92, 5.75, 5, 0.32), caseMat);
  caseMesh.position.y = -0.46;
  caseMesh.castShadow = caseMesh.receiveShadow = true;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(15.08, 0.03, 5.08), plateMat);
  plate.position.y = 0.005;
  plate.receiveShadow = true;
  board.add(caseMesh, plate);

  const geoCache = new Map();
  function capGeometry(w) {
    if (geoCache.has(w)) return geoCache.get(w);
    const g = new RoundedBoxGeometry(w - GAP, CAP_H, CAP_D, 3, RADIUS);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + CAP_H / 2) / CAP_H;
      const x = p.getX(i), z = p.getZ(i);
      p.setX(i, Math.sign(x) * Math.max(Math.abs(x) - TAPER * t, 0));
      p.setZ(i, Math.sign(z) * Math.max(Math.abs(z) - TAPER * t * 1.3, 0));
    }
    g.computeVertexNormals();
    geoCache.set(w, g);
    return g;
  }

  await Promise.race([
    Promise.all([document.fonts.load("600 40px 'Space Grotesk'"), document.fonts.load("500 20px 'Geist Mono'")]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function drawLegend(key) {
    const [bg, ink] = colorsFor(key.type);
    const c = key.cvs, g = c.getContext("2d");
    const W = c.width, H = c.height, pad = 0.11 * PX;
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = ink;
    g.textBaseline = "top";
    const label = key.label;
    if (key.type === "space") {
      g.globalAlpha = 0.55;
      g.font = `500 ${0.15 * PX}px "Geist Mono", monospace`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(label, W / 2, H / 2);
    } else if (key.type === "nav") {
      g.font = `600 ${0.3 * PX}px "Space Grotesk", sans-serif`;
      g.fillText(label, pad, pad);
      g.fillStyle = pal.accent[0];
      g.font = `500 ${0.1 * PX}px "Geist Mono", monospace`;
      g.textBaseline = "bottom";
      g.fillText(NAV_LABELS[key.code] || "", pad, H - pad * 0.8);
    } else if (key.type === "mod" || label.length > 1) {
      g.font = `500 ${0.17 * PX}px "Space Grotesk", sans-serif`;
      g.textBaseline = "bottom";
      g.fillText(label, pad, H - pad);
    } else {
      g.font = `600 ${0.3 * PX}px "Space Grotesk", sans-serif`;
      g.fillText(label, pad, pad);
    }
    key.tex.needsUpdate = true;
    key.body.material.color.set(bg);
    key.top.material.color.set(0xffffff);
  }

  const keys = [];
  const byCode = new Map();
  const pickables = [];
  ROWS.forEach((row, r) => {
    let x = -7.5;
    for (const def of row) {
      const w = def.w ?? 1;
      const cx = x + w / 2;
      x += w;
      const z = r - 2;

      const group = new THREE.Group();
      group.position.set(cx, KEY_Y, z);
      group.rotation.x = ROW_TILT[r];

      const body = new THREE.Mesh(capGeometry(w), new THREE.MeshStandardMaterial({ roughness: 0.55 }));
      body.castShadow = true;
      body.receiveShadow = true;

      const inset = RADIUS + TAPER * 1.3 + 0.03;
      const pw = w - GAP - inset * 2, pd = CAP_D - inset * 2;
      const cvs = document.createElement("canvas");
      cvs.width = Math.round(pw * PX); cvs.height = Math.round(pd * PX);
      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      const top = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
      top.rotation.x = -Math.PI / 2;
      top.position.y = CAP_H / 2 + 0.002;
      top.receiveShadow = true;

      group.add(body, top);
      board.add(group);

      const key = {
        ...def, w, group, body, top, tex, cvs, row: r, tilt: ROW_TILT[r],
        y: 0, v: 0, down: false, jump: null,
        intro: 0.1 + (cx + 7.5) * 0.035 + r * 0.06, 
      };
      body.userData.key = top.userData.key = key;
      pickables.push(body, top);
      keys.push(key);
      byCode.set(def.code, key);
      drawLegend(key);
    }
  });

  let W = 0, H = 0, narrow = false;
  function frame() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    narrow = W < 720;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const fitW = narrow ? 17 : 19;
    const d = Math.max((fitW / 2) / Math.tan(hHalf), (narrow ? 8 : 6) / Math.tan(vHalf));
    const elev = narrow ? 1.02 : 0.9;
    camera.position.set(0, Math.sin(elev) * d, Math.cos(elev) * d);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(W, H, 0, -H * (narrow ? 0.06 : 0.2), W, H);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(frame).observe(canvas);
  frame();

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let hovered = null, pressed = null;

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.key : null;
  }
  addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    hovered = pick(e);
    canvas.style.cursor = hovered ? "pointer" : "";
  });
  canvas.addEventListener("pointerleave", () => { hovered = null; });
  canvas.addEventListener("pointerdown", (e) => {
    const key = pick(e);
    if (!key) return;
    pressed = key;
    key.down = true;
    dispatchEvent(new CustomEvent("kb:virtual", { detail: { code: key.code, ch: key.ch } }));
  });
  const release = () => { if (pressed) { pressed.down = false; pressed = null; } };
  addEventListener("pointerup", release);
  addEventListener("pointercancel", release);

  let clock = 0;
  function jump(key, { delay = 0, dur = 1, h = 1, spinX = 0, spinZ = 0, mid = null }) {
    key.jump = { start: clock + delay, dur, h, spinX, spinZ, mid, midDone: false };
  }
  function celebrate() {
    if (reduced) return;
    for (const key of keys) {
      const dist = Math.hypot(key.group.position.x, key.group.position.z * 1.6);
      const flip = Math.random() < 0.5 ? Math.PI * 2 * (Math.random() < 0.5 ? 1 : -1) : 0;
      jump(key, {
        delay: dist * 0.045, dur: 1.05 + Math.random() * 0.3, h: 2.2 + Math.random() * 2.4,
        spinX: flip, spinZ: flip ? 0 : (Math.random() - 0.5) * 0.8,
      });
    }
  }
  function setColorway(animate = true) {
    pal = readPalette();
    const recase = () => { caseMat.color.set(pal.case); plateMat.color.set(pal.plate); };
    if (!animate || reduced) { recase(); keys.forEach(drawLegend); return; }
    setTimeout(recase, 350);
    for (const key of keys) {
      jump(key, { delay: (key.group.position.x + 7.5) * 0.04 + key.row * 0.03, dur: 0.55, h: 0.9, spinX: Math.PI * 2, mid: () => drawLegend(key) });
    }
  }

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const INTRO_DUR = 0.9;   
  const INTRO_DROP = 1.6;  
  let introDone = reduced, last = performance.now();
  const INTRO_END = Math.max(...keys.map((k) => k.intro)) + INTRO_DUR;
  const setOpacity = (key, o) => {
    for (const m of [key.body.material, key.top.material]) { m.transparent = o < 1; m.opacity = o; }
  };
  if (!reduced) keys.forEach((k) => setOpacity(k, 0));

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (!visible) return;
    clock += dt;

    const lerp = reduced ? 1 : 1 - Math.pow(0.001, dt);
    mouse.x += (mouse.tx - mouse.x) * lerp;
    mouse.y += (mouse.ty - mouse.y) * lerp;
    const scroll = Math.min(scrollY / (H || 1), 1);
    const par = reduced ? 0 : 1;
    board.rotation.y = -0.05 + mouse.x * 0.07 * par;
    board.rotation.x = mouse.y * 0.035 * par + scroll * 0.5;
    board.position.z = scroll * 2.5;

    if (!introDone && clock > INTRO_END) {
      introDone = true;
      dispatchEvent(new Event("kb:ready"));
    }

    for (const key of keys) {
      const target = key.down ? -0.19 : key === hovered ? 0.05 : 0;
      const steps = Math.ceil(dt / (1 / 240));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        key.v += ((target - key.y) * 1400 - key.v * 48) * h;
        key.y += key.v * h;
      }

      let y = KEY_Y + key.y, rx = key.tilt, rz = 0;
      let seen = true;

      if (!reduced && !key.landed) {
        const t = Math.min(Math.max(0, (clock - key.intro) / INTRO_DUR), 1);
        seen = t > 0;
        y += (1 - easeOutCubic(t)) * INTRO_DROP;
        setOpacity(key, Math.min(t * 2, 1));
        if (t >= 1) key.landed = true;
      }
      const j = key.jump;
      if (j) {
        const t = (clock - j.start) / j.dur;
        if (t >= 1) {
          if (j.mid && !j.midDone) j.mid();
          key.jump = null;
        } else if (t > 0) {
          y += j.h * 4 * t * (1 - t);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          rx += j.spinX * e;
          rz += j.spinZ * Math.sin(Math.PI * t);
          if (j.mid && !j.midDone && t > 0.5) { j.midDone = true; j.mid(); }
        }
      }
      key.group.visible = seen;
      key.group.position.y = y;
      key.group.rotation.x = rx;
      key.group.rotation.z = rz;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
  if (reduced) setTimeout(() => dispatchEvent(new Event("kb:ready")), 100);

  window.KB = {
    down(code) { const k = byCode.get(code); if (k) k.down = true; },
    up(code) { const k = byCode.get(code); if (k) k.down = false; },
    celebrate,
    setColorway,
  };
})();
