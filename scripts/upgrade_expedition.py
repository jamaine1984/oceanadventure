"""Install the authored expedition flow into the existing game shell."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
path = root / 'src/main.ts'
source = path.read_text(encoding='utf-8')
def replace_function(name, value):
    global source
    pattern = rf'(?:async )?function {name}\([^\n]*\)[^\n]*\{{[\s\S]*?(?=\n(?:async )?function |\ninitialize\(\)\.catch)'
    source, count = re.subn(pattern, lambda _: value.strip()+'\n', source, count=1)
    if count != 1: raise RuntimeError(f'Missing function {name}')

replace_function('initialize', r'''
async function initialize() {
  const qaMode = ['localhost', '127.0.0.1'].includes(location.hostname) ? new URLSearchParams(location.search).get('qa') : null;
  await platform.initialize();
  const previewProgress = new Map<string, string>();
  setProgressStorage(qaMode ? {
    getItem: key => previewProgress.get(key) ?? platform.storage.getItem(key),
    setItem: (key, value) => { previewProgress.set(key, value); },
  } : platform.storage);
  Object.assign(progress, loadProgress());
  if (qaMode === 'reset') Object.assign(progress, defaultProgress());
  activeContractIndex = progress.expeditions % expeditionContracts.length;
  expeditionComplete = progress.expedition.sold;
  await RAPIER.init();
  physicsWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
  physicsWorld.timestep = 1 / 60;
  createLighting(); await createOceanAndSky(); createWorld();
  await createYacht(); await createSwimmer(); createPhysics(); createInput();
  selectWeather('bluewater', false);
  restoreExpeditionCheckpoint();
  if (qaMode === 'reef' || qaMode === 'dive' || qaMode === 'wreck' || qaMode === 'return') {
    progress.expedition = newExpedition(); progress.expedition.stage = 'reef';
    if (qaMode === 'wreck' || qaMode === 'return') {
      Object.assign(progress.expedition, { photos: ['turtle', 'tang', 'butterflyfish'], waterSample: true, sedimentSample: true, stage: 'wreck', checkpoint: 'wreck' });
    } else progress.expedition.checkpoint = 'reef';
    if (qaMode === 'return') Object.assign(progress.expedition, { cableFreed: true, sensorRecovered: true, stage: 'return', checkpoint: 'harbor' });
    restoreExpeditionCheckpoint();
    if (qaMode !== 'return') {
      enterSwimMode();
      const start = qaMode === 'wreck' ? new THREE.Vector3(81, -23.8, -156) : new THREE.Vector3(0, -8.8, -85);
      swimmer.position.copy(start); swimYaw = qaMode === 'wreck' ? .3 : 0;
      camera.position.copy(start).add(new THREE.Vector3(0, .65, 6.8));
      swimmerBody.setTranslation(start, true);
    }
  } else if (qaMode === 'fleet' || qaMode === 'harbor' || qaMode === 'achievements') {
    progress.credits = Math.max(progress.credits, qaMode === 'fleet' ? 2500 : 1600);
    if (qaMode === 'achievements') progress.achievements = Object.keys(ACHIEVEMENT_CATALOG) as AchievementKey[];
    openResearchStand();
  }
  loading?.classList.add('is-hidden'); platform.loadingFinished(); platform.gameplayStart();
  if (rewardAdButton) rewardAdButton.hidden = true;
  updateHud(); renderer.setAnimationLoop(tick);
}

function restoreExpeditionCheckpoint() {
  const checkpoint = progress.expedition.checkpoint;
  const p = checkpoint === 'reef' ? { x: 0, z: -58 } : checkpoint === 'wreck' ? { x: 74, z: -141 } : { x: 0, z: 20 };
  heading = checkpoint === 'wreck' ? .4 : 0; speed = 0; throttleValue = 0;
  yacht.position.set(p.x, sampleOceanHeight(p.x, p.z, gameTime) + .18, p.z);
  boatBody.setTranslation(yacht.position, true); boatBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
}
''')
replace_function('createWorld', r'''
function createWorld() {
  expeditionWorld = new ExpeditionWorld(scene);
}
''')
replace_function('createPhysics', r'''
function createPhysics() {
  boatBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, .2, 20).setLinearDamping(.9).setAngularDamping(4.5).setCcdEnabled(true).setCanSleep(false).enabledRotations(false, true, false));
  const boat = BOAT_CATALOG[progress.activeBoat];
  const shape = RAPIER.ColliderDesc.cuboid(boat.beam * .43, 1.7, boat.length * .46).setFriction(.22).setRestitution(.02).setDensity(1.15);
  shape.setTranslation(0, 0, -boat.length * .04); boatHullCollider = physicsWorld.createCollider(shape, boatBody);
  swimmerBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0));
  physicsWorld.createCollider(RAPIER.ColliderDesc.capsule(.62, .32).setSensor(true), swimmerBody);
  obstacleZones.forEach(zone => createObstacleCollider(zone.x, zone.z, zone.radius));
  for (const x of [-8.5, 8.5]) physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(1.55, .8, 31).setTranslation(x, .3, 27).setFriction(.35));
}
''')
replace_function('updateSwimmer', r'''
function updateSwimmer(delta: number) {
  if (playerMode !== 'swim') return;
  previousSwimPosition.copy(swimmer.position);
  const move = (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? .65 : 0);
  const turn = (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0);
  const strafe = (isDown('KeyZ') ? 1 : 0) - (isDown('KeyQ') ? 1 : 0);
  const vertical = (isDown('Space') ? 1 : 0) - (isDown('ControlLeft') || isDown('ControlRight') ? 1 : 0);
  const forwardInput = Math.abs(move) > .01 ? move : gamepadThrottle;
  const verticalInput = Math.abs(vertical) > .01 ? vertical : gamepadVertical;
  const boost = isDown('ShiftLeft') || isDown('ShiftRight') || gamepadBoost;
  swimYaw += (Math.abs(turn) > .01 ? turn : gamepadSteer) * delta * 1.35;
  const finBonus = 1 + progress.upgrades.fins * .12;
  swimSpeed = THREE.MathUtils.damp(swimSpeed, forwardInput * (boost ? 4.5 : 3.1) * finBonus, 5, delta);
  tmpVectorF.set(Math.sin(swimYaw) * Math.cos(swimPitch), Math.sin(swimPitch), -Math.cos(swimYaw) * Math.cos(swimPitch));
  swimmer.position.addScaledVector(tmpVectorF, swimSpeed * delta);
  swimmer.position.addScaledVector(tmpVectorB.set(Math.cos(swimYaw), 0, Math.sin(swimYaw)), strafe * 2.2 * finBonus * delta);
  swimmer.position.y += verticalInput * 2.6 * delta;
  expeditionWorld.resolveDiver(swimmer.position, previousSwimPosition);
  const surface = sampleOceanHeight(swimmer.position.x, swimmer.position.z, gameTime);
  swimmer.position.y = THREE.MathUtils.clamp(swimmer.position.y, expeditionFloor(swimmer.position.x, swimmer.position.z) + .8, surface + .1);
  const depth = Math.max(0, surface - swimmer.position.y);
  if (depth > 10) unlockAchievement('deep_diver');
  const drain = (.33 + (boost ? .10 : 0)) / (1 + progress.upgrades.tank * .25);
  oxygen = THREE.MathUtils.clamp(oxygen + (depth < .35 ? 12 : -drain) * delta, 0, 100);
  swimmer.rotation.set(-swimPitch - verticalInput * .15, -swimYaw, -turn * .08, 'YXZ');
  const kick = Math.sin(gameTime * (boost ? 8 : 5.5)) * Math.min(1, Math.abs(swimSpeed) / 3);
  animateSwimmerPart(swimmerLeftLeg, kick * .2); animateSwimmerPart(swimmerRightLeg, -kick * .2);
  animateSwimmerPart(swimmerLeftArm, -kick * .08); animateSwimmerPart(swimmerRightArm, kick * .08);
  swimmerBody.setTranslation(swimmer.position, true);
  if (oxygen <= .01) rescueDiver();
}
''')
replace_function('updateMissions', r'''
function updateMissions(_delta: number) {
  const record = progress.expedition;
  const active = playerMode === 'helm' ? yacht.position : swimmer.position;
  if (record.stage === 'reef' && Math.hypot(active.x - REEF_SITE.x, active.z - REEF_SITE.z) < 40 && record.checkpoint !== 'reef') {
    record.checkpoint = 'reef'; persistExpedition();
  }
  if (record.stage === 'reef' && reefComplete(record)) {
    record.stage = 'wreck'; cruiseActive = false; persistExpedition(); setNotice('Reef survey complete. Board the vessel and sail to the wreck.');
  }
  if (record.stage === 'wreck' && Math.hypot(yacht.position.x - WRECK_SITE.x, yacht.position.z - WRECK_SITE.z) < 45 && record.checkpoint !== 'wreck') {
    record.checkpoint = 'wreck'; persistExpedition();
  }
  if (record.stage === 'wreck' && record.sensorRecovered && record.cableFreed) {
    record.stage = 'return'; cruiseActive = false; persistExpedition(); setNotice('Sensor secured. Surface, board your vessel and return to the research stand.');
  }
  if (record.stage === 'return' && yacht.position.distanceTo(marinaPosition) < 30 && Math.abs(speed) < 2) {
    if (record.checkpoint !== 'harbor') { record.checkpoint = 'harbor'; persistExpedition(); }
  }
  expeditionWorld.updateSites(record.waterSample, record.sedimentSample, record.cableFreed, record.sensorRecovered, selectedTool);
  if (gameTime > nextSaveAt) { persistExpedition(); nextSaveAt = gameTime + 20; }
}

function persistExpedition(announce = false) {
  try { saveProgress(progress); if (announce) setNotice(`Saved on this device. Resume checkpoint: ${progress.expedition.checkpoint}.`); return true; }
  catch { setNotice('This browser could not save. Keep this tab open and allow local storage.'); return false; }
}

function objectiveLocation() {
  const record = progress.expedition;
  if (record.stage === 'briefing' || record.stage === 'return' || record.stage === 'complete') return marinaPosition.clone();
  if (playerMode === 'helm') { const site = record.stage === 'reef' ? REEF_SITE : WRECK_SITE; return new THREE.Vector3(site.x, 0, site.z); }
  if (record.stage === 'reef') {
    const key = selectedTool === 'sampler' ? (!record.waterSample ? 'water' : 'sediment') : !record.waterSample ? 'water' : !record.sedimentSample ? 'sediment' : undefined;
    if (key) { const p = SAMPLE_SITES[key]; return new THREE.Vector3(p.x, p.y, p.z); }
    const animal = expeditionWorld.animals.find(a => !record.photos.includes(a.key));
    return animal?.root.position.clone() ?? new THREE.Vector3(0, -9, -86);
  }
  const p = record.cableFreed ? SAMPLE_SITES.sensor : SAMPLE_SITES.cable; return new THREE.Vector3(p.x, p.y, p.z);
}

function useDiveTool() {
  if (playerMode !== 'swim' || isPaused || harbor?.classList.contains('is-open') || gameTime - lastToolUse < .65) return;
  const record = progress.expedition;
  if (record.stage !== 'reef' && record.stage !== 'wreck') { setNotice('Begin a research expedition at the harbor first.'); return; }
  lastToolUse = gameTime;
  if (selectedTool === 'camera') {
    const species = expeditionWorld.photographicTarget(camera, swimmer.position);
    if (!species) { setNotice('Bring a visible animal into the central frame, within 25 meters.'); return; }
    if (record.photos.includes(species)) { setNotice(`${SPECIES[species].name} is already in this survey.`); return; }
    record.photos.push(species); if (!progress.discoveredSpecies.includes(species)) progress.discoveredSpecies.push(species);
    gameRoot.classList.remove('photo-flash'); void gameRoot.offsetWidth; gameRoot.classList.add('photo-flash');
    setNotice(`${SPECIES[species].name} photographed. Field journal updated.`); music?.playCue('signal');
  } else if (selectedTool === 'sampler') {
    const water = new THREE.Vector3(...Object.values(SAMPLE_SITES.water) as [number,number,number]);
    const sediment = new THREE.Vector3(...Object.values(SAMPLE_SITES.sediment) as [number,number,number]);
    if (!record.waterSample && swimmer.position.distanceTo(water) < 4) { record.waterSample = true; setNotice('Water sample sealed and labeled for the research exchange.'); }
    else if (!record.sedimentSample && swimmer.position.distanceTo(sediment) < 3.6) { record.sedimentSample = true; setNotice('Sediment sample collected. Reef habitat left undisturbed.'); }
    else { setNotice('Swim closer to an uncollected sample site. Use Scanner for its bearing.'); return; }
  } else if (selectedTool === 'cutter') {
    const p = SAMPLE_SITES.cable;
    if (record.stage !== 'wreck' || record.cableFreed || swimmer.position.distanceTo(new THREE.Vector3(p.x,p.y,p.z)) > 3.5) { setNotice('Locate the snagged sensor cable beside the wreck.'); return; }
    record.cableFreed = true; setNotice('Cable released. Select Scanner and retrieve the sensor.');
  } else {
    const p = SAMPLE_SITES.sensor;
    if (record.stage === 'wreck' && record.cableFreed && !record.sensorRecovered && swimmer.position.distanceTo(new THREE.Vector3(p.x,p.y,p.z)) < 3.6) { record.sensorRecovered = true; setNotice('Research sensor recovered. Your cargo is ready for the harbor.'); }
    else { const target = objectiveLocation(); const bearing = formatHeading(Math.atan2(target.x - swimmer.position.x, -(target.z - swimmer.position.z))); setNotice(`Sonar: research target ${Math.round(swimmer.position.distanceTo(target))} m ${bearing}. ${record.stage === 'wreck' ? 'Amber lamp marks the sensor.' : 'Sampler sites have small gold frames.'}`); return; }
  }
  persistExpedition(); updateMissions(0); updateHud(); renderJournal();
}

function openResearchStand() {
  if (playerMode !== 'helm' || yacht.position.distanceTo(marinaPosition) > 31 || Math.abs(speed) > 2) { setNotice('Return between the harbor piers and slow below 4 knots to visit the stand.'); return; }
  cruiseActive = false; speed = 0; throttleValue = 0; steerValue = 0;
  Object.keys(keys).forEach(key => { keys[key] = false; });
  renderHarbor(); harbor?.classList.add('is-open'); harbor?.setAttribute('aria-hidden','false'); platform.gameplayStop();
  nextExpeditionButton?.focus();
}

function closeResearchStand() {
  harbor?.classList.remove('is-open'); harbor?.setAttribute('aria-hidden','true'); platform.gameplayStart();
}

function sellResearchCargo() {
  const record = progress.expedition;
  if (record.sold || record.stage !== 'return' || !reefComplete(record) || !record.cableFreed || !record.sensorRecovered || playerMode !== 'helm' || yacht.position.distanceTo(marinaPosition) > 31 || Math.abs(speed) > 2) return;
  const next = structuredClone(progress); const reward = expeditionReward(record);
  next.credits += reward; next.expeditions += 1; next.expedition.sold = true; next.expedition.stage = 'complete'; next.expedition.checkpoint = 'harbor';
  if (!next.achievements.includes('expedition_complete')) next.achievements.push('expedition_complete');
  // Persist the receipt and credit balance together before changing the live state.
  try { saveProgress(next); } catch { setNotice('Cargo kept safely aboard. Browser storage is unavailable; allow it before selling.'); return; }
  Object.assign(progress,next); expeditionComplete = true; rewardGranted = true; renderHarbor(); updateHud();
  setNotice(`Research cargo sold for ${reward} credits. New boats and gear are available.`); music?.playCue('purchase');
}

function renderResearchLedger() {
  const r=progress.expedition;
  if(ledger) ledger.innerHTML = `<div><span>Wildlife survey · ${r.photos.length} species</span><b>${r.photos.length*120} cr</b></div><div><span>Water sample</span><b>${r.waterSample?'150 cr':'Not collected'}</b></div><div><span>Sediment sample</span><b>${r.sedimentSample?'200 cr':'Not collected'}</b></div><div><span>Recovered research sensor</span><b>${r.sensorRecovered?'550 cr':'Not recovered'}</b></div><div><span>Complete expedition bonus</span><b>${reefComplete(r)&&r.sensorRecovered?'250 cr':'Finish the survey'}</b></div>`;
  if(cashInButton){cashInButton.disabled = boatSwitching || r.sold || r.stage !== 'return'; cashInButton.textContent = r.sold ? 'Cargo sold · receipt saved' : r.stage === 'return' ? `Sell expedition cargo · ${expeditionReward(r)} credits` : 'Complete expedition to sell cargo';}
  const copy=harbor?.querySelector('.harbor__reward p'); if(copy) copy.textContent=r.sold?'Your research payment is saved. Choose new equipment or begin another survey.':'Earn credits for photographs, permitted samples and recovered equipment. Boats and gear use in-game credits.';
  if(nextExpeditionButton)nextExpeditionButton.textContent=r.stage==='briefing'?'Begin research expedition':r.sold?'Begin another expedition':'Return to expedition';
}

function renderJournal() {
  if(!journalContent)return;const r=progress.expedition;
  const goals=[['Photograph three different species',r.photos.length>=3],['Collect a water sample',r.waterSample],['Collect a sediment sample',r.sedimentSample],['Free the wreck sensor cable',r.cableFreed],['Recover the research sensor',r.sensorRecovered],['Sell the cargo at the harbor',r.sold]] as const;
  journalContent.innerHTML=`<p class="journal__intro">Survey ${r.run} · ${completedObjectives(r)}/8 objectives · ${expeditionReward(r)} credits in cargo</p><div class="journal__goals">${goals.map(([name,done])=>`<div class="${done?'is-done':''}"><span>${done?'✓':'○'}</span>${name}</div>`).join('')}</div><h3>Wildlife observations</h3><div class="journal__species">${(Object.entries(SPECIES)as[SpeciesKey,typeof SPECIES[SpeciesKey]][]).map(([key,s])=>`<article class="${r.photos.includes(key)?'is-done':''}"><small>${r.photos.includes(key)?'Photographed this survey':progress.discoveredSpecies.includes(key)?'Previously discovered':'Not yet photographed'}</small><strong>${s.name}</strong><p>${s.note}</p></article>`).join('')}</div><p class="journal__intro">Autosaved every 20 seconds and after discoveries. Reload resumes aboard your boat at the last safe harbor, reef or wreck checkpoint.</p>`;
}

function toggleJournal(force?:boolean) {
  const open=force??!journalPanel?.classList.contains('is-open');renderJournal();
  journalPanel?.classList.toggle('is-open',open);journalPanel?.setAttribute('aria-hidden',String(!open));
  if(open){Object.keys(keys).forEach(k=>{keys[k]=false;});platform.gameplayStop();journalPanel?.querySelector<HTMLButtonElement>('[data-journal-close]')?.focus();}else platform.gameplayStart();
}

function selectDiveTool(tool:DiveTool){selectedTool=tool;toolButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tool===tool)));updateHud();}
function rescueDiver(){if(playerMode==='swim'){returnToHelm('Free recovery complete. Your research cargo is safe and air is restored.');persistExpedition();}togglePause(false);}
''')
replace_function('completeExpedition', r'''
function completeExpedition() { openResearchStand(); }
''')
replace_function('launchNextExpedition', r'''
function launchNextExpedition() {
  if (boatSwitching) return;
  if (progress.expedition.sold) progress.expedition = newExpedition(progress.expeditions + 1);
  if (progress.expedition.stage === 'briefing') { progress.expedition.stage = 'reef'; progress.expedition.checkpoint = 'harbor'; }
  expeditionComplete = false; rewardGranted = false; rewardDoubled = false;
  closeResearchStand(); persistExpedition(); selectWeather('bluewater', false);
  setNotice('Sail to the gold reef buoy. Photograph three species and collect water and sediment samples.');
  updateHud();
}
''')
replace_function('updateHud', r'''
function updateHud() {
  const r=progress.expedition;const p=playerMode==='helm'?yacht?.position:swimmer?.position;if(!p)return;
  const target=objectiveLocation();const dx=target.x-p.x,dz=target.z-p.z;const bearing=Math.atan2(dx,-dz);
  if(speedText)speedText.textContent=Math.round((playerMode==='helm'?displaySpeed:Math.abs(swimSpeed))*1.94).toString();
  if(headingText)headingText.textContent=formatHeading(playerMode==='helm'?heading:swimYaw);
  if(targetRangeText)targetRangeText.textContent=Math.round(p.distanceTo(target)).toString();
  if(windText)windText.textContent=Math.round(currentSea.windKnots).toString();if(fpsText)fpsText.textContent=measuredFps.toString();
  if(progressText)progressText.textContent=completedObjectives(r).toString();if(creditsText)creditsText.textContent=progress.credits.toString();
  if(modeText)modeText.textContent=playerMode==='helm'?'Helm':'Dive';
  if(depthText)depthText.textContent=Math.max(0,sampleOceanHeight(p.x,p.z,gameTime)-p.y).toFixed(1);if(airText)airText.textContent=Math.ceil(oxygen).toString();
  airStatus?.classList.toggle('is-low',oxygen<25);if(modeToggle)modeToggle.textContent=playerMode==='helm'?'Dive':'Board';
  const objectives={briefing:'Begin your research expedition',reef:playerMode==='helm'?'Sail to the reef survey site':`Reef survey · ${Math.min(3,r.photos.length)}/3 species · ${Number(r.waterSample)+Number(r.sedimentSample)}/2 samples`,wreck:playerMode==='helm'?'Sail to the wreck recovery site':r.cableFreed?'Retrieve the research sensor':'Free the snagged sensor cable',return:'Return to the research harbor',complete:'Expedition complete · new gear awaits'};
  if(objectiveText)objectiveText.textContent=objectives[r.stage];
  if(npcText)npcText.textContent=oxygen<25&&playerMode==='swim'?'Mara: Air is low. Surface or use free rescue.':r.stage==='briefing'?'Mara: Visit the harbor stand for your brief.':r.stage==='reef'?'Mara: Camera for wildlife; Sampler for marked research sites.':r.stage==='wreck'?'Mara: The amber lamp marks the sensor beside the wreck.':r.stage==='return'?'Mara: Dock slowly, then open Harbor to sell your cargo.':'Mara: Your research payment is safely recorded.';
  const guide=document.querySelector<HTMLElement>('[data-nav-bearing]');if(guide)guide.textContent=`${formatHeading(bearing)} · ${Math.round(p.distanceTo(target))} m · ${r.stage==='reef'?'Reef survey':r.stage==='wreck'?'Wreck recovery':'Research harbor'}`;
  const help=document.querySelector<HTMLElement>('[data-nav-help]');if(help)help.textContent=playerMode==='helm'?'W/S throttle · A/D steer · Cruise assist sails toward the site':'W/S swim · Drag to look · Space/Ctrl depth · F use tool · C view';
  if(standButton)standButton.disabled=playerMode!=='helm'||yacht.position.distanceTo(marinaPosition)>31||Math.abs(speed)>2;
  if(cruiseButton){cruiseButton.disabled=playerMode!=='helm'||r.stage==='briefing'||r.stage==='complete';cruiseButton.setAttribute('aria-pressed',String(cruiseActive));cruiseButton.textContent=cruiseActive?'Cancel cruise':'Cruise assist';}
  focusedSpecies=playerMode==='swim'?expeditionWorld.photographicTarget(camera,swimmer.position):undefined;
  interactionReady=false;let prompt='Choose a tool';
  if(selectedTool==='camera'){interactionReady=!!focusedSpecies&&!r.photos.includes(focusedSpecies);prompt=focusedSpecies?`${SPECIES[focusedSpecies].name}${r.photos.includes(focusedSpecies)?' · already photographed':' · ready to photograph'}`:'Frame a visible species within 25 m';}
  else if(selectedTool==='sampler'){const key=!r.waterSample?'water':'sediment';const s=SAMPLE_SITES[key];const distance=p.distanceTo(new THREE.Vector3(s.x,s.y,s.z));interactionReady=(key==='water'?!r.waterSample:!r.sedimentSample)&&distance<(key==='water'?4:3.6);prompt=r.waterSample&&r.sedimentSample?'Both samples sealed':`${key==='water'?'Water':'Sediment'} sample · ${Math.round(distance)} m`;}
  else if(selectedTool==='cutter'){const s=SAMPLE_SITES.cable;const distance=p.distanceTo(new THREE.Vector3(s.x,s.y,s.z));interactionReady=r.stage==='wreck'&&!r.cableFreed&&distance<3.5;prompt=r.cableFreed?'Cable released':`Snagged cable · ${Math.round(distance)} m`;}
  else{interactionReady=true;prompt=r.stage==='wreck'&&r.cableFreed?'Scan or retrieve the sensor':'Scan for a research target';}
  if(toolPrompt)toolPrompt.textContent=prompt;if(interactButton){interactButton.disabled=playerMode!=='swim'||!interactionReady;interactButton.textContent=selectedTool==='camera'?'Photograph · F':selectedTool==='sampler'?'Collect sample · F':selectedTool==='cutter'?'Release cable · F':'Scan / recover · F';}
  gameRoot.classList.toggle('target-ready',interactionReady);
}
''')
replace_function('cycleCamera', r'''
function cycleCamera() {
  if(playerMode==='swim'){firstPersonDive=!firstPersonDive;swimmer.visible=!firstPersonDive;setNotice(firstPersonDive?'First person dive view. Drag to look.':'Third person dive view.');return;}
  cameraMode=(cameraMode+1)%cameraOffsets.length;setNotice(`${['Chase','Overhead','Rear quarter','Bow quarter','Side','Aft deck'][cameraMode]} view.`);
}
''')
replace_function('seabedHeight', r'''
function seabedHeight(x:number,z:number){return expeditionFloor(x,z);}
''')
# Targeted hooks preserve the existing water, vessel, weather and audio implementation.
source=source.replace('  if (isPaused) {\n    renderer.render', "  if (isPaused || harbor?.classList.contains('is-open') || journalPanel?.classList.contains('is-open')) {\n    renderer.render")
source=source.replace('  updateGamepad();', '  updateGamepad(delta);')
source=source.replace('  updateEnvironment();\n  hudAccumulator', '  updateEnvironment();\n  expeditionWorld.update(gameTime, playerMode === \'helm\' ? yacht.position : swimmer.position, cameraUnderwater, progress.upgrades.light);\n  expeditionWorld.pointLight(camera);\n  hudAccumulator')
source=source.replace("function updateGamepad() {", "function updateGamepad(delta:number) {")
source=source.replace('  previousGamepadButtons = currentButtons;', "  if (currentButtons[3] && !previousGamepadButtons[3]) useDiveTool();\n  if (playerMode === 'swim') { swimYaw += deadzone(pad.axes[2] ?? 0) * delta * 1.7; swimPitch = THREE.MathUtils.clamp(swimPitch - deadzone(pad.axes[3] ?? 0) * delta * 1.4, -1.0, 1.0); }\n  previousGamepadButtons = currentButtons;")
source=source.replace("  const helmActive = playerMode === 'helm';", "  const helmActive = playerMode === 'helm';\n  const navigationTarget = objectiveLocation();")
source=source.replace("  const rawThrottle = helmActive ?", "  let rawThrottle = helmActive ?").replace("  const rawSteer = helmActive ?", "  let rawSteer = helmActive ?")
source=source.replace('  const boosting = helmActive', r'''
  if (helmActive && cruiseActive) {
    if (Math.abs(keyboardThrottle) > .01 || Math.abs(keyboardSteer) > .01 || Math.abs(gamepadThrottle) > .1 || Math.abs(gamepadSteer) > .1) cruiseActive = false;
    else {
      const distance = Math.hypot(navigationTarget.x-yacht.position.x,navigationTarget.z-yacht.position.z);
      const desired = Math.atan2(navigationTarget.x-yacht.position.x,-(navigationTarget.z-yacht.position.z));
      const error = THREE.MathUtils.euclideanModulo(desired-heading+Math.PI,Math.PI*2)-Math.PI;
      const stop = progress.expedition.stage === 'return' ? 9 : 27;
      if (distance < stop && Math.abs(speed)<.6) { cruiseActive=false;rawThrottle=0;rawSteer=0;setNotice(progress.expedition.stage==='return'?'Docked slowly. Open Harbor to sell your research cargo.':'Research site reached. Dive when ready.'); }
      else { rawSteer=THREE.MathUtils.clamp(error*2,-1,1);const desiredSpeed=distance<stop+14?Math.max(0,(distance-stop)*.32):Math.abs(error)>1.0?3.0:7.0;rawThrottle=speed>desiredSpeed+.5?-.7:speed<desiredSpeed? .75:0; }
    }
  }
  const boosting = helmActive''')
# Dock contacts must lower the scalar speed as well as the physics velocity.
source=source.replace('  const bodyPosition = boatBody.translation();', '  if (impactLoss > 1.0) speed = Math.sign(speed) * Math.min(Math.abs(speed), Math.hypot(resolvedVelocity.x, resolvedVelocity.z));\n  const bodyPosition = boatBody.translation();')
source=source.replace('  const contract = expeditionContracts[activeContractIndex];\n  if (creditsText)', '  const contract = expeditionContracts[activeContractIndex];\n  renderResearchLedger();\n  if (creditsText)')
source=source.replace("rewardGranted ? contract.reward.toString() : '0'", 'expeditionReward(progress.expedition).toString()')
source=source.replace('contractTitle.textContent = contract.name', "contractTitle.textContent = progress.expedition.sold ? 'Survey Complete' : 'Research Exchange'")
source=source.replace("    if (event.code === 'Escape' && !event.repeat) togglePause();", "    if (event.code === 'Escape' && !event.repeat) { if(journalPanel?.classList.contains('is-open'))toggleJournal(false);else if(harbor?.classList.contains('is-open'))closeResearchStand();else togglePause(); }")
source=source.replace("    keys[event.code] = true;", "    const menuOpen=isPaused||harbor?.classList.contains('is-open')||journalPanel?.classList.contains('is-open');\n    if(!menuOpen) keys[event.code] = true;")
source=source.replace("    if (event.code === 'Digit1'", "    if(event.code==='KeyF'&&!event.repeat&&!menuOpen)useDiveTool();\n    if(event.code==='KeyJ'&&!event.repeat)toggleJournal();\n    if(event.code==='KeyH'&&!event.repeat&&!menuOpen)openResearchStand();\n    if (event.code === 'Digit1'")
source=source.replace('  renderHarbor();\n\n  window.addEventListener', r'''
  toolButtons.forEach(button=>button.addEventListener('click',()=>selectDiveTool(button.dataset.tool as DiveTool)));
  interactButton?.addEventListener('click',useDiveTool);
  standButton?.addEventListener('click',openResearchStand);
  cashInButton?.addEventListener('click',sellResearchCargo);
  document.querySelector('[data-journal-toggle]')?.addEventListener('click',()=>toggleJournal());
  document.querySelector('[data-journal-close]')?.addEventListener('click',()=>toggleJournal(false));
  document.querySelector('[data-save]')?.addEventListener('click',()=>persistExpedition(true));
  document.querySelector('[data-rescue]')?.addEventListener('click',rescueDiver);
  cruiseButton?.addEventListener('click',()=>{if(playerMode==='helm'&&progress.expedition.stage!=='briefing'&&progress.expedition.stage!=='complete')cruiseActive=!cruiseActive;updateHud();});
  renderer.domElement.addEventListener('pointerdown',event=>{if(playerMode==='swim'&&!isPaused){pointerLook={x:event.clientX,y:event.clientY,id:event.pointerId};renderer.domElement.setPointerCapture(event.pointerId);}});
  renderer.domElement.addEventListener('pointermove',event=>{if(!pointerLook||pointerLook.id!==event.pointerId)return;swimYaw+=(event.clientX-pointerLook.x)*.005;swimPitch=THREE.MathUtils.clamp(swimPitch-(event.clientY-pointerLook.y)*.004,-1,1);pointerLook.x=event.clientX;pointerLook.y=event.clientY;});
  const stopLook=()=>{pointerLook=undefined;};renderer.domElement.addEventListener('pointerup',stopLook);renderer.domElement.addEventListener('pointercancel',stopLook);renderer.domElement.addEventListener('lostpointercapture',stopLook);
  window.addEventListener('pagehide',()=>persistExpedition());
  renderHarbor();

  window.addEventListener''')
source=source.replace("  swimYaw = heading;\n  oxygen", "  swimYaw = heading;\n  swimPitch = 0; cruiseActive = false;\n  oxygen")
source=source.replace("  swimmer.visible = true;", "  swimmer.visible = !firstPersonDive;")
source=source.replace("    returnToHelm('Diver aboard. Helm control restored.');", "    if(swimmer.position.distanceTo(yacht.position)>BOAT_CATALOG[progress.activeBoat].length*.6+8){setNotice('Surface and swim back to the vessel to board, or use free rescue in Pause.');return;}\n    returnToHelm('Diver aboard. Helm control restored.');")
source=source.replace("    tmpQuaternion.setFromEuler(yawEuler.set(0, -swimYaw, 0, 'YXZ'));\n    tmpVectorC.set(0, 1.05, 6.8)", "    tmpQuaternion.setFromEuler(yawEuler.set(-swimPitch * .6, -swimYaw, 0, 'YXZ'));\n    tmpVectorC.set(0, firstPersonDive ? .28 : .8, firstPersonDive ? -.15 : 5.2)")
source=source.replace("    tmpVectorE.set(Math.sin(swimYaw), 0, -Math.cos(swimYaw));", "    tmpVectorE.set(Math.sin(swimYaw) * Math.cos(swimPitch), Math.sin(swimPitch), -Math.cos(swimYaw) * Math.cos(swimPitch));")
source=source.replace("    cameraTarget.copy(swimmer.position).addScaledVector(tmpVectorE, 3.2);", "    cameraTarget.copy(swimmer.position).addScaledVector(tmpVectorE, 8);")
source=source.replace('fog.color.set(0x176577);', 'fog.color.set(0x167b92);').replace('0.009, 0.016', '0.008, 0.013')
source=source.replace('underwaterLight.intensity = 2.7;', 'underwaterLight.intensity = 9;')
source=source.replace('      const fish', '      const fish')
path.write_text(source,encoding='utf-8')
print('Expedition world, tool flow, harbor settlement and checkpoint save installed.')
