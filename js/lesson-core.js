// Line-following demo for a sprite, independent of the real mBot Ranger hardware.
// The dots on the sprite act like two small optical sensors over the black oval.
const RADIUS_X = 156;
const RADIUS_Y = 96;
const SENSOR_FORWARD = 12;
const SENSOR_SIDE = 7;
const LINE_REACH = 9; // 7 px half-width + 2 px sensor radius

export function isOnLine(x, y) {
  const ellipse = (x / RADIUS_X) ** 2 + (y / RADIUS_Y) ** 2 - 1;
  const slope = 2 * Math.hypot(x / (RADIUS_X ** 2), y / (RADIUS_Y ** 2));
  return slope > 0 && Math.abs(ellipse) / slope <= LINE_REACH;
}

export function readSpriteSensors(pose) {
  const angle = pose.heading * Math.PI / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pointOnLine = (side) => {
    const x = pose.x + SENSOR_FORWARD * c - side * s;
    const y = pose.y + SENSOR_FORWARD * s + side * c;
    return isOnLine(x, y);
  };
  return { left: pointOnLine(SENSOR_SIDE), right: pointOnLine(-SENSOR_SIDE) };
}

export function decideLineAction(left, right, lastDirection = "left", lostMs = 0) {
  if (left && right) return "straight";
  if (left) return "left";
  if (right) return "right";
  if (lostMs >= 2000) return "stop";
  return lastDirection === "right" ? "search-right" : "search-left";
}

export function advanceSprite(pose, step = 2, turn = 3) {
  const { left, right } = readSpriteSensors(pose);
  const lastDirection = pose.lastDirection || "right";
  const action = decideLineAction(left, right, lastDirection);
  const steer = action === "left" || action === "search-left" ? turn :
    action === "right" || action === "search-right" ? -turn : 0;
  const heading = (pose.heading + steer + 360) % 360;
  const distance = left || right ? step : 1;
  const radians = heading * Math.PI / 180;
  return {
    x: pose.x + Math.cos(radians) * distance,
    y: pose.y + Math.sin(radians) * distance,
    heading,
    lastDirection: action === "left" ? "left" :
      action === "right" ? "right" : lastDirection,
    left,
    right,
    action,
    onLine: left || right,
  };
}
