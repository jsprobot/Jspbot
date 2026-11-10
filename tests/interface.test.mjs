import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { JSDOM } from "jsdom";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const lyceeTheme = await readFile(new URL("../lycee-theme.css", import.meta.url), "utf8");
const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
const lessonSource = await readFile(new URL("../js/lesson-ui.js", import.meta.url), "utf8");
const lessonCoreSource = await readFile(new URL("../js/lesson-core.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 25));

async function openApp({ reduced = false, photoConfig = {}, denyFullscreen = false } = {}) {
  const dom = new JSDOM(html, {
    url: "https://example.test/Jspbot/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window: win } = dom;
  win.console.warn = () => {};
  const queries = new Map();
  win.matchMedia = (query) => {
    if (!queries.has(query)) queries.set(query, {
      matches: query.includes("reduced-motion") ? reduced : query.includes("min-width"),
      addEventListener() {},
    });
    return queries.get(query);
  };
  win.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(target) { this.callback([{ target, isIntersecting: true }]); }
    unobserve() {}
  };
  const positions = { projet: 100, seance: 1000, galerie: 2000, equipe: 3000 };
  for (const element of win.document.querySelectorAll(".chapter")) {
    element.getBoundingClientRect = () => ({ top: positions[element.id] - win.scrollY });
    element.scrollIntoView = (options) => {
      win.scrollY = positions[element.id] - 86;
      win.lastScrollBehavior = options.behavior;
      win.dispatchEvent(new win.Event("scroll"));
    };
  }
  let animations = 0;
  win.Element.prototype.animate = () => {
    animations++;
    return { finished: Promise.resolve(), cancel() {} };
  };
  win.document.fullscreenEnabled = true;
  win.document.documentElement.requestFullscreen = async () => {
    if (denyFullscreen) throw new Error("Fullscreen denied");
    win.document.fullscreenElement = win.document.documentElement;
    win.document.dispatchEvent(new win.Event("fullscreenchange"));
  };
  win.document.exitFullscreen = async () => {
    win.document.fullscreenElement = null;
    win.document.dispatchEvent(new win.Event("fullscreenchange"));
  };
  win.Image = class {
    set src(value) { this._src = value; queueMicrotask(() => this.onerror?.()); }
    get src() { return this._src; }
  };
  const context = dom.getInternalVMContext();
  const config = new SyntheticModule(["PHOTO_CONFIG"], function () {
    this.setExport("PHOTO_CONFIG", photoConfig);
  }, { context });
  const module = new SourceTextModule(source, {
    context,
    // Exercise the real application fallback without a WebGL browser.
    importModuleDynamically() { throw new Error("WebGL unavailable in DOM tests"); },
  });
  await module.link(() => config);
  await module.evaluate();
  const coreModule = new SourceTextModule(lessonCoreSource, { context });
  const lessonModule = new SourceTextModule(lessonSource, { context });
  await lessonModule.link(() => coreModule);
  await lessonModule.evaluate();
  await tick();
  const q = (selector) => win.document.querySelector(selector);
  const click = (selector) => q(selector).click();
  const key = (key, target = win.document.body) =>
    target.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  return { dom, win, q, click, key, animations: () => animations, close: () => win.close() };
}

test("content is complete without JavaScript; asset and anchor references resolve", async () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const ids = [...doc.querySelectorAll("[id]")].map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length, "IDs must be unique");
  for (const link of doc.querySelectorAll('a[href^="#"]')) {
    assert.ok(doc.getElementById(link.hash.slice(1)), link.href);
  }
  for (const image of doc.querySelectorAll("img")) {
    assert.ok(image.alt.length > 10);
    await access(new URL("../" + image.getAttribute("src"), import.meta.url));
  }
  assert.deepEqual([...doc.querySelectorAll(".member h3")].map((node) => node.textContent), [
    "Morgan Bastos saidani", "Enzo Baron", "Mohamed Diakhate", "Fedor Batin",
  ]);
  assert.ok(doc.body.textContent.includes("Lycée Professionnel"));
  assert.ok(!doc.querySelector(".gallery").classList.contains("is-enhanced"));
  assert.equal(doc.querySelectorAll(".gallery-slide:not([hidden])").length, 4);
  for (const slide of doc.querySelectorAll(".gallery-slide")) assert.notEqual(slide.getAttribute("aria-hidden"), "true");
  dom.window.close();
});

test("gallery supports wraparound, direct selection and keyboard with one accessible slide", async (t) => {
  const app = await openApp(); t.after(app.close);
  const check = (index) => {
    const slides = [...app.win.document.querySelectorAll(".gallery-slide")];
    assert.equal(app.q("#gallery-current").textContent, String(index + 1).padStart(2, "0"));
    assert.equal(slides.filter((s) => s.getAttribute("aria-hidden") === "false").length, 1);
    slides.forEach((slide, i) => assert.equal(slide.inert, i !== index));
    assert.equal(app.q('[data-go="' + index + '"]').getAttribute("aria-pressed"), "true");
  };
  check(0);
  app.click("#gallery-prev"); check(3);
  app.click("#gallery-next"); check(0);
  app.click('[data-go="2"]'); check(2);
  app.key("End", app.q(".gallery")); check(3);
  app.key("Home", app.q(".gallery")); check(0);
  for (let i = 0; i < 13; i++) app.click("#gallery-next");
  check(1);
  assert.match(app.q("#gallery-status").textContent, /Image 2 sur 4/);
  assert.ok(app.animations() > 0);
});

test("horizontal touch swipe changes images and vertical scrolling does not", async (t) => {
  const app = await openApp(); t.after(app.close);
  const swipe = (dx, dy) => {
    for (const [type, x, y] of [["pointerdown", 160, 150], ["pointerup", 160 + dx, 150 + dy]]) {
      const event = new app.win.Event(type, { bubbles: true });
      Object.assign(event, { isPrimary: true, pointerType: "touch", pointerId: 1, clientX: x, clientY: y });
      app.q(".slide-image").dispatchEvent(event);
    }
  };
  swipe(-90, 5);
  assert.equal(app.q("#gallery-current").textContent, "02");
  swipe(8, -140);
  assert.equal(app.q("#gallery-current").textContent, "02");
  swipe(100, 4);
  assert.equal(app.q("#gallery-current").textContent, "01");
});

test("reduced motion keeps every feature usable without animation", async (t) => {
  const app = await openApp({ reduced: true }); t.after(app.close);
  assert.ok(app.win.document.documentElement.classList.contains("paused"));
  assert.ok(app.q(".motion-toggle").disabled);
  app.click("#gallery-next");
  assert.equal(app.q("#gallery-current").textContent, "02");
  assert.equal(app.animations(), 0);
  app.click(".presentation-toggle");
  assert.equal(app.win.lastScrollBehavior, "instant");
});

test("presentation navigates chapters, leaves gallery arrows independent and restores focus", async (t) => {
  const app = await openApp(); t.after(app.close);
  app.click(".presentation-toggle");
  assert.equal(app.q(".presentation-toggle").getAttribute("aria-pressed"), "true");
  assert.equal(app.q("#presentation-controls").hidden, false);
  assert.equal(app.q("#chapter-status").textContent, "01 / 04");
  assert.equal(app.q("#chapter-prev").disabled, true);
  app.click("#chapter-next");
  await tick();
  assert.equal(app.q("#chapter-status").textContent, "02 / 04");
  app.click("#chapter-next");
  await tick();
  assert.equal(app.q("#chapter-status").textContent, "03 / 04");
  app.key("ArrowRight");
  assert.equal(app.q("#gallery-current").textContent, "02");
  assert.equal(app.q("#chapter-status").textContent, "03 / 04");
  app.key("ArrowRight", app.q(".gallery"));
  assert.equal(app.q("#gallery-current").textContent, "03");
  app.key("ArrowDown");
  await tick();
  assert.equal(app.q("#chapter-status").textContent, "04 / 04");
  assert.equal(app.q("#chapter-next").disabled, true);
  app.key("Escape");
  assert.equal(app.q("#presentation-controls").hidden, true);
  assert.equal(app.win.document.activeElement, app.q(".presentation-toggle"));
});

test("fullscreen denial is handled and does not close the presentation", async (t) => {
  const app = await openApp({ denyFullscreen: true }); t.after(app.close);
  app.click(".presentation-toggle");
  app.click("#fullscreen-toggle");
  await tick();
  assert.match(app.q("#presentation-hint").textContent, /indisponible/);
  assert.equal(app.q("#presentation-controls").hidden, false);
});

test("menu closes via Escape, outside click and navigation", async (t) => {
  const app = await openApp(); t.after(app.close);
  app.click(".menu-toggle");
  assert.equal(app.q(".menu-toggle").getAttribute("aria-expanded"), "true");
  app.key("Escape");
  assert.equal(app.q(".menu-toggle").getAttribute("aria-expanded"), "false");
  app.click(".menu-toggle"); app.click("#hero-title");
  assert.equal(app.q(".menu-toggle").getAttribute("aria-expanded"), "false");
  app.click(".menu-toggle"); app.click('.nav-links a[href="#equipe"]');
  assert.equal(app.q(".menu-toggle").getAttribute("aria-expanded"), "false");
});

test("3D and custom photo failures retain an honest fallback and working controls", async (t) => {
  const app = await openApp({ photoConfig: { details: "./missing.jpg" } }); t.after(app.close);
  assert.equal(app.q("#robot-viewer").getAttribute("aria-busy"), "false");
  assert.match(app.q("#scene-message").textContent, /indisponible/);
  assert.equal(app.q("#scene-controls").hidden, true);
  assert.equal(app.q('img[data-photo="details"]').getAttribute("src"), "assets/makeblock/land-raider.png");
  assert.equal(app.q(".illustration-label").hidden, false);
  app.click("#gallery-next");
  assert.equal(app.q("#gallery-current").textContent, "02");
  app.click(".motion-toggle");
  assert.ok(app.win.document.documentElement.classList.contains("paused"));
  assert.equal(app.q(".motion-toggle").getAttribute("aria-pressed"), "true");
});


test("lesson follows four printed phases while interactive exercises remain usable", async (t) => {
  const app = await openApp(); t.after(app.close);
  assert.equal(app.win.document.querySelectorAll(".lesson-phase").length, 4);
  assert.deepEqual([...app.win.document.querySelectorAll(".phase-duration")].map(n => n.textContent), ["25 min", "35 min", "50 min", "10 min"]);
  assert.ok(app.q("#seance").textContent.includes("S15–S18"));
  const initial = app.q("#sim-sprite").getAttribute("transform");
  app.click("#sim-step");
  assert.notEqual(app.q("#sim-sprite").getAttribute("transform"), initial);
  app.click("#sim-reset");
  assert.equal(app.q("#sim-sprite").getAttribute("transform"), initial);
  for (const [name, text] of [["left", "gauche"], ["right", "droite"], ["none", "Aucun"], ["both", "tout droit"]]) {
    app.click('[data-sensor-case="' + name + '"]');
    assert.ok(app.q("#line-response").textContent.includes(text));
    assert.equal(app.q('[data-sensor-case="' + name + '"]').getAttribute("aria-pressed"), "true");
  }
});

test("lycée logo is displayed in the top navigation rather than below the hero", () => {
  const dom = new JSDOM(html);
  const logo = dom.window.document.querySelector(".header .school-brand img");
  assert.ok(logo, "logo should be inside the top header");
  assert.equal(logo.getAttribute("src"), "images/logo-lycee.png");
  assert.equal(dom.window.document.querySelector("main .school-section"), null);
  dom.window.close();
});

test("lycée blue theme is loaded after the existing styles without moving the logo", () => {
  const dom = new JSDOM(html);
  const stylesheets = [...dom.window.document.querySelectorAll('link[rel="stylesheet"]')].map(el => el.getAttribute("href"));
  assert.ok(stylesheets.indexOf("styles.css?v=lesson-1") < stylesheets.indexOf("lycee-theme.css?v=blue-20261110"));
  assert.ok(lyceeTheme.includes("--school-blue: #0e5fa8;"));
  assert.ok(lyceeTheme.includes("background: var(--school-blue);"));
  assert.ok(dom.window.document.querySelector(".header .school-brand img"));
  assert.equal(dom.window.document.querySelectorAll('img[src="images/logo-lycee.png"]').length, 1);
  dom.window.close();
});

test("school logo has no CSS tile and favicon matches the blue theme", async () => {
  const favicon = await readFile(new URL("../assets/favicon.svg", import.meta.url), "utf8");
  const dom = new JSDOM(html);
  const icon = dom.window.document.querySelector('link[rel="icon"]');
  assert.match(icon.href, /favicon\.svg\?v=school-blue-2$/);
  assert.equal(dom.window.document.querySelector('meta[name="theme-color"]').content, "#0e5fa8");
  assert.match(lyceeTheme, /mix-blend-mode:\s*multiply/);
  assert.match(lyceeTheme, /background:\s*transparent/);
  assert.match(lyceeTheme, /prefers-reduced-motion:\s*reduce/);
  assert.match(favicon, /#0e5fa8/);
  assert.ok(dom.window.document.querySelector(".header .school-brand img"));
  dom.window.close();
});
