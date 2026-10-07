import { test, expect } from '@playwright/test';
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { photographCrop, projectedSubjectBounds } from '../src/photo-framing';
import { photographCamera } from '../src/photo-capture';

test('photograph crop follows projected subject bounds instead of a wide viewport minimum', () => {
  const camera = new PerspectiveCamera(60, 1280 / 720, .1, 100); camera.updateMatrixWorld();
  const subject = new Mesh(new BoxGeometry(1.2, .5, .3), new MeshBasicMaterial());
  subject.position.set(1, 0, -10); subject.updateMatrixWorld();
  const frame = projectedSubjectBounds(subject, camera), crop = photographCrop(subject, camera, 1280, 720);
  expect(crop.width / crop.height).toBeCloseTo(1.6);
  expect(crop.width).toBeLessThan(200);
  expect(crop.x).toBeLessThan((frame.min.x + 1) * 640);
  expect(crop.x + crop.width).toBeGreaterThan((frame.max.x + 1) * 640);
  expect(crop.y).toBeLessThan((1 - frame.max.y) * 360);
  expect(crop.y + crop.height).toBeGreaterThan((1 - frame.min.y) * 360);
  subject.geometry.dispose(); subject.material.dispose();
});

test('dedicated photograph camera enlarges the same subject without mutating the live view', () => {
  const camera = new PerspectiveCamera(60, 1280 / 720, .1, 100); camera.updateMatrixWorld();
  const original = camera.projectionMatrix.clone();
  const subject = new Mesh(new BoxGeometry(1.2, .5, .3), new MeshBasicMaterial());
  subject.position.set(1, 0, -10); subject.updateMatrixWorld();
  const crop = photographCrop(subject, camera, 1280, 720);
  const capture = photographCamera(camera, 1280, 720, crop); capture.updateMatrixWorld();
  const frame = projectedSubjectBounds(subject, capture);
  expect(frame.min.x).toBeGreaterThan(-1); expect(frame.max.x).toBeLessThan(1);
  expect(frame.min.y).toBeGreaterThan(-1); expect(frame.max.y).toBeLessThan(1);
  expect(frame.max.x-frame.min.x).toBeGreaterThan(.7);
  expect(camera.projectionMatrix.equals(original)).toBe(true);
  expect(camera.view).toBeNull();
  subject.geometry.dispose(); subject.material.dispose();
});

test('portrait photograph crop remains inside the source canvas', () => {
  const camera = new PerspectiveCamera(60, 390 / 844, .1, 100); camera.updateMatrixWorld();
  const subject = new Mesh(new BoxGeometry(1, .4, .2), new MeshBasicMaterial());
  subject.position.set(1, 1, -3); subject.updateMatrixWorld();
  const crop = photographCrop(subject, camera, 390, 844);
  expect(crop.x).toBeGreaterThanOrEqual(0); expect(crop.y).toBeGreaterThanOrEqual(0);
  expect(crop.x + crop.width).toBeLessThanOrEqual(390); expect(crop.y + crop.height).toBeLessThanOrEqual(844);
  expect(crop.width / crop.height).toBeCloseTo(1.6);
  subject.geometry.dispose(); subject.material.dispose();
});
