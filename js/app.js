import { PHOTO_CONFIG } from "../photo-config.js";

const root = document.documentElement;
root.classList.add("js-ready");
const preference = matchMedia("(prefers-reduced-motion: reduce)");
const motionButton = document.querySelector(".motion-toggle");
const reduceMotion = () => preference.matches || root.classList.contains("paused");
function setPaused(paused) {
  paused = paused || preference.matches;
  root.classList.toggle("paused", paused);
  motionButton.disabled = preference.matches;
  motionButton.setAttribute("aria-pressed", String(paused));
  motionButton.setAttribute("aria-label", paused ? "Reprendre les animations" : "Mettre les animations en pause");
  motionButton.querySelector(".motion-text").textContent = preference.matches
    ? "Mouvement réduit" : paused ? "Reprendre les animations" : "Pause des animations";
  motionButton.title = preference.matches ? "Les animations sont réduites selon les réglages de votre appareil." : "";
  document.dispatchEvent(new CustomEvent("jsp:motion-change", { detail: { paused } }));
}
setPaused(preference.matches);
motionButton.addEventListener("click", () => setPaused(!root.classList.contains("paused")));
preference.addEventListener("change", (event) => setPaused(event.matches));

const menu = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
function closeMenu() {
  menu.setAttribute("aria-expanded", "false");
  navigation.classList.remove("open");
}
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  navigation.classList.toggle("open", open);
});
navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("click", (event) => {
  if (!navigation.contains(event.target) && !menu.contains(event.target)) closeMenu();
});
matchMedia("(min-width: 641px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((element) => {
    element.classList.add("is-waiting");
    observer.observe(element);
  });
}

// Progressive enhancement: without JavaScript all four figures remain readable.
const gallery = document.querySelector(".gallery");
const slides = [...gallery.querySelectorAll(".gallery-slide")];
const tabs = [...gallery.querySelectorAll("[data-go]")];
const galleryStatus = document.querySelector("#gallery-status");
let slideIndex = 0;
let slideAnimations = [];
function selectSlide(index, announce = true) {
  index = (index + slides.length) % slides.length;
  if (index === slideIndex && gallery.classList.contains("is-enhanced")) return;
  const previous = slides[slideIndex];
  const next = slides[index];
  const direction = (index === 0 && slideIndex === slides.length - 1) ||
    (index > slideIndex && !(slideIndex === 0 && index === slides.length - 1)) ? 1 : -1;
  slideAnimations.forEach((animation) => animation.cancel());
  slideAnimations = [];
  slides.forEach((slide, i) => {
    slide.classList.toggle("is-active", i === index);
    slide.classList.remove("is-leaving");
    slide.setAttribute("aria-hidden", String(i !== index));
    slide.inert = i !== index;
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "diapositive");
    slide.setAttribute("aria-label", String(i + 1) + " sur " + slides.length);
  });
  tabs.forEach((tab, i) => tab.setAttribute("aria-pressed", String(i === index)));
  document.querySelector("#gallery-current").textContent = String(index + 1).padStart(2, "0");
  if (announce) galleryStatus.textContent = "Image " + (index + 1) + " sur " + slides.length + " : " + tabs[index].textContent;
  const canAnimate = announce && previous !== next && !reduceMotion() && typeof next.animate === "function";
  slideIndex = index;
  if (!canAnimate) return;
  previous.classList.add("is-leaving");
  const options = { duration: 700, easing: "cubic-bezier(.22,1,.36,1)" };
  const outgoing = previous.animate([
    { opacity: 1, transform: "translateX(0)" },
    { opacity: 0, transform: "translateX(" + (-direction * 32) + "px)" },
  ], { ...options, duration: 500 });
  const incoming = next.animate([
    { opacity: 0, transform: "translateX(" + (direction * 42) + "px)" },
    { opacity: 1, transform: "translateX(0)" },
  ], options);
  const image = next.querySelector("img").animate([
    { transform: "scale(1.065)" }, { transform: "scale(1.005)" },
  ], { ...options, duration: 1200 });
  slideAnimations = [outgoing, incoming, image];
  outgoing.finished.then(() => previous.classList.remove("is-leaving")).catch(() => {});
}
selectSlide(0, false);
gallery.classList.add("is-enhanced");
gallery.querySelector(".gallery-controls").hidden = false;
tabs.forEach((tab) => tab.addEventListener("click", () => selectSlide(Number(tab.dataset.go))));
document.querySelector("#gallery-prev").addEventListener("click", () => selectSlide(slideIndex - 1));
document.querySelector("#gallery-next").addEventListener("click", () => selectSlide(slideIndex + 1));
gallery.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Home") selectSlide(0);
  else if (event.key === "End") selectSlide(slides.length - 1);
  else selectSlide(slideIndex + (event.key === "ArrowRight" ? 1 : -1));
});
let swipeStart = null;
gallery.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.pointerType === "mouse" || event.target.closest("button,a")) return;
  swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
}, { passive: true });
gallery.addEventListener("pointerup", (event) => {
  if (!swipeStart || event.pointerId !== swipeStart.id) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) selectSlide(slideIndex + (dx < 0 ? 1 : -1));
}, { passive: true });
gallery.addEventListener("pointercancel", () => { swipeStart = null; });
document.addEventListener("jsp:motion-change", (event) => {
  if (!event.detail.paused) return;
  slideAnimations.forEach((animation) => animation.cancel());
  slideAnimations = [];
  slides.forEach((slide) => slide.classList.remove("is-leaving"));
});

const chapters = [...document.querySelectorAll(".chapter")];
const rail = document.querySelector(".chapter-rail");
const chapterLinks = [...document.querySelectorAll(".chapter-rail a, .nav-links a")];
const presentationButton = document.querySelector(".presentation-toggle");
const controls = document.querySelector("#presentation-controls");
const fullscreenButton = document.querySelector("#fullscreen-toggle");
let currentChapter = 0;
let presenting = false;
let scrollPending = false;
let pendingChapter = null;
let navigationTimer = 0;
rail.hidden = false;
function updateChapterControls() {
  document.querySelector("#chapter-status").textContent = String(currentChapter + 1).padStart(2, "0") + " / " + String(chapters.length).padStart(2, "0");
  document.querySelector("#chapter-prev").disabled = currentChapter === 0;
  document.querySelector("#chapter-next").disabled = currentChapter === chapters.length - 1;
}
function updateScroll() {
  const height = root.scrollHeight - innerHeight;
  document.querySelector(".reading-progress").style.transform = "scaleX(" + (height > 0 ? Math.min(1, Math.max(0, scrollY / height)) : 0) + ")";
  const marker = innerHeight * 0.38;
  let active = 0;
  chapters.forEach((chapter, index) => { if (chapter.getBoundingClientRect().top <= marker) active = index; });
  if (pendingChapter !== null) {
    const targetTop = chapters[pendingChapter].getBoundingClientRect().top;
    const headerHeight = document.querySelector(".header").getBoundingClientRect().height;
    if (Math.abs(targetTop - headerHeight) < 28) {
      pendingChapter = null;
      clearTimeout(navigationTimer);
    } else active = pendingChapter;
  }
  if (active !== currentChapter) {
    currentChapter = active;
    updateChapterControls();
  }
  chapterLinks.forEach((link) => {
    const selected = link.hash === "#" + chapters[active].id;
    if (selected) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  scrollPending = false;
}
addEventListener("scroll", () => {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(updateScroll);
}, { passive: true });
addEventListener("resize", updateScroll);
updateScroll();
updateChapterControls();
function goToChapter(index) {
  currentChapter = Math.max(0, Math.min(chapters.length - 1, index));
  pendingChapter = currentChapter;
  clearTimeout(navigationTimer);
  navigationTimer = setTimeout(() => { pendingChapter = null; updateScroll(); }, 1800);
  chapters[currentChapter].scrollIntoView({ behavior: reduceMotion() ? "instant" : "smooth", block: "start" });
  updateChapterControls();
}
function cancelChapterNavigation() {
  pendingChapter = null;
  clearTimeout(navigationTimer);
}
addEventListener("wheel", cancelChapterNavigation, { passive: true });
addEventListener("touchstart", cancelChapterNavigation, { passive: true });
addEventListener("scrollend", () => { cancelChapterNavigation(); updateScroll(); });
function setPresenting(enabled) {
  const returnChapter = currentChapter;
  presenting = enabled;
  root.classList.toggle("presentation-mode", enabled);
  controls.hidden = !enabled;
  presentationButton.setAttribute("aria-pressed", String(enabled));
  presentationButton.querySelector("span").textContent = enabled ? "Quitter" : "Présenter";
  closeMenu();
  document.querySelector("#presentation-hint").textContent = enabled
    ? "Mode présentation. Flèches haut et bas : chapitres. Flèches gauche et droite : images. Échap : quitter."
    : "Mode présentation terminé.";
  goToChapter(enabled ? 0 : returnChapter);
  if (enabled) document.querySelector("#chapter-next").focus({ preventScroll: true });
  else {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    presentationButton.focus({ preventScroll: true });
  }
}
presentationButton.addEventListener("click", () => setPresenting(!presenting));
document.querySelector("#presentation-exit").addEventListener("click", () => setPresenting(false));
document.querySelector("#chapter-prev").addEventListener("click", () => goToChapter(currentChapter - 1));
document.querySelector("#chapter-next").addEventListener("click", () => goToChapter(currentChapter + 1));
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await root.requestFullscreen();
  } catch {
    document.querySelector("#presentation-hint").textContent = "Le plein écran est indisponible. La présentation reste utilisable.";
  }
});
document.addEventListener("fullscreenchange", () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = active ? "Réduire" : "Plein écran";
  fullscreenButton.setAttribute("aria-label", active ? "Quitter le plein écran" : "Passer en plein écran");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (presenting) setPresenting(false);
    if (menu.getAttribute("aria-expanded") === "true") { closeMenu(); menu.focus(); }
    return;
  }
  if (!presenting || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest("canvas,input,textarea,select,[contenteditable]")) return;
  if (["ArrowDown", "PageDown"].includes(event.key)) { event.preventDefault(); goToChapter(currentChapter + 1); }
  else if (["ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); goToChapter(currentChapter - 1); }
  else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (chapters[currentChapter].id === "galerie") selectSlide(slideIndex + direction);
    else goToChapter(currentChapter + direction);
  } else if (event.key === "Home") { event.preventDefault(); goToChapter(0); }
  else if (event.key === "End") { event.preventDefault(); goToChapter(chapters.length - 1); }
});

// A small precision ring complements the native pointer; it never hides it.
const cursor = document.querySelector(".cursor-ring");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
let cursorFrame = 0;
let cursorX = 0, cursorY = 0, pointerX = 0, pointerY = 0;
function moveCursor() {
  cursorX += (pointerX - cursorX) * 0.3;
  cursorY += (pointerY - cursorY) * 0.3;
  cursor.style.transform = "translate3d(" + cursorX + "px," + cursorY + "px,0) translate(-50%,-50%)";
  cursorFrame = Math.abs(cursorX - pointerX) + Math.abs(cursorY - pointerY) > 0.2 ? requestAnimationFrame(moveCursor) : 0;
}
document.addEventListener("pointermove", (event) => {
  if (!finePointer.matches || reduceMotion() || event.pointerType !== "mouse") return;
  pointerX = event.clientX; pointerY = event.clientY;
  if (!cursor.classList.contains("is-visible")) { cursorX = pointerX; cursorY = pointerY; }
  cursor.classList.add("is-visible");
  cursor.classList.toggle("is-hovering", Boolean(event.target.closest("a,button,canvas")));
  if (!cursorFrame) cursorFrame = requestAnimationFrame(moveCursor);
}, { passive: true });
document.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
document.addEventListener("pointerdown", () => cursor.classList.add("is-pressed"), { passive: true });
document.addEventListener("pointerup", () => cursor.classList.remove("is-pressed"), { passive: true });
addEventListener("blur", () => cursor.classList.remove("is-visible"));

// Only mark a demo photo as replaced after the configured photograph has loaded.
const photos = [...document.querySelectorAll("img[data-photo]")];
photos.forEach((img) => {
  const path = PHOTO_CONFIG[img.dataset.photo];
  if (!path) return;
  const candidate = new Image();
  candidate.onload = () => {
    img.src = candidate.src;
    img.alt = img.dataset.customAlt;
    img.dataset.custom = "true";
    img.closest("figure").querySelector(".illustration-label").hidden = true;
    document.querySelector(".image-disclosure").hidden = photos.every((photo) => photo.dataset.custom === "true");
  };
  candidate.onerror = () => console.warn("Photo indisponible : " + path);
  candidate.src = new URL(path, document.baseURI).href;
});

const viewer = document.querySelector("#robot-viewer");
function showFallback(message) {
  viewer.setAttribute("aria-busy", "false");
  viewer.classList.remove("is-ready");
  document.querySelector("#scene-message").textContent = message;
  document.querySelector("#model-label").textContent = "mBot Ranger · visuel Makeblock";
  document.querySelector("#scene-controls").hidden = true;
}
import("../assets/robot-scene.js?v=lesson-1")
  .then(({ mountRobot }) => mountRobot(viewer, showFallback))
  .catch((error) => {
    showFallback("mBot Ranger · La vue 3D est indisponible sur ce navigateur.");
    console.warn("La scène 3D n’a pas pu démarrer.", error);
  });
