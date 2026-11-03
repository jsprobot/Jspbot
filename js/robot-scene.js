import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MODEL_CONFIG } from "../model-config.js";

// Original geometry inspired by the project's existing rover illustrations.
// The scene is a concept, never presented as a scan of the team's real robot.
export function createConcept() {
  const robot = new THREE.Group();
  const material = (color, metalness, roughness) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const blue = material(0x3c6296, 0.65, 0.32);
  const silver = material(0xb6bec2, 0.83, 0.3);
  const dark = material(0x283137, 0.6, 0.34);
  const rubber = material(0x202329, 0.02, 0.92);
  const rim = material(0x343d47, 0.65, 0.35);
  const green = material(0x396e56, 0.18, 0.6);
  const red = material(0xb55550, 0.35, 0.4);
  const black = material(0x151c23, 0.05, 0.6);
  const gold = material(0xbc9f67, 0.75, 0.36);
  const led = new THREE.MeshStandardMaterial({ color: 0x72a48a, emissive: 0x447956, emissiveIntensity: 0.7, roughness: 0.4 });
  const geometryCache = new Map();
  function cached(key, make) {
    if (!geometryCache.has(key)) geometryCache.set(key, make());
    return geometryCache.get(key);
  }
  function mesh(geometry, mat, position, parent = robot) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(...position);
    parent.add(object);
    return object;
  }
  function box(w, h, d, radius, mat, position, parent) {
    const key = ["box", w, h, d, radius].join("/");
    return mesh(cached(key, () => new RoundedBoxGeometry(w, h, d, 2, radius)), mat, position, parent);
  }
  function cylinder(radius, height, mat, position, parent, sides = 32) {
    const key = ["cylinder", radius, height, sides].join("/");
    return mesh(cached(key, () => new THREE.CylinderGeometry(radius, radius, height, sides)), mat, position, parent);
  }
  function wire(points, mat, thickness = 0.016, parent = robot) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return mesh(new THREE.TubeGeometry(curve, 32, thickness, 6, false), mat, [0, 0, 0], parent);
  }
  function bolt(x, y, z, parent = robot) {
    cylinder(0.049, 0.026, silver, [x, y, z], parent, 6);
    box(0.046, 0.003, 0.009, 0.002, dark, [x, y + 0.015, z], parent);
  }

  // Two structural decks with exposed electronics, rather than a cartoon body.
  box(2.4, 0.105, 2.65, 0.035, dark, [0, 0.78, 0]);
  box(2.3, 0.065, 2.55, 0.02, silver, [0, 0.86, 0]);
  box(2.48, 0.085, 2.72, 0.045, blue, [0, 1.82, 0]);
  box(2.12, 0.04, 0.08, 0.01, dark, [0, 1.76, 1.27]);
  [-1.02, 1.02].forEach((x) => {
    [-1.12, 0, 1.12].forEach((z) => {
      cylinder(0.046, 0.91, silver, [x, 1.345, z]);
      cylinder(0.079, 0.06, dark, [x, 1.73, z]);
      bolt(x, 1.876, z);
    });
    box(0.065, 0.34, 2.45, 0.014, silver, [x * 1.12, 0.98, 0]);
    for (let i = 0; i < 5; i++) {
      // Dark insets visually articulate the machined side rail.
      box(0.006, 0.06, 0.24, 0.018, dark, [x * 1.156, 0.99, -0.83 + i * 0.42]);
    }
  });
  [-1, 1].forEach((side) => {
    box(2.22, 0.32, 0.065, 0.016, silver, [0, 0.96, side * 1.32]);
    [-0.64, 0, 0.64].forEach((x) => box(0.34, 0.055, 0.009, 0.015, dark, [x, 0.96, side * 1.358]));
    [-0.93, 0.93].forEach((x) => {
      const screw = cylinder(0.045, 0.027, dark, [x, 1.03, side * 1.37], robot, 6);
      screw.rotation.x = Math.PI / 2;
    });
  });
  box(1.56, 0.31, 0.82, 0.035, black, [0, 0.57, -0.1]);

  // Four chunky tires, instanced tread blocks, spokes and metal wheel hubs.
  const wheels = [];
  [-1.44, 1.44].forEach((x) => [-0.91, 0.91].forEach((z) => {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.55, z);
    wheel.rotation.z = Math.PI / 2;
    robot.add(wheel);
    cylinder(0.52, 0.37, rubber, [0, 0, 0], wheel, 48);
    cylinder(0.385, 0.395, rim, [0, 0, 0], wheel, 40);
    cylinder(0.29, 0.407, black, [0, 0, 0], wheel, 40);
    const treadGeometry = cached("tread", () => new THREE.BoxGeometry(0.125, 0.115, 0.045));
    const treads = new THREE.InstancedMesh(treadGeometry, rubber, 78);
    const temp = new THREE.Object3D();
    let instance = 0;
    for (let row = 0; row < 3; row++) {
      for (let step = 0; step < 26; step++) {
        const angle = step / 26 * Math.PI * 2 + (row % 2) * 0.11;
        temp.position.set(Math.cos(angle) * 0.525, (row - 1) * 0.125, Math.sin(angle) * 0.525);
        temp.rotation.set(0, Math.PI / 2 - angle, 0);
        temp.updateMatrix();
        treads.setMatrixAt(instance++, temp.matrix);
      }
    }
    treads.instanceMatrix.needsUpdate = true;
    wheel.add(treads);
    [-1, 1].forEach((side) => {
      const edge = mesh(cached("rim-ring", () => new THREE.TorusGeometry(0.37, 0.018, 6, 40)), dark, [0, side * 0.207, 0], wheel);
      edge.rotation.x = Math.PI / 2;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        const spoke = box(0.055, 0.025, 0.255, 0.01, rim, [Math.sin(a) * 0.2, side * 0.213, Math.cos(a) * 0.2], wheel);
        spoke.rotation.y = a;
      }
      cylinder(0.12, 0.035, silver, [0, side * 0.228, 0], wheel);
      cylinder(0.063, 0.045, dark, [0, side * 0.245, 0], wheel, 6);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        cylinder(0.014, 0.018, dark, [Math.sin(a) * 0.085, side * 0.25, Math.cos(a) * 0.085], wheel, 6);
      }
    });
    const axle = cylinder(0.075, 0.52, silver, [0, 0.55, z]);
    axle.rotation.z = Math.PI / 2;
    axle.position.x = x * 0.78;
    wheels.push(wheel);
  }));

  // Coil-over suspension and lower control arms.
  [-1, 1].forEach((side) => [-0.94, 0.94].forEach((z) => {
    const shock = new THREE.Group();
    shock.position.set(side * 1.13, 1.04, z);
    shock.rotation.z = side * -0.16;
    robot.add(shock);
    cylinder(0.034, 0.61, silver, [0, 0, 0], shock);
    cylinder(0.085, 0.2, red, [0, -0.17, 0], shock);
    const spring = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      spring.push([Math.cos(t * Math.PI * 14) * 0.077, -0.16 + t * 0.43, Math.sin(t * Math.PI * 14) * 0.077]);
    }
    wire(spring, silver, 0.014, shock);
    cylinder(0.11, 0.035, dark, [0, 0.28, 0], shock);
    cylinder(0.1, 0.035, dark, [0, -0.29, 0], shock);
    const arm = box(0.55, 0.065, 0.1, 0.018, silver, [side * 1.15, 0.55, z - 0.17]);
    arm.rotation.z = side * -0.16;
  }));

  // PCB, chips, connectors and restrained red/green/blue wiring.
  box(1.86, 0.045, 1.56, 0.02, green, [0, 1.16, -0.1]);
  [-0.78, 0.78].forEach((x) => [-0.7, 0.5].forEach((z) => {
    cylinder(0.035, 0.23, gold, [x, 1.02, z]);
    bolt(x, 1.2, z);
  }));
  box(0.53, 0.09, 0.55, 0.008, black, [-0.24, 1.23, -0.16]);
  box(0.27, 0.07, 0.35, 0.008, black, [0.45, 1.22, 0.18]);
  for (let i = 0; i < 12; i++) {
    box(0.022, 0.014, 0.7, 0.002, silver, [-0.48 + i * 0.044, 1.29, -0.16]);
    cylinder(0.013, 0.09, gold, [-0.76 + i * 0.13, 1.24, -0.72]);
  }
  [-0.45, 0.1, 0.65].forEach((x) => {
    box(0.28, 0.2, 0.22, 0.014, silver, [x, 1.27, 0.64]);
    box(0.22, 0.12, 0.009, 0.004, black, [x, 1.27, 0.756]);
  });
  cylinder(0.06, 0.22, dark, [0.63, 1.31, -0.53]);
  cylinder(0.035, 0.25, dark, [0.76, 1.325, -0.53]);
  box(0.035, 0.035, 0.04, 0.006, led, [-0.71, 1.21, 0.36]);
  wire([[-0.7, 1.25, -0.6], [-0.98, 1.6, -0.5], [-0.95, 1.55, 0.63], [-0.55, 1.22, 0.57]], red, 0.024);
  wire([[-0.55, 1.24, -0.6], [-0.86, 1.53, -0.4], [-0.82, 1.48, 0.63], [-0.45, 1.22, 0.57]], black, 0.024);
  wire([[0.55, 1.23, -0.5], [0.92, 1.55, -0.3], [0.92, 1.45, 0.55], [0.48, 1.4, 1.28]], blue);
  wire([[0.63, 1.23, -0.5], [1.01, 1.5, -0.24], [1.0, 1.4, 0.63], [0.4, 1.4, 1.28]], red);
  wire([[-0.7, 1.12, -0.65], [-1.0, 0.96, -0.9], [-1.23, 0.85, -0.9]], red, 0.021);
  wire([[0.7, 1.12, 0.4], [1.05, 0.95, 0.9], [1.23, 0.8, 0.9]], black, 0.021);

  // Twin ultrasonic transducers: physical sensor meshes, with no animated face.
  box(1.62, 0.42, 0.12, 0.025, black, [0, 1.48, 1.38]);
  box(1.7, 0.05, 0.28, 0.015, blue, [0, 1.72, 1.32]);
  [-0.44, 0.44].forEach((x) => {
    const sensor = cylinder(0.205, 0.18, silver, [x, 1.49, 1.52], robot, 40);
    sensor.rotation.x = Math.PI / 2;
    mesh(cached("sensor-face", () => new THREE.CircleGeometry(0.165, 40)), dark, [x, 1.49, 1.615]);
    const lip = mesh(cached("sensor-lip", () => new THREE.TorusGeometry(0.184, 0.012, 8, 40)), silver, [x, 1.49, 1.616]);
    for (let i = 1; i <= 4; i++) {
      mesh(cached("sensor-mesh-" + i, () => new THREE.RingGeometry(i * 0.033, i * 0.033 + 0.003, 32)),
        rim, [x, 1.49, 1.618]);
    }
    lip.name = "ultrasonic-transducer";
  });
  [-0.72, 0.72].forEach((x) => {
    const screw = cylinder(0.026, 0.018, silver, [x, 1.48, 1.452], robot, 6);
    screw.rotation.x = Math.PI / 2;
  });
  if (typeof document !== "undefined") {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 512; labelCanvas.height = 128;
    const context = labelCanvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, 512, 128);
      context.fillStyle = "#e6edf3";
      context.textAlign = "center";
      context.font = "500 68px sans-serif";
      context.fillText("JSP / 001", 256, 90);
      const texture = new THREE.CanvasTexture(labelCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const label = mesh(new THREE.PlaneGeometry(0.94, 0.235),
        new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.5 }),
        [0, 1.865, -0.2]);
      label.rotation.x = -Math.PI / 2;
    }
  }
  robot.userData.wheels = wheels;
  return robot;
}

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    const list = child.material
      ? Array.isArray(child.material)
        ? child.material
        : [child.material]
      : [];
    list.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

export async function mountRobot(container, showFallback) {
  const modelLabel = document.querySelector("#model-label");
  let activeLabel = modelLabel.textContent;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0xf5f6f3, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "Robot 3D de démonstration. Glissez horizontalement ou utilisez les flèches gauche et droite pour le faire tourner. Appuyez sur Début pour réinitialiser.",
  );
  canvas.setAttribute("aria-describedby", "robot-caption");
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const cameraDirection = new THREE.Vector3(4.2, 2.8, 6.2).normalize();
  const focusPoint = new THREE.Vector3(0, 1.03, 0);
  let framingRadius = 2.45;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.85;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf2f6fa, 0x738579, 2.2));
  const key = new THREE.DirectionalLight(0xfff9e8, 3.2);
  key.position.set(-3.5, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc3d5ec, 3.4);
  rim.position.set(3, 3.5, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xe4ebe6, 1.6);
  fill.position.set(-4, 1, -1);
  scene.add(fill);

  const pivot = new THREE.Group();
  scene.add(pivot);
  let model = createConcept();
  pivot.add(model);
  // A soft contact shadow avoids a costly extra shadow pass on classroom devices.
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader:
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "varying vec2 vUv; void main(){ float d = length((vUv - 0.5) * 2.0); float a = (1.0 - smoothstep(0.12, 1.0, d)) * 0.21; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }",
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 4.4),
    shadowMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.009;
  scene.add(floor);
  // The fine orbit is geometry, so it remains attached to the ground plane.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.18, 2.185, 100),
    new THREE.MeshBasicMaterial({
      color: 0x7390aa,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  scene.add(ring);

  let paused = document.documentElement.classList.contains("paused");
  let visible = true;
  let lost = false;
  let running = false;
  let previousTime = 0;
  let elapsed = 0;
  let angle = paused ? -0.18 : 0.24;
  let targetAngle = -0.18;
  let pointerX = 0;
  let pointerY = 0;
  let headX = 0;
  let headY = 0;
  let mixer = null;
  let dragging = false;
  let lastX = 0;
  let activePointer = null;

  function render() {
    if (!lost) renderer.render(scene, camera);
  }
  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    // Fit both axes, including a full rotation in narrow tablet layouts.
    camera.fov = 36;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const distance = framingRadius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.02;
    camera.position.copy(cameraDirection).multiplyScalar(distance).add(focusPoint);
    camera.lookAt(focusPoint);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  function frame(time) {
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    elapsed += dt;
    const easing = 1 - Math.exp(-dt * 5);
    angle += (targetAngle - angle) * easing;
    headX += (pointerX - headX) * easing;
    headY += (pointerY - headY) * easing;
    pivot.rotation.y = angle + Math.sin(elapsed * 0.35) * 0.045;
    if (model.userData.head) {
      model.userData.head.rotation.y =
        Math.sin(elapsed * 0.55) * 0.065 + headX * 0.15;
      model.userData.head.rotation.x = headY * 0.05;
    }
    mixer?.update(dt);
    render();
  }
  function syncLoop() {
    const shouldRun = visible && !paused && !document.hidden && !lost;
    if (running === shouldRun) return;
    running = shouldRun;
    previousTime = 0;
    renderer.setAnimationLoop(shouldRun ? frame : null);
    if (!shouldRun) render();
  }
  function setAngle(value) {
    targetAngle = value;
    if (paused) {
      angle = value;
      pivot.rotation.y = angle;
      render();
    }
  }
  function resetView() {
    pointerX = pointerY = 0;
    setAngle(-0.18);
    if (paused && model.userData.head) {
      model.userData.head.rotation.set(0, 0, 0);
      render();
    }
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    dragging = true;
    activePointer = event.pointerId;
    lastX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragging && event.pointerId === activePointer) {
      setAngle(targetAngle + (event.clientX - lastX) * 0.009);
      lastX = event.clientX;
    } else if (event.pointerType === "mouse" && !paused) {
      const bounds = canvas.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointerY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    }
  });
  const endDrag = (event) => {
    if (event.pointerId !== activePointer) return;
    dragging = false;
    activePointer = null;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", () => {
    dragging = false;
    activePointer = null;
  });
  canvas.addEventListener("pointerleave", () => {
    pointerX = pointerY = 0;
  });
  canvas.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") resetView();
    else setAngle(targetAngle + (event.key === "ArrowLeft" ? -0.22 : 0.22));
  });
  document.querySelector("#reset-view").addEventListener("click", resetView);
  document.addEventListener("jsp:motion-change", (event) => {
    paused = event.detail.paused;
    syncLoop();
  });
  document.addEventListener("visibilitychange", syncLoop);
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      syncLoop();
    },
    { threshold: 0 },
  );
  observer.observe(container);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    syncLoop();
    showFallback("Aperçu du concept · La scène 3D se reconnecte.");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    resize();
    container.classList.add("is-ready");
    document.querySelector("#scene-controls").hidden = false;
    modelLabel.textContent = activeLabel;
    syncLoop();
  });
  pivot.rotation.y = angle;
  resize();
  container.classList.add("is-ready");
  container.setAttribute("aria-busy", "false");
  document.querySelector("#scene-controls").hidden = false;
  syncLoop();

  if (MODEL_CONFIG.url) {
    try {
      const url = new URL(MODEL_CONFIG.url, document.baseURI).href;
      const gltf = await new GLTFLoader().loadAsync(url);
      const custom = new THREE.Group();
      custom.add(gltf.scene);
      gltf.scene.rotation.set(...MODEL_CONFIG.rotation);
      gltf.scene.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(custom);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (!Number.isFinite(size.length()) || size.length() === 0)
        throw new Error("Modèle vide");
      gltf.scene.position.sub(center);
      const userScale =
        Number.isFinite(MODEL_CONFIG.scale) && MODEL_CONFIG.scale > 0
          ? MODEL_CONFIG.scale
          : 1;
      const scale =
        Math.min(2.65 / size.y, 2.8 / size.x, 2.25 / size.z) * userScale;
      custom.scale.setScalar(scale);
      custom.position.y = (size.y * scale) / 2 + 0.02;
      custom.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      pivot.remove(model);
      disposeObject(model);
      model = custom;
      pivot.add(custom);
      framingRadius = Math.max(1.5, size.length() * scale / 2);
      focusPoint.set(0, (size.y * scale) / 2 + 0.02, 0);
      resize();
      if (MODEL_CONFIG.animate && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        // Play the first authored clip; avoid superimposing incompatible actions.
        mixer.clipAction(gltf.animations[0]).play();
      }
      const label = document.querySelector("#model-label");
      label.textContent = MODEL_CONFIG.label || "JSP — Notre robot";
      activeLabel = label.textContent;
      canvas.setAttribute(
        "aria-label",
        "Modèle 3D du robot JSP. Glissez horizontalement ou utilisez les flèches gauche et droite pour le faire tourner. Appuyez sur Début pour réinitialiser.",
      );
      render();
    } catch (error) {
      // A broken replacement must never leave an empty hero.
      console.warn("Modèle indisponible. Le concept 3D reste affiché.", error);
    }
  }
}
