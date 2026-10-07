import { test, expect } from '@playwright/test';
import { Color, InstancedMesh, LOD, Matrix4, MeshBasicMaterial, PerspectiveCamera, SphereGeometry, Vector3 } from 'three';
import { spatialLod } from '../src/spatial-lod';

test('spatial LOD preserves instance transforms, tint and shadows', () => {
  const geometry = new SphereGeometry(1, 24, 16), low = new SphereGeometry(1, 8, 6), material = new MeshBasicMaterial();
  const source = new InstancedMesh(geometry, material, 3); source.castShadow = source.receiveShadow = true;
  const positions = [[3, -12, -85], [7, -10, -82], [42, -13, -109]];
  positions.forEach(([x, y, z], i) => { source.setMatrixAt(i, new Matrix4().makeTranslation(x, y, z)); source.setColorAt(i, new Color(.2 + i * .1, .4, .6)); });
  const group = spatialLod(source, [geometry, low]); group.updateMatrixWorld(true);
  expect(group.children).toHaveLength(2);
  const actual: number[][] = [];
  for (const chunk of group.children as LOD[]) {
    const batch = chunk.levels[0].object as InstancedMesh;
    expect(batch.castShadow).toBe(true); expect(batch.receiveShadow).toBe(true);
    expect(batch.instanceColor).not.toBeNull(); expect(batch.boundingSphere).not.toBeNull();
    for (let i = 0; i < batch.count; i++) { const matrix = new Matrix4(); batch.getMatrixAt(i, matrix); actual.push(new Vector3().setFromMatrixPosition(matrix.premultiply(batch.matrixWorld)).toArray()); }
  }
  expect(actual).toEqual(positions);
  geometry.dispose(); low.dispose(); material.dispose();
});

test('near camera keeps authored geometry and distant camera selects reduced geometry', () => {
  const high = new SphereGeometry(1, 24, 16), medium = new SphereGeometry(1, 12, 8), low = new SphereGeometry(1, 8, 6);
  const source = new InstancedMesh(high, new MeshBasicMaterial(), 1); source.setMatrixAt(0, new Matrix4().makeTranslation(0, -12, -85));
  const group = spatialLod(source, [high, medium, low]); group.updateMatrixWorld(true);
  const lod = group.children[0] as LOD, camera = new PerspectiveCamera();
  for (const [distance, level] of [[10, 0], [40, 1], [90, 2]]) {
    camera.position.copy(lod.position).add(new Vector3(0, 0, distance)); camera.updateMatrixWorld(); lod.update(camera);
    expect(lod.levels[level].object.visible).toBe(true);
    expect(lod.levels.filter(entry => entry.object.visible)).toHaveLength(1);
  }
  high.dispose(); medium.dispose(); low.dispose();
});
