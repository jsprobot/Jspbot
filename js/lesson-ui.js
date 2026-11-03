import { advanceSprite, decideLineAction } from "./lesson-core.js?v=lesson-1";

const doc = document;
const sprite = doc.querySelector("#sim-sprite");
const run = doc.querySelector("#sim-run");
const state = doc.querySelector("#sim-state");
const stepInput = doc.querySelector("#sim-speed");
const turnInput = doc.querySelector("#sim-turn");
let pose = { x: 0, y: 96, heading: 0 };
let running = false;
let frame = 0;
let previous = 0;
let accumulated = 0;
function paint() {
  sprite.setAttribute("transform", "translate(" + (240 + pose.x) + " " + (180 - pose.y) + ") rotate(" + pose.heading + ")");
  state.textContent = pose.onLine === false ? "Tourner légèrement" : "Avancer";
}
function takeStep() {
  pose = advanceSprite(pose, Number(stepInput.value), Number(turnInput.value));
  paint();
}
function stop() {
  running = false;
  cancelAnimationFrame(frame);
  frame = 0;
  previous = 0;
  accumulated = 0;
  run.setAttribute("aria-pressed", "false");
  run.textContent = "Tester";
}
function animate(time) {
  if (!running) return;
  accumulated += previous ? Math.min(100, time - previous) : 0;
  previous = time;
  while (accumulated >= 25) { takeStep(); accumulated -= 25; }
  frame = requestAnimationFrame(animate);
}
run.addEventListener("click", () => {
  if (running) return stop();
  running = true;
  run.setAttribute("aria-pressed", "true");
  run.textContent = "Pause";
  frame = requestAnimationFrame(animate);
});
doc.querySelector("#sim-step").addEventListener("click", () => { stop(); takeStep(); });
doc.querySelector("#sim-reset").addEventListener("click", () => {
  stop(); pose = { x: 0, y: 96, heading: 0 }; paint();
});
for (const input of [stepInput, turnInput]) {
  input.addEventListener("input", () => {
    doc.querySelector("#" + input.id + "-value").textContent = input.value;
  });
}
function syncMotion() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || doc.documentElement.classList.contains("paused");
  run.disabled = reduced;
  if (reduced) stop();
}
doc.addEventListener("jsp:motion-change", syncMotion);
doc.addEventListener("visibilitychange", () => { if (doc.hidden) stop(); });
doc.querySelector("#phase-3").addEventListener("toggle", (event) => { if (!event.currentTarget.open) stop(); });
syncMotion();
paint();

const answers = {
  straight: "Les deux capteurs détectent la ligne : avancer tout droit.",
  left: "Seul le capteur gauche détecte la ligne : corriger vers la gauche.",
  right: "Seul le capteur droit détecte la ligne : corriger vers la droite.",
  "search-left": "Aucun capteur : rechercher lentement la ligne, puis s’arrêter si elle reste perdue.",
};
const conditions = { both: [true, true, 160, 58], left: [true, false, 140, 24], right: [false, true, 180, 24], none: [false, false, 220, 24] };
doc.querySelectorAll("[data-sensor-case]").forEach((button) => {
  button.addEventListener("click", () => {
    const [left, right, x, width] = conditions[button.dataset.sensorCase];
    doc.querySelectorAll("[data-sensor-case]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    doc.querySelector("#sensor-line").setAttribute("d", "M" + x + " 0V180");
    doc.querySelector("#sensor-line").setAttribute("stroke-width", width);
    doc.querySelector("#sensor-left").setAttribute("fill", left ? "#b75954" : "#dce1de");
    doc.querySelector("#sensor-right").setAttribute("fill", right ? "#b75954" : "#dce1de");
    doc.querySelector("#line-response").textContent = answers[decideLineAction(left, right)];
  });
});
