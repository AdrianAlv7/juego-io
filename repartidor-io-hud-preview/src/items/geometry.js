import Phaser from "phaser";

export function rotatePoint(x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

export function getRotatedRectPoints(centerX, centerY, width, height, angle) {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];

  return corners.map((corner) => {
    const rotated = rotatePoint(corner.x, corner.y, angle);
    return {
      x: centerX + rotated.x,
      y: centerY + rotated.y,
    };
  });
}

export function worldToLocalPoint(x, y, centerX, centerY, angle) {
  return rotatePoint(x - centerX, y - centerY, -angle);
}

export function circleIntersectsRotatedRect(circleX, circleY, radius, rect) {
  const local = worldToLocalPoint(circleX, circleY, rect.x, rect.y, rect.angle);
  const halfWidth = rect.width * 0.5;
  const halfHeight = rect.height * 0.5;
  const closestX = Phaser.Math.Clamp(local.x, -halfWidth, halfWidth);
  const closestY = Phaser.Math.Clamp(local.y, -halfHeight, halfHeight);
  const deltaX = local.x - closestX;
  const deltaY = local.y - closestY;

  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
}

export function resolveCircleRectCollision(circleX, circleY, radius, rect) {
  const local = worldToLocalPoint(circleX, circleY, rect.x, rect.y, rect.angle);
  const halfWidth = rect.width * 0.5;
  const halfHeight = rect.height * 0.5;
  const closestX = Phaser.Math.Clamp(local.x, -halfWidth, halfWidth);
  const closestY = Phaser.Math.Clamp(local.y, -halfHeight, halfHeight);
  let deltaX = local.x - closestX;
  let deltaY = local.y - closestY;
  let distanceSq = deltaX * deltaX + deltaY * deltaY;

  if (distanceSq > radius * radius) {
    return null;
  }

  let normalLocalX = 0;
  let normalLocalY = 0;
  let penetration = 0;

  if (distanceSq <= 0.0001) {
    const overlapX = halfWidth + radius - Math.abs(local.x);
    const overlapY = halfHeight + radius - Math.abs(local.y);
    if (overlapX < overlapY) {
      normalLocalX = local.x >= 0 ? 1 : -1;
      penetration = overlapX;
    } else {
      normalLocalY = local.y >= 0 ? 1 : -1;
      penetration = overlapY;
    }
  } else {
    const distance = Math.sqrt(distanceSq);
    normalLocalX = deltaX / distance;
    normalLocalY = deltaY / distance;
    penetration = radius - distance;
  }

  const worldNormal = rotatePoint(normalLocalX, normalLocalY, rect.angle);

  return {
    penetration: Math.max(0, penetration),
    normalX: worldNormal.x,
    normalY: worldNormal.y,
  };
}
