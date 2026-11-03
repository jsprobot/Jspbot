import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MODEL_CONFIG } from "../model-config.js";

// Procedural interpretation of the documented Land Raider configuration.
// The manufacturer's images remain the reference for the real mBot Ranger.
export function createConcept() {
  const robot = new THREE.Group();
  const mat = (color, metalness = 0.3, roughness = 0.5) => new THREE.MeshStandardMaterial({color, metalness, roughness});
  const blue = mat(0x367ea3, 0.7, 0.32), metal = mat(0xaebbc3, 0.82, 0.3);
  const black = mat(0x172126, 0.1, 0.6), rubber = mat(0x202529, 0.02, 0.9);
  const pcb = mat(0x284239, 0.25, 0.6), red = mat(0xb75954), yellow = mat(0xc4ae67);
  const white = mat(0xdfe5dc, 0.25, 0.5);
  const cache = new Map();
  function geometry(key, make) { if(!cache.has(key))cache.set(key,make()); return cache.get(key); }
  function mesh(geo, material, position, parent = robot) { const m = new THREE.Mesh(geo,material);m.position.set(...position);parent.add(m);return m; }
  function box(w,h,d,r,material,position,parent) { return mesh(geometry(['b',w,h,d,r].join('/'),()=>new RoundedBoxGeometry(w,h,d,2,r)),material,position,parent); }
  function cylinder(radius,height,material,position,parent,segments=32) { return mesh(geometry(['c',radius,height,segments].join('/'),()=>new THREE.CylinderGeometry(radius,radius,height,segments)),material,position,parent); }
  function cable(points,material) { const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,30,0.018,6,false),material,[0,0,0]); }
  function capsule(w,h) {
    const s = new THREE.Shape(), r=h/2, x=w/2;
    s.moveTo(-x+r,-r);s.lineTo(x-r,-r);s.absarc(x-r,0,r,-Math.PI/2,Math.PI/2,false);s.lineTo(-x+r,r);s.absarc(-x+r,0,r,Math.PI/2,Math.PI*1.5,false);s.closePath();return s;
  }
  function perforatedPlate(w,h,depth,columns,rows) {
    const s=new THREE.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();
    for(let c=0;c<columns;c++)for(let r=0;r<rows;r++){
      const x=columns===1?0:-w*.4+c*w*.8/(columns-1),y=rows===1?0:-h*.36+r*h*.72/(rows-1);
      const hole=new THREE.Path();hole.absarc(x,y,0.045,0,Math.PI*2,true);s.holes.push(hole);
    }
    return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:6});
  }
  const tracks=[], wheels=[];
  const outer=capsule(2.72,1.02);outer.holes.push(capsule(2.46,.78));
  const beltGeometry = new THREE.ExtrudeGeometry(outer,{depth:.3,bevelEnabled:false,curveSegments:18});
  beltGeometry.translate(0,0,-.15);beltGeometry.rotateY(Math.PI/2);
  const points=capsule(2.72,1.02).getSpacedPoints(72);
  [-1,1].forEach(side=>{
    const track=new THREE.Group();track.position.set(side*1.2,.57,0);robot.add(track);tracks.push(track);
    mesh(beltGeometry,rubber,[0,0,0],track);
    const treadGeometry=geometry('tread',()=>new THREE.BoxGeometry(.36,.047,.11));
    const treads=new THREE.InstancedMesh(treadGeometry,rubber,points.length-1),temp=new THREE.Object3D();
    for(let i=0;i<points.length-1;i++){
      const p=points[i],n=points[i+1];temp.position.set(0,p.y,-p.x);temp.rotation.set(Math.atan2(-(n.y-p.y),-(n.x-p.x)),0,0);temp.updateMatrix();treads.setMatrixAt(i,temp.matrix);
    }
    treads.instanceMatrix.needsUpdate=true;track.add(treads);
    [-.83,.83].forEach(z=>{
      const wheel=new THREE.Group();wheel.position.set(0,0,z);track.add(wheel);wheels.push(wheel);
      const tire=cylinder(.39,.31,black,[0,0,0],wheel,40);tire.rotation.z=Math.PI/2;
      const hub=cylinder(.255,.032,black,[side*.174,0,0],wheel,40);hub.rotation.z=Math.PI/2;
      const cap=cylinder(.092,.045,blue,[side*.2,0,0],wheel);cap.rotation.z=Math.PI/2;
      const nut=cylinder(.042,.05,metal,[side*.226,0,0],wheel,6);nut.rotation.z=Math.PI/2;
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        const recess=cylinder(.034,.035,rubber,[side*.195,Math.sin(a)*.19,Math.cos(a)*.19],wheel,12);recess.rotation.z=Math.PI/2;
      }
    });
    [-.25,.25].forEach(z=>{const roller=cylinder(.19,.28,black,[0,-.25,z],track);roller.rotation.z=Math.PI/2;});
    const motor=cylinder(.2,.5,metal,[side*.82,.66,-.37]);motor.rotation.z=Math.PI/2;
    box(.17,.12,1.85,.015,blue,[side*.91,.88,0]);
  });
  box(1.45,.31,1.55,.04,black,[0,.65,-.12]);
  const deck=mesh(perforatedPlate(1.97,1.72,.065,7,5),blue,[0,.88,-.06]);deck.rotation.x=-Math.PI/2;
  mesh(perforatedPlate(2.15,.25,.06,8,1),blue,[0,.94,1.01]);
  mesh(perforatedPlate(1.82,.25,.06,7,1),blue,[0,.94,-1.02]);
  [-.81,.81].forEach(x=>[-.72,.58].forEach(z=>{cylinder(.045,.26,metal,[x,1.02,z]);cylinder(.063,.03,metal,[x,1.158,z],robot,6);}));
  box(1.8,.13,1.42,.05,black,[0,1.16,-.18]);
  box(1.62,.03,1.27,.02,pcb,[0,1.24,-.18]);
  box(1.87,.025,.045,.01,metal,[0,1.33,-.86]);
  box(1.87,.025,.045,.01,metal,[0,1.33,.5]);
  [-.92,.92].forEach(x=>box(.035,.025,1.38,.01,metal,[x,1.33,-.18]));
  cylinder(.48,.035,black,[0,1.277,-.05],robot,48);
  const ledMaterials=[red,mat(0x49765f),mat(0x4c6eaa)];
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;box(.075,.025,.075,.012,ledMaterials[i%3],[Math.sin(a)*.405,1.31,-.05+Math.cos(a)*.405]);
  }
  cylinder(.11,.037,metal,[0,1.31,-.05]);cylinder(.075,.04,black,[0,1.33,-.05]);
  [-1,1].forEach(side=>{
    for(let i=0;i<5;i++){
      box(.21,.12,.18,.015,black,[side*.71,1.32,-.65+i*.255]);
      box(.21,.025,.18,.008,i<2?red:yellow,[side*.71,1.39,-.65+i*.255]);
      box(.008,.055,.115,.002,metal,[side*.819,1.32,-.65+i*.255]);
    }
  });
  box(.26,.13,.2,.01,metal,[.35,1.33,-.84]);box(.2,.08,.006,.003,black,[.35,1.33,-.944]);
  box(.28,.32,.075,.01,blue,[0,1.16,.98]);
  box(1.17,.38,.08,.015,black,[0,1.46,1.03]);
  [-.32,.32].forEach(x=>{
    const sensor=cylinder(.18,.145,metal,[x,1.46,1.145],robot,40);sensor.rotation.x=Math.PI/2;
    mesh(geometry('sensor-face',()=>new THREE.CircleGeometry(.144,40)),black,[x,1.46,1.224]);
    mesh(geometry('sensor-rim',()=>new THREE.TorusGeometry(.165,.012,8,40)),metal,[x,1.46,1.227]);
    for(let i=1;i<=4;i++)mesh(geometry('sensor-mesh-'+i,()=>new THREE.RingGeometry(i*.03,i*.03+.003,32)),metal,[x,1.46,1.228]);
  });
  [-.5,.5].forEach(x=>{const screw=cylinder(.027,.018,yellow,[x,1.46,1.082],robot,6);screw.rotation.x=Math.PI/2;});
  box(.2,.08,.55,.015,blue,[0,.25,1.12]);
  box(.52,.045,.25,.012,white,[0,.2,1.37]);
  [-.16,.16].forEach(x=>{cylinder(.035,.05,black,[x,.16,1.39]);cylinder(.028,.022,white,[x,.16,1.48]);});
  cable([[-.62,1.31,-.62],[-.8,1.6,-.2],[-.65,1.63,.38],[-.48,1.48,.99]],black);
  cable([[.63,1.31,-.42],[.88,1.56,.1],[.74,1.5,.57],[.42,1.46,.99]],black);
  cable([[.7,.78,.5],[.83,.62,1.0],[.37,.35,1.28],[0,.24,1.3]],black);
  cable([[-.62,1.28,-.6],[-.85,1.17,-.8],[-.8,.79,-.64]],red);
  robot.userData.wheels=wheels;robot.userData.tracks=tracks;robot.userData.kind='mbot-ranger-concept';
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
