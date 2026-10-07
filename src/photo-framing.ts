import { Box2, Box3, Camera, Object3D, Vector2, Vector3, MathUtils } from 'three';

export function projectedSubjectBounds(subject: Object3D, camera: Camera): Box2 {
  const world = new Box3().setFromObject(subject), frame = new Box2();
  for (const x of [world.min.x, world.max.x]) for (const y of [world.min.y, world.max.y]) for (const z of [world.min.z, world.max.z]) {
    const point = new Vector3(x, y, z).project(camera);
    frame.expandByPoint(new Vector2(point.x, point.y));
  }
  return frame;
}

export function photographCrop(subject: Object3D, camera: Camera, canvasWidth: number, canvasHeight: number) {
  const frame = projectedSubjectBounds(subject, camera), size = frame.getSize(new Vector2()), center = frame.getCenter(new Vector2());
  const width = Math.min(canvasWidth, canvasHeight * 1.6, Math.max(size.x * canvasWidth * .8, size.y * canvasHeight * 1.28, canvasWidth * .08));
  const height = width / 1.6;
  return {
    x: MathUtils.clamp((center.x + 1) * canvasWidth * .5 - width * .5, 0, canvasWidth - width),
    y: MathUtils.clamp((1 - center.y) * canvasHeight * .5 - height * .5, 0, canvasHeight - height),
    width, height,
  };
}
