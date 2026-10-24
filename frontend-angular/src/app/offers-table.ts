import { Component, computed, input } from '@angular/core';
import { Offer, Pharmacy } from './api';

@Component({
  selector: 'app-offers-table',
  template: `
    @if (offers().length === 0) {
      <p class="muted">В выбранном городе этого лекарства нет. Выберите «Все города».</p>
    } @else {
      <table class="offers">
        <thead>
          <tr>
            <th>Аптека</th>
            <th class="hide-sm">Режим работы</th>
            @if (withDistance()) { <th>Расстояние</th> }
            <th>Цена</th>
          </tr>
        </thead>
        <tbody>
          @for (o of offers(); track o.pharmacy.id) {
            <tr [class.best]="isBest(o)" [class.out]="!o.in_stock">
              <td>
                <b>{{ o.pharmacy.name }}</b><br>
                <span class="muted">{{ o.pharmacy.city }}, {{ o.pharmacy.address }}</span><br>
                <a [href]="phoneUrl(o.pharmacy)">{{ o.pharmacy.phone }}</a> ·
                <a [href]="mapUrl(o.pharmacy)" target="_blank" rel="noopener">на карте</a>
              </td>
              <td class="hide-sm">{{ o.pharmacy.hours }}</td>
              @if (withDistance()) { <td>{{ o.distance_km }} км</td> }
              <td>
                @if (o.in_stock) {
                  <span class="price">{{ o.price_som }} сом</span>
                  @if (isBest(o)) { <br><small>дешевле всего</small> }
                } @else {
                  нет в наличии
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class OffersTable {
  readonly offers = input.required<Offer[]>();

  private min = computed(() => Math.min(...this.offers().filter((o) => o.in_stock).map((o) => o.price_som)));
  protected withDistance = computed(() => this.offers().length > 0 && this.offers()[0].distance_km != null);

  protected isBest(o: Offer) {
    return o.in_stock && o.price_som === this.min();
  }

  protected phoneUrl(p: Pharmacy) {
    return 'tel:' + p.phone.replace(/\s/g, '');
  }

  protected mapUrl(p: Pharmacy) {
    return 'https://2gis.kg/search/' + encodeURIComponent(`${p.city} ${p.address}`);
  }
}
