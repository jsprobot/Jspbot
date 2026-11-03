import test from "node:test";
import assert from "node:assert/strict";
import { Box3, Matrix4, PerspectiveCamera, Vector3 } from "three";
import { createConcept } from "../js/robot-scene.js";

test("rover geometry stays finite and inside the camera through a complete rotation", () => {
  const model = createConcept();
  const bounds = new Box3().setFromObject(model);
  assert.ok(bounds.min.y > -0.02, "Tires rest on the ground");
  assert.ok(bounds.max.y < 2.1, "Rover has the low profile of the illustrations");
  assert.equal(model.userData.wheels.length, 4);
  assert.equal(model.userData.head, undefined);
  const instance = new Matrix4(), world = new Matrix4();
  for (const aspect of [0.65, 0.8, 1, 1.4, 1.7]) {
    const camera = new PerspectiveCamera(36, aspect, 0.1, 60);
    const vertical = Math.PI / 5;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
    const distance = 2.45 / Math.sin(Math.min(vertical, horizontal) / 2) * 1.02;
    camera.position.copy(new Vector3(4.2, 2.8, 6.2).normalize().multiplyScalar(distance)).add(new Vector3(0, 1.03, 0));
    camera.lookAt(0, 1.03, 0);
    camera.updateMatrixWorld();
    for (let step = 0; step < 16; step++) {
      model.rotation.y = step * Math.PI / 8;
      model.updateMatrixWorld(true);
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox;
        for (let i = 0; i < (object.isInstancedMesh ? object.count : 1); i++) {
          if (object.isInstancedMesh) { object.getMatrixAt(i, instance); world.multiplyMatrices(object.matrixWorld, instance); }
          else world.copy(object.matrixWorld);
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const point = new Vector3(x, y, z).applyMatrix4(world).project(camera);
            assert.ok([point.x, point.y, point.z].every(Number.isFinite));
            assert.ok(Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95, "Model must not clip at aspect " + aspect);
          }
        }
      });
    }
  }
});
