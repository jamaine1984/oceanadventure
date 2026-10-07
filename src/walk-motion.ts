import { MathUtils, type Vector3 } from 'three';

export function smoothWalkVelocity(velocity: Vector3, target: Vector3, delta: number) {
  velocity.lerp(target, 1 - Math.exp(-(target.lengthSq() > .0001 ? 10 : 18) * delta));
  if (velocity.lengthSq() < .000001) velocity.set(0, 0, 0);
}

export function walkFacing(rotation: number, dx: number, dz: number, delta: number) {
  if (dx * dx + dz * dz < .00000001) return rotation;
  const desired = -Math.atan2(dx, -dz);
  const error = MathUtils.euclideanModulo(desired - rotation + Math.PI, Math.PI * 2) - Math.PI;
  const step = error * (1 - Math.exp(-12 * delta));
  return rotation + MathUtils.clamp(step, -8 * delta, 8 * delta);
}
