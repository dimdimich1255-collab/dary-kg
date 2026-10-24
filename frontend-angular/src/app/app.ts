import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { Api } from './api';
import { Store } from './store';
import { CatalogPage } from './catalog-page';
import { MedicinePage } from './medicine-page';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CatalogPage, MedicinePage],
  template: `
    <header class="top">
      <a href="#/" class="logo">💊 Dary<span>.kg</span></a>
      <select aria-label="Город" [ngModel]="store.city()" (ngModelChange)="store.city.set($event)">
        <option value="">Все города</option>
        @for (c of cities(); track c) {
          <option [value]="c">{{ c }}</option>
        }
      </select>
    </header>

    <div class="notice">
      Данные об аптеках и ценах демонстрационные. Сайт не заменяет врача:
      перед приёмом лекарства посоветуйтесь со специалистом. Скорая помощь — <b>103</b>.
    </div>

    <main>
      @if (medicineId(); as id) {
        <!-- track по id: при переходе на другое лекарство страница создаётся заново -->
        @for (key of [id]; track key) {
          <app-medicine-page [id]="id" />
        }
      } @else {
        <app-catalog-page />
      }
    </main>

    <footer>Учебный проект · Angular + FastAPI / Express + SQLite/PostgreSQL</footer>
  `,
})
export class App {
  protected store = inject(Store);
  protected cities = toSignal(inject(Api).cities().pipe(catchError(() => of([]))), { initialValue: [] });

  // Маршрутизация по #адресу, как в vanilla-версии: #/ — каталог, #/medicine/5 — лекарство
  private hash = signal(window.location.hash);
  protected medicineId = computed(() => this.hash().match(/^#\/medicine\/(\d+)/)?.[1] ?? null);

  constructor() {
    const onHashChange = () => {
      this.hash.set(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('hashchange', onHashChange));
  }
}
