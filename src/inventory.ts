import { createElement, Ship, Camera, Package, FlaskConical, CircleGauge, Wind, Shield, Footprints, Flashlight, X, BookOpen, BatteryCharging, type IconNode } from 'lucide';
import { SCOOTER } from './field-equipment';
import { BOAT_CATALOG, UPGRADE_CATALOG, upgradeCost, researchDiscount, type PlayerProgress, type BoatKey, type UpgradeKey } from './progression';
import { SPECIES, expeditionPlan, expeditionReward, type SpeciesKey } from './expedition-state';

type View = 'fleet' | 'equipment' | 'cargo' | 'collection';
const views: Array<[View, string, IconNode]> = [['fleet', 'Fleet', Ship], ['equipment', 'Equipment', CircleGauge], ['cargo', 'Cargo', Package], ['collection', 'Collection', BookOpen]];
const gearIcons: Record<UpgradeKey, IconNode> = { engine: CircleGauge, tank: Wind, hull: Shield, fins: Footprints, light: Flashlight };

function icon(node: IconNode) { return createElement(node, { width: 24, height: 24, 'aria-hidden': 'true' }); }

export class Inventory {
  dialog = document.createElement('dialog');
  private view: View = 'equipment';
  private contents = document.createElement('div');
  private balance = document.createElement('strong');
  private origin?: HTMLElement;
  private feedback='';

  constructor(private getProgress: () => PlayerProgress, private canShop: () => boolean,
    private shop: (kind: 'boat' | 'upgrade', key: BoatKey | UpgradeKey) => void,
    private changed: (open: boolean) => void,
    private fabricate: () => void = () => {}) {
    this.dialog.className = 'inventory';
    this.dialog.setAttribute('aria-labelledby', 'inventory-title');
    this.dialog.innerHTML = '<header><div><span class="hud__eyebrow">Ocean Adventure</span><h2 id="inventory-title">Expedition inventory</h2></div></header>';
    const header = this.dialog.querySelector('header')!;
    this.balance.className = 'inventory__balance'; header.append(this.balance);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'inventory__close';
    close.title = 'Close inventory'; close.setAttribute('aria-label', 'Close inventory'); close.append(icon(X));
    close.onclick = () => this.dialog.close(); header.append(close);
    const nav = document.createElement('nav'); nav.className = 'inventory__tabs'; nav.setAttribute('aria-label', 'Inventory categories');
    for (const [key, label, glyph] of views) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.inventoryView = key;
      button.append(icon(glyph), document.createTextNode(label));
      button.onclick = () => { this.view = key; this.feedback='';this.render();this.contents.scrollTop=0; }; nav.append(button);
    }
    this.contents.className = 'inventory__contents'; this.contents.setAttribute('aria-live', 'polite');
    this.dialog.append(nav, this.contents); document.querySelector('#game-root')!.append(this.dialog);
    this.dialog.addEventListener('close', () => {
      this.changed(false);
      const visible=(node?:HTMLElement)=>node?.isConnected&&node.getClientRects().length;
      const fallback=Array.from(document.querySelectorAll<HTMLElement>('[data-action-menu-toggle],[data-inventory-toggle]')).find(node=>visible(node));
      (visible(this.origin)?this.origin:fallback)?.focus();
    });
  }

  get open() { return this.dialog.open; }
  report(message:string){this.feedback=message;this.render();}
  show() {
    if (this.open) return;
    this.origin = document.activeElement as HTMLElement;this.feedback='';
    this.render(); this.changed(true); this.dialog.showModal();
  }

  render() {
    const active=document.activeElement as HTMLElement|null;
    const focusAttribute=active&&this.contents.contains(active)?['data-fabricate-scooter','data-inventory-upgrade','data-inventory-boat'].find(name=>active.hasAttribute(name)):undefined;
    const focusValue=focusAttribute?active!.getAttribute(focusAttribute):undefined;
    const p = this.getProgress(), r = p.expedition;
    this.balance.textContent = `${p.credits.toLocaleString()} credits`;
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-inventory-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.inventoryView === this.view)));
    this.contents.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'inventory__heading';
    const title = document.createElement('h3'); title.textContent = views.find(v => v[0] === this.view)![1];
    const status = document.createElement('span');
    status.textContent = this.view === 'cargo' ? (r.sold ? 'Sale receipt saved' : `${expeditionReward(r)} credits pending`) : this.view === 'collection' ? `${p.discoveredSpecies.length}/${Object.keys(SPECIES).length} species discovered` : this.canShop() ? 'Dockside purchases available' : 'Visit a harbor counter to upgrade';
    heading.append(title, status); this.contents.append(heading);
    if(this.feedback){const message=document.createElement('p');message.className='inventory__status';message.setAttribute('role','status');message.textContent=this.feedback;this.contents.append(message);}
    const list = document.createElement('div'); list.className = `inventory__list inventory__list--${this.view}`;
    this.contents.append(list);
    const row = (name: string, detail: string, glyph: IconNode) => {
      const article = document.createElement('article'); article.className = 'inventory__item';
      const stamp = document.createElement('div'); stamp.className = 'inventory__icon'; stamp.append(icon(glyph));
      const text = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = name;
      const small = document.createElement('small'); small.textContent = detail; text.append(strong, small); article.append(stamp, text); list.append(article); return article;
    };
    if (this.view === 'fleet') for (const [key, boat] of Object.entries(BOAT_CATALOG) as [BoatKey, typeof BOAT_CATALOG.aurora][]) {
      const owned = p.ownedBoats.includes(key), active = key === p.activeBoat;
      const article = row(boat.name, `${boat.role} · ${Math.round(boat.speed * 100)} speed / ${Math.round(boat.handling * 100)} handling`, Ship);
      const image = document.createElement('img'); image.src = `/textures/inventory/${key}.png`; image.alt = boat.name; image.className = 'inventory__boat-image'; article.prepend(image);
      const button = document.createElement('button'); button.textContent = active ? 'Equipped' : owned ? 'Equip' : `${boat.price} credits`;
      button.dataset.inventoryBoat = key; button.disabled = active || !this.canShop() || (!owned && p.credits < boat.price);
      button.onclick = () => this.shop('boat', key); article.append(button);
    }
    if (this.view === 'equipment') {
      row('Field research kit', 'Camera, sampler, cable cutter and scanner · Included', Camera);
      const owned=!!p.fieldEquipment?.scooter,unlocked=p.voyage.blueprints.includes(SCOOTER.blueprint);
      const drive=row(SCOOTER.name,owned?`Fabricated · ${Math.ceil(p.fieldEquipment!.charge)}% charge · Recharges aboard`:unlocked?'Blueprint acquired · Rechargeable underwater propulsion':'Blueprint: complete Echoes in the Seagrass',BatteryCharging);
      const craft=document.createElement('button');craft.dataset.fabricateScooter='';craft.textContent=owned?'Fabricated':unlocked?`Build · ${SCOOTER.cost} credits`:'Blueprint locked';craft.disabled=owned||!unlocked||!this.canShop()||p.credits<SCOOTER.cost;craft.onclick=this.fabricate;drive.append(craft);
      for (const [key, gear] of Object.entries(UPGRADE_CATALOG) as [UpgradeKey, typeof UPGRADE_CATALOG.engine][]) {
        const level = p.upgrades[key], cost = upgradeCost(key, level,researchDiscount(p)), max = level >= gear.maxLevel;
        const article = row(gear.name, `${gear.description} · Level ${level}/${gear.maxLevel}${researchDiscount(p)?` · ${Math.round(researchDiscount(p)*100)}% research discount`:''}`, gearIcons[key]);
        const button = document.createElement('button'); button.textContent = max ? 'Fully upgraded' : `${cost} credits`;
        button.dataset.inventoryUpgrade = key; button.disabled = max || !this.canShop() || p.credits < cost;
        button.onclick = () => this.shop('upgrade', key); article.append(button);
      }
    }
    if (this.view === 'cargo') {
      const plan=expeditionPlan(r);
      if(plan.photoGoal)row('Wildlife photographs', `${r.photos.length} recorded · ${r.photos.length * 120} credits`, Camera);
      if(plan.samplesRequired){row('Water sample', r.waterSample ? '1 sealed sample · 150 credits' : 'Not collected', FlaskConical);row('Sediment sample', r.sedimentSample ? '1 sealed sample · 200 credits' : 'Not collected', FlaskConical);}
      if(plan.recoveryRequired){if(plan.stations.length)row(plan.recoveryTitle, `${r.transectReadings.length}/${plan.stations.length} readings · ${r.transectReadings.length*plan.readingCredits} credits`, BookOpen);else row('Research sensor', r.sensorRecovered ? '1 recovered instrument · 550 credits' : 'Not recovered', Package);}
      if (r.sold) {
        row('Research payment', `${r.saleCredits} credits paid · Survey ${r.run}`, BookOpen);
        row('Research grant', r.grantState === 'claimed' ? `${r.grantCredits} bonus credits received` : r.grantState === 'earned' ? 'Confirmed · save pending' : 'Optional grant not claimed', BookOpen);
      }
    }
    if (this.view === 'collection') for (const [key, species] of Object.entries(SPECIES) as [SpeciesKey, typeof SPECIES.tang][]) {
      const article = row(species.name, `${p.discoveredSpecies.includes(key) ? 'Discovered' : 'Undiscovered'} · ${species.note}`, Camera);
      const photo = p.collectionPhotos[key] ?? r.photoImages[key];
      if (photo) { const image = document.createElement('img'); image.src = photo; image.alt = `${species.name} survey photograph`; image.className = 'inventory__photo'; article.prepend(image); }
    }
    if(focusAttribute){const button=Array.from(list.querySelectorAll<HTMLButtonElement>('button')).find(node=>node.getAttribute(focusAttribute)===focusValue&&!node.disabled);(button??this.dialog.querySelector<HTMLButtonElement>('.inventory__close'))?.focus({preventScroll:true});}
  }
}
