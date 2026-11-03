// A simple sprite exercise, separate from the real robot's two-sensor algorithm.
const track = Array.from({ length: 256 }, (_, i) => {
  const angle = i * Math.PI * 2 / 256;
  return [156 * Math.cos(angle), 96 * Math.sin(angle)];
});
export function isOnLine(x, y) {
  return track.some(([tx, ty]) => (x - tx) ** 2 + (y - ty) ** 2 <= 49);
}

// Sample the original arrow costume, including its rotated footprint.
export function spriteTouchesLine(pose) {
  const angle = pose.heading * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let x = -11; x <= 13; x += 2) {
    const halfHeight = (13 - x) * 0.4;
    for (let y = -halfHeight; y <= halfHeight; y += 2) {
      if (x < -7 && Math.abs(y) < (-7 - x) * 2) continue;
      if (isOnLine(pose.x + x * c - y * s, pose.y - x * s - y * c)) return true;
    }
  }
  return false;
}

export function advanceSprite(pose, step = 2, turn = 2) {
  const onLine = spriteTouchesLine(pose);
  const heading = (pose.heading + (onLine ? 0 : turn)) % 360;
  const radians = heading * Math.PI / 180;
  const amount = onLine ? step : 1;
  return {
    x: pose.x + Math.cos(radians) * amount,
    y: pose.y - Math.sin(radians) * amount,
    heading,
    onLine,
  };
}

export function decideLineAction(left, right, lastDirection = "left", lostMs = 0) {
  if (left && right) return "straight";
  if (left) return "left";
  if (right) return "right";
  if (lostMs >= 2000) return "stop";
  return lastDirection === "right" ? "search-right" : "search-left";
}
