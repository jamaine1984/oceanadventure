import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { smoothWalkVelocity, walkFacing } from '../../src/walk-motion.ts';

const angleError = (a, b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
test('body turns to face backward travel without changing the camera heading', () => {
  let rotation = 0;
  for (let i=0;i<60;i++) rotation=walkFacing(rotation,0,.02,1/60);
  assert.ok(Math.abs(angleError(rotation,Math.PI))<.001);
});
test('all eight directions use the shortest smooth turn and converge', () => {
  for(let direction=0;direction<8;direction++) {
    const heading=direction*Math.PI/4, dx=Math.sin(heading)*.02, dz=-Math.cos(heading)*.02;
    let rotation=1.3;
    for(let i=0;i<120;i++) {
      const next=walkFacing(rotation,dx,dz,1/60);
      assert.ok(Math.abs(next-rotation)<=8/60+.0000001);rotation=next;
    }
    assert.ok(Math.abs(angleError(rotation,-heading))<.001);
  }
});
test('turning across the angle seam does not make a full spin', () => {
  const current=Math.PI-.02, target=-Math.PI+.02;
  const next=walkFacing(current,-Math.sin(target)*.02,-Math.cos(target)*.02,1/60);
  assert.ok(next>current);assert.ok(next-current<.04);
});
test('idle and blocked travel preserve facing', () => {
  assert.equal(walkFacing(2.4,0,0,1/60),2.4);
});
test('walking accelerates gently, respects target pace, and stops promptly', () => {
  const velocity=new Vector3(),target=new Vector3(0,0,-1.4);
  smoothWalkVelocity(velocity,target,1/60);assert.ok(velocity.length()>0&&velocity.length()<.3);
  for(let i=0;i<60;i++)smoothWalkVelocity(velocity,target,1/60);
  assert.ok(Math.abs(velocity.length()-1.4)<.001);
  for(let i=0;i<30;i++)smoothWalkVelocity(velocity,new Vector3(),1/60);
  assert.equal(velocity.length(),0);
});
test('acceleration is frame-rate independent', () => {
  const target=new Vector3(.7,0,-.7),a=new Vector3(),b=new Vector3();
  for(let i=0;i<30;i++)smoothWalkVelocity(a,target,1/30);
  for(let i=0;i<120;i++)smoothWalkVelocity(b,target,1/120);
  assert.ok(a.distanceTo(b)<.000000001);
});
