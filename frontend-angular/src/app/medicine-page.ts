import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { Api, Medicine, stars } from './api';
import { MedicineImage } from './medicine-image';
import { OffersTable } from './offers-table';
import { ReviewsBlock } from './reviews-block';
import { Store } from './store';

interface PageState {
  medicine: Medicine | null;
  city: string; // для какого города загружены данные
  error: string;
}

@Component({
  selector: 'app-medicine-page',
  imports: [MedicineImage, OffersTable, ReviewsBlock],
  template: `
    @if (state().error) {
      <p class="error">{{ state().error }}</p>
      <a href="#/">← К списку</a>
    } @else if (state().medicine; as m) {
      <p><a href="#/">← Все лекарства</a></p>
      <div class="detail">
        <div class="img"><app-medicine-image [medicine]="m" /></div>
        <div>
          <h1>{{ m.name }}</h1>
          <div class="muted">{{ m.generic_name }} · {{ m.form }}</div>
          <p>
            @if (m.prescription) {
              <span class="badge">отпускается по рецепту врача</span>
            }
            @if (m.reviews_count > 0) {
              <span class="stars">{{ stars(m.rating) }}</span> {{ m.rating }} · {{ m.reviews_count }} отзыв(ов)
            } @else {
              <span class="muted">Отзывов пока нет</span>
            }
          </p>
          <div class="box" style="margin-top: 0">
            <h2>Для чего нужно</h2>
            <p style="margin: 0">{{ m.purpose }}</p>
          </div>
          <div class="box">
            <h2>Противопоказания</h2>
            <p style="margin: 0">{{ m.contraindications }}</p>
          </div>
        </div>
      </div>

      <section class="box">
        <div class="box-head">
          <h2 style="margin: 0">Где купить {{ state().city ? 'в г. ' + state().city : '' }}</h2>
          <button class="ghost" [disabled]="locating()" (click)="locate()">
            {{ locating() ? 'Определяем…' : '📍 ' + (store.location() ? 'Обновить местоположение' : 'Найти ближайшие') }}
          </button>
        </div>
        <app-offers-table [offers]="m.offers" />
      </section>

      <app-reviews-block [medicineId]="m.id" />
    } @else {
      <p class="muted">Загрузка…</p>
    }
  `,
})
export class MedicinePage {
  readonly id = input.required<string>();

  protected store = inject(Store);
  private api = inject(Api);
  protected stars = stars;
  protected locating = signal(false);

  // Город хранится вместе с данными: пока новый ответ не пришёл, заголовок и таблица
  // показывают один и тот же (старый) город. (Эту ошибку поймали тесты в React-версии.)
  protected state = toSignal(
    toObservable(computed(() => ({ id: this.id(), city: this.store.city(), location: this.store.location() }))).pipe(
      switchMap(({ id, city, location }) =>
        this.api.medicine(id, city, location).pipe(
          map((medicine): PageState => ({ medicine, city, error: '' })),
          catchError((err: Error) => of<PageState>({ medicine: null, city, error: err.message })),
        ),
      ),
    ),
    { initialValue: { medicine: null, city: '', error: '' } as PageState },
  );

  protected locate() {
    if (!navigator.geolocation) { alert('Браузер не умеет определять местоположение'); return; }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        this.store.location.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        this.locating.set(false);
        alert('Не удалось определить местоположение. Разрешите доступ к геолокации в браузере.');
      },
    );
  }
}
