import type { ScanIdentification } from './scan-identification';
import { SONAR_COOLDOWN } from './field-equipment';

export class ScannerPanel {
  private target: HTMLSelectElement;
  private signature = '';
  constructor(private root: HTMLElement) {
    this.target = root.querySelector('[data-scan-target]')!;
  }
  update(contacts: readonly ScanIdentification[], position: { x: number; y: number; z: number }, age: number, visible: boolean, automatic: boolean) {
    this.root.hidden = !visible;
    if (!visible) return;
    const signature = contacts.map(contact => contact.id).join('|');
    if (signature !== this.signature || !this.target.options.length) {
      const selected = this.target.value;
      this.target.replaceChildren(...contacts.map(contact => new Option(contact.name, contact.id)));
      if (contacts.some(contact => contact.id === selected)) this.target.value = selected;
      this.signature = signature;
    }
    this.target.hidden = !contacts.length;
    const contact = contacts.find(contact => contact.id === this.target.value) ?? contacts[0];
    const set = (selector: string, text: string) => { const node = this.root.querySelector<HTMLElement>(selector)!; if (node.textContent !== text) node.textContent = text; };
    set('[data-scan-status]', age < 2 ? 'Sweeping' : automatic ? `Next sweep ${Math.max(0, Math.ceil(SONAR_COOLDOWN - age))} s` : 'Manual scanning');
    this.root.querySelector('[data-scan-auto]')!.setAttribute('aria-pressed', String(automatic));
    set('[data-scan-count]', `${contacts.length} contact${contacts.length === 1 ? '' : 's'}`);
    const detail = this.root.querySelector<HTMLElement>('[data-scan-detail]')!;
    detail.hidden = !contact;
    const empty = this.root.querySelector<HTMLElement>('[data-scan-empty]')!;
    empty.hidden = !!contact;
    if (!contact) return;
    const dx = contact.x - position.x, dz = contact.z - position.z, dy = contact.y - position.y;
    const heading = ((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360;
    set('[data-scan-kind]', `${contact.kind} / last sweep`);
    set('[data-scan-range]', `${Math.round(Math.hypot(dx, dy, dz))} m`);
    set('[data-scan-depth]', `${Math.max(0, -contact.y).toFixed(1)} m`);
    set('[data-scan-bearing]', `${Math.round(heading) % 360}°`);
    set('[data-scan-note]', contact.note);
    set('[data-scan-action]', contact.action);
  }
}
