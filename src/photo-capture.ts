import { HalfFloatType, PerspectiveCamera, Scene, Vector4, WebGLRenderer, WebGLRenderTarget } from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { photographCrop } from './photo-framing';

type Crop = ReturnType<typeof photographCrop>;

export function photographCamera(camera: PerspectiveCamera, width: number, height: number, crop: Crop) {
  const capture = camera.clone();
  capture.setViewOffset(width, height, crop.x, crop.y, crop.width, crop.height);
  return capture;
}

// Render the subject crop directly, independent of the live game's adaptive
// resolution. OutputPass preserves the renderer's tone mapping and sRGB output.
export function capturePhotograph(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, crop: Crop) {
  const width = 640, height = 400;
  const capture = photographCamera(camera, renderer.domElement.width, renderer.domElement.height, crop);
  const hdr = new WebGLRenderTarget(width, height, { type: HalfFloatType, samples: 4 });
  const output = new WebGLRenderTarget(width, height, { depthBuffer: false });
  const pass = new OutputPass();
  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace(), previousLevel = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new Vector4()), scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
  try {
    renderer.autoClear = true;
    renderer.setRenderTarget(hdr);
    renderer.render(scene, capture);
    pass.render(renderer, output, hdr, 0, false);
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(output, 0, 0, width, height, pixels);
    const source = document.createElement('canvas'); source.width = width; source.height = height;
    const context = source.getContext('2d');
    if (!context) throw new Error('Photograph canvas unavailable');
    const bitmap = context.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      const start = (height - row - 1) * width * 4;
      bitmap.data.set(pixels.subarray(start, start + width * 4), row * width * 4);
    }
    context.putImageData(bitmap, 0, 0);
    const thumbnail = document.createElement('canvas'); thumbnail.width = 320; thumbnail.height = 200;
    const thumbnailContext = thumbnail.getContext('2d');
    if (!thumbnailContext) throw new Error('Photograph thumbnail unavailable');
    thumbnailContext.imageSmoothingQuality = 'high';
    thumbnailContext.drawImage(source, 0, 0, 320, 200);
    return thumbnail.toDataURL('image/jpeg', .7);
  } finally {
    renderer.setRenderTarget(previousTarget, previousFace, previousLevel);
    renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
    renderer.autoClear = autoClear;
    hdr.dispose(); output.dispose(); pass.dispose();
  }
}
