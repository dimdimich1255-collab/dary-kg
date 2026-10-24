import { Component, computed, input } from '@angular/core';
import { MedicineShort } from './api';

const CATEGORY_COLORS: Record<string, [string, string]> = {
  'Жаропонижающие и обезболивающие': ['#e85d5d', '#fde3e3'],
  'Желудок и кишечник': ['#2f9e6e', '#dcf3e8'],
  'Аллергия': ['#8a63d2', '#ece4fa'],
  'Антибиотики': ['#2f6fd6', '#e0eafb'],
  'Сердце и давление': ['#d6336c', '#fbe1ea'],
  'Витамины': ['#e8890c', '#fdefd9'],
  'Антисептики': ['#1c9bb0', '#dbf2f6'],
};

/** Пока нет настоящих фото — рисуем упаковку лекарства в SVG. */
@Component({
  selector: 'app-medicine-image',
  // В SVG атрибуты привязываются через [attr.имя]
  template: `
    @if (medicine().image_url; as url) {
      <img [src]="url" [alt]="medicine().name">
    } @else {
      <svg viewBox="0 0 400 300" role="img" [attr.aria-label]="medicine().name">
        <rect width="400" height="300" [attr.fill]="colors()[1]" />
        <g transform="rotate(-8 200 150)" font-family="system-ui">
          <rect x="80" y="70" width="240" height="150" rx="14" fill="#fff" [attr.stroke]="colors()[0]" stroke-width="3" />
          <rect x="80" y="70" width="240" height="38" rx="14" [attr.fill]="colors()[0]" />
          <rect x="80" y="94" width="240" height="14" [attr.fill]="colors()[0]" />
          <text x="200" y="96" text-anchor="middle" fill="#fff" font-size="15" font-weight="600">{{ shortCategory() }}</text>
          <text x="200" y="150" text-anchor="middle" fill="#1d2a2a" [attr.font-size]="size()" font-weight="700">{{ title() }}</text>
          <text x="200" y="178" text-anchor="middle" fill="#5f6f6e" font-size="13">{{ medicine().form }}</text>
          <circle cx="292" cy="196" r="10" [attr.fill]="colors()[0]" opacity=".25" />
          <circle cx="270" cy="200" r="7" [attr.fill]="colors()[0]" opacity=".4" />
        </g>
      </svg>
    }
  `,
  styles: `:host { display: contents; }`,
})
export class MedicineImage {
  readonly medicine = input.required<MedicineShort>();

  protected colors = computed(() => CATEGORY_COLORS[this.medicine().category] ?? ['#0f8a6c', '#e2f4ee']);
  protected title = computed(() => this.medicine().name.replace(/\s*\(.*\)/, ''));
  protected size = computed(() => (this.title().length > 14 ? 17 : 22));
  protected shortCategory = computed(() => this.medicine().category.split(' ')[0]);
}
