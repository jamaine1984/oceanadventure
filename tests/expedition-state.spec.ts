import { expect, test } from '@playwright/test';
import { nearestSample, newExpedition, SAMPLE_SITES, LAGOON_SITE, LAGOON_SAMPLES, TRANSECT_STATIONS, PASSAGE_SITE, PASSAGE_SAMPLES, PASSAGE_STATIONS, expeditionPlan, surveyPhotoCount, reefComplete, recoveryComplete, nearestTransect, passageApproach, passageExit, stableTransectReading, sanitizeExpedition, expeditionReward, completedObjectives } from '../src/expedition-state';
import { expeditionFloor, limestoneArchBounds, passageClearanceHeight } from '../src/expedition-world';
import { Vector3 } from 'three';
import { wildlifePose } from '../src/wildlife-motion';

test('either sample can be collected first and the remaining site becomes the target', () => {
  const record = newExpedition();
  expect(nearestSample(record, SAMPLE_SITES.sediment)?.key).toBe('sediment');
  expect(nearestSample(record, SAMPLE_SITES.sediment)?.inRange).toBe(true);
  record.sedimentSample = true;
  expect(nearestSample(record, SAMPLE_SITES.sediment)?.key).toBe('water');
  record.waterSample = true;
  expect(nearestSample(record, SAMPLE_SITES.water)).toBeUndefined();
  record.sedimentSample = false;
  expect(nearestSample(record, SAMPLE_SITES.water)?.key).toBe('sediment');
});

test('new contracts cycle three routes while existing and legacy saves retain their route', () => {
  expect(newExpedition(1).route).toBe('reef');expect(newExpedition(2).route).toBe('lagoon');expect(newExpedition(3).route).toBe('passage');expect(newExpedition(4).route).toBe('reef');
  const active=newExpedition(3);active.route='reef';expect(sanitizeExpedition(active).route).toBe('reef');
  active.run=4;active.route='lagoon';expect(sanitizeExpedition(active).route).toBe('lagoon');
  const old=newExpedition(2);delete (old as any).route;
  expect(sanitizeExpedition(old).route).toBe('reef');
  expect(expeditionPlan(sanitizeExpedition(old)).samples.water).toEqual(SAMPLE_SITES.water);
  expect(expeditionPlan(newExpedition(2)).site).toEqual(LAGOON_SITE);
});

test('passage observations, ordered readings, reward and partial resume cannot skip the arch interior', () => {
  const record=newExpedition(3);record.photos=['turtle','tang'];record.waterSample=record.sedimentSample=true;
  expect(reefComplete(record)).toBe(true);
  expect(nearestTransect(record,PASSAGE_STATIONS[2])?.index).toBe(0);
  record.transectReadings=[0];record.checkpoint='transect';
  expect(nearestTransect(record,PASSAGE_STATIONS[2])?.index).toBe(1);
  expect(sanitizeExpedition(record).stage).toBe('transect');
  expect(sanitizeExpedition(record).checkpoint).toBe('transect');
  record.transectReadings=[0,2];expect(sanitizeExpedition(record).transectReadings).toEqual([0]);
  record.transectReadings=[2];record.sold=true;expect(sanitizeExpedition(record).sold).toBe(false);expect(sanitizeExpedition(record).transectReadings).toEqual([]);
  record.transectReadings=[0,1,2];expect(recoveryComplete(record)).toBe(true);expect(expeditionReward(record)).toBe(1680);
  expect(sanitizeExpedition(record).saleCredits).toBe(1680);expect(completedObjectives(record)).toBe(8);
  expect(nearestSample(newExpedition(3),PASSAGE_SAMPLES.sediment)?.inRange).toBe(true);
});

test('limestone collision shell leaves the ordered swim corridor and research sites accessible', () => {
  const bounds=limestoneArchBounds();
  for(let z=-130;z>=-153;z-=.5) {
    const point=new Vector3(PASSAGE_SITE.x,-19,z);
    for(const bound of bounds) {
      const delta=point.clone().sub(bound.center),r=bound.radii;
      expect((delta.x/(r.x+.45))**2+(delta.y/(r.y+.55))**2+(delta.z/(r.z+.45))**2).toBeGreaterThan(1);
    }
  }
  expect(bounds.some(bound=>Math.abs(bound.center.x-PASSAGE_SITE.x)<.1)).toBe(true);
  for(const site of [...PASSAGE_STATIONS,...Object.values(PASSAGE_SAMPLES)])expect(site.y).toBeGreaterThan(expeditionFloor(site.x,site.z)+.8);
});

test('partial passage reload descends at the southern entrance before approaching the next station', () => {
  const record=newExpedition(3);record.stage='transect';record.transectReadings=[0,1];
  expect(passageApproach(record,{x:174,y:0,z:-112})).toEqual({x:166,y:-19,z:-128});
  expect(passageApproach(record,{x:174,y:-19,z:-128})).toBeDefined();
  expect(passageApproach(record,{x:166,y:-18.2,z:-128})).toBeUndefined();
  expect(passageApproach(record,PASSAGE_STATIONS[1])).toBeUndefined();
  record.transectReadings=[0,1,2];expect(passageApproach(record,{x:174,y:0,z:-112})).toBeUndefined();
});

test('passage boarding keeps the diver below the roof until clear of the appropriate exit', () => {
  const record=newExpedition(3),interior={x:166,y:-19,z:-140};
  expect(passageExit(record,interior,{z:-112})).toEqual({x:166,y:-19,z:-128});
  expect(passageExit(record,interior,{z:-168})).toEqual({x:166,y:-19,z:-153});
  expect(passageExit(record,{...interior,z:-129.9},{z:-112})).toBeUndefined();
  expect(passageExit(record,{...interior,z:-151.1},{z:-168})).toBeUndefined();
  expect(passageExit(record,{...interior,y:-10},{z:-112})).toBeUndefined();
  expect(passageExit(newExpedition(2),interior,{z:-112})).toBeUndefined();
});

test('a vessel parked above the vault requires a vertical outside ascent before surface guidance', () => {
  const record=newExpedition(3);
  expect(passageExit(record,{x:166,y:-19,z:-129.9},{z:-137})).toEqual({x:166,y:-10,z:-129.9});
  expect(passageExit(record,{x:166,y:-19,z:-151.1},{z:-145})).toEqual({x:166,y:-10,z:-151.1});
  expect(passageExit(record,{x:166,y:-11.9,z:-129.9},{z:-137})).toBeUndefined();
  expect(passageExit(record,{x:166,y:-11.9,z:-151.1},{z:-145})).toBeUndefined();
  const clearance=passageClearanceHeight();
  for(const bound of limestoneArchBounds())expect(clearance).toBeGreaterThan(bound.center.y+bound.radii.y+.55);
  expect(passageExit(record,{x:166,y:-19,z:-129.9},{z:-137},clearance)?.y).toBe(clearance+2);
  expect(passageExit(record,{x:166,y:clearance+.01,z:-129.9},{z:-137},clearance)).toBeUndefined();
});

test('wildlife trajectories are smooth, face their motion and vary by species', () => {
  for(const key of ['turtle','ray','tang'] as const)for(const time of [0,15,40,90]) {
    const pose=wildlifePose(key,time,8,.06,.4),next=wildlifePose(key,time+.01,8,.06,.4);
    expect(Math.hypot(next.x-pose.x,next.y-pose.y,next.z-pose.z)).toBeLessThan(.01);
    const dx=next.x-pose.x,dz=next.z-pose.z,length=Math.hypot(dx,dz);
    expect(Math.cos(pose.yaw)*dx/length-Math.sin(pose.yaw)*dz/length).toBeGreaterThan(.999);
    expect(Math.abs(pose.stroke)).toBeLessThanOrEqual(.25);
  }
  expect(wildlifePose('turtle',40,8,.06,.4).y).not.toBe(wildlifePose('ray',40,8,.06,.4).y);
});

test('lagoon completion needs both target species and all three unique readings, not wreck flags', () => {
  const record=newExpedition(2);Object.assign(record,{stage:'reef',waterSample:true,sedimentSample:true,photos:['tang','anthias']});
  expect(surveyPhotoCount(record)).toBe(0);expect(reefComplete(record)).toBe(false);
  record.photos=['turtle','ray'];expect(reefComplete(record)).toBe(true);
  record.cableFreed=record.sensorRecovered=true;expect(recoveryComplete(record)).toBe(false);
  record.transectReadings=[0,1,2];expect(recoveryComplete(record)).toBe(true);
  expect(expeditionReward(record)).toBe(1540);expect(completedObjectives(record)).toBe(7);
  expect(sanitizeExpedition(record).stage).toBe('return');record.sold=true;
  const sold=sanitizeExpedition(record);expect(sold.stage).toBe('complete');expect(sold.saleCredits).toBe(1540);expect(completedObjectives(sold)).toBe(8);
});

test('partial readings and lagoon sample targeting survive sanitization without duplicates or false completion', () => {
  const record=newExpedition(2);Object.assign(record,{stage:'transect',checkpoint:'transect',photos:['turtle','ray','tang'],waterSample:true,sedimentSample:true,transectReadings:[0,0,1,-1,9,1.5]});
  const saved=sanitizeExpedition(record);expect(saved.photos).toEqual(['turtle','ray']);expect(saved.transectReadings).toEqual([0,1]);expect(saved.stage).toBe('transect');expect(saved.checkpoint).toBe('transect');
  expect(nearestTransect(saved,TRANSECT_STATIONS[0])?.index).toBe(2);
  saved.sedimentSample=false;expect(nearestSample(saved,LAGOON_SAMPLES.sediment)?.inRange).toBe(true);
  expect(sanitizeExpedition(saved).checkpoint).toBe('reef');
  const interrupted=newExpedition(2);interrupted.stage='transect';interrupted.transectReadings=[0];
  expect(sanitizeExpedition(interrupted).stage).toBe('reef');
});

test('acoustic dwell requires a stable nearby station and all targets remain above accessible terrain', () => {
  expect(stableTransectReading(3.49,.54)).toBe(true);expect(stableTransectReading(3.5,0)).toBe(false);expect(stableTransectReading(2,.55)).toBe(false);
  for(const station of TRANSECT_STATIONS)expect(station.y).toBeGreaterThan(expeditionFloor(station.x,station.z)+.8);
  expect(expeditionFloor(LAGOON_SITE.x,LAGOON_SITE.z)).toBeGreaterThan(-14);
  expect(Math.abs(LAGOON_SAMPLES.sediment.y-(expeditionFloor(LAGOON_SAMPLES.sediment.x,LAGOON_SAMPLES.sediment.z)+.8))).toBeLessThan(2.3);
});

test('sample readiness uses the same strict three-dimensional ranges as collection', () => {
  const record = newExpedition();
  const water = SAMPLE_SITES.water;
  expect(nearestSample(record, { ...water, y: water.y + 3.99 })?.inRange).toBe(true);
  expect(nearestSample(record, { ...water, y: water.y + 4 })?.inRange).toBe(false);
  record.waterSample = true;
  const sediment = SAMPLE_SITES.sediment;
  expect(nearestSample(record, { ...sediment, x: sediment.x + 3.59 })?.inRange).toBe(true);
  expect(nearestSample(record, { ...sediment, x: sediment.x + 3.61 })?.inRange).toBe(false);
});
