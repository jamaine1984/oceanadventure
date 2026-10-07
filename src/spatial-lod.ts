import { BufferGeometry, Color, Group, InstancedMesh, LOD, Matrix4, Vector3 } from 'three';

// Small spatial batches let the renderer cull and simplify distant colonies
// without reducing the authored detail next to the diver.
export function spatialLod(source: InstancedMesh, geometries: readonly BufferGeometry[], cellSize = 18): Group {
  const cells = new Map<string, Array<{ matrix: Matrix4; color?: Color }>>();
  const position = new Vector3();
  for (let i = 0; i < source.count; i++) {
    const matrix = new Matrix4(); source.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    const key = `${Math.floor(position.x / cellSize)},${Math.floor(position.z / cellSize)}`;
    const items = cells.get(key) ?? [];
    let color: Color | undefined;
    if (source.instanceColor) { color = new Color(); source.getColorAt(i, color); }
    items.push({ matrix, color }); cells.set(key, items);
  }
  const result = new Group(); result.name = source.name;
  for (const items of cells.values()) {
    const center = items.reduce((sum, item) => sum.add(new Vector3().setFromMatrixPosition(item.matrix)), new Vector3()).divideScalar(items.length);
    const local = new Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    const lod = new LOD(); lod.position.copy(center);
    geometries.forEach((geometry, level) => {
      const batch = new InstancedMesh(geometry, source.material, items.length);
      batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow;
      items.forEach((item, index) => {
        batch.setMatrixAt(index, item.matrix.clone().premultiply(local));
        if (item.color) batch.setColorAt(index, item.color);
      });
      batch.computeBoundingSphere(); batch.computeBoundingBox();
      lod.addLevel(batch, [0, 18, 42][level] ?? 100, .12);
    });
    result.add(lod);
  }
  source.dispose();
  return result;
}
