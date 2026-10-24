import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, debounceTime, map, of, switchMap } from 'rxjs';
import { Api, MedicineShort } from './api';
import { MedicineImage } from './medicine-image';
import { Store } from './store';

interface ListState {
  medicines: MedicineShort[] | null; // null = ещё грузим
  error: string;
}

@Component({
  selector: 'app-catalog-page',
  imports: [FormsModule, MedicineImage],
  template: `
    <form class="search" (ngSubmit)="submit()">
      <input
        type="search"
        name="q"
        placeholder="Название лекарства или симптом: «температура», «аллергия»…"
        autocomplete="off"
        [ngModel]="input()"
        (ngModelChange)="input.set($event)"
      >
      <button>Найти</button>
    </form>

    <div class="chips">
      @for (c of chips(); track c) {
        <button
          type="button"
          class="chip"
          [class.active]="c === store.category()"
          (click)="store.category.set(c)"
        >{{ c || 'Все' }}</button>
      }
    </div>

    <div class="grid">
      @if (state().error) {
        <p class="error">Не удалось загрузить: {{ state().error }}</p>
      } @else if (state().medicines === null) {
        <p class="muted">Загрузка…</p>
      } @else if (state().medicines!.length === 0) {
        <p class="muted">Ничего не найдено. Попробуйте другое слово.</p>
      } @else {
        @for (m of state().medicines; track m.id) {
          <a class="card" [href]="'#/medicine/' + m.id" data-testid="medicine-card">
            <div class="img"><app-medicine-image [medicine]="m" /></div>
            <div class="body">
              <h3>{{ m.name }}</h3>
              <div class="form">{{ m.form }}</div>
              @if (m.prescription) {
                <span><span class="badge">по рецепту</span></span>
              }
              <div class="bottom">
                @if (m.min_price != null) {
                  <span class="price"><small>от</small> {{ m.min_price }} сом</span>
                } @else {
                  <span class="muted">нет в наличии</span>
                }
                <span class="muted">
                  @if (m.reviews_count > 0) {
                    <span class="stars">★</span> {{ m.rating }} ({{ m.reviews_count }})
                  }
                </span>
              </div>
            </div>
          </a>
        }
      }
    </div>
  `,
})
export class CatalogPage {
  protected store = inject(Store);
  private api = inject(Api);

  protected input = signal(this.store.q()); // то, что сейчас в поле поиска

  private categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  protected chips = computed(() => ['', ...this.categories()]);

  // Поиск и категория → запрос к API. switchMap отменяет старый запрос, если пришёл новый,
  // поэтому опоздавший ответ не перезапишет свежий (в React и Vue это делал флаг cancelled)
  protected state = toSignal(
    toObservable(computed(() => ({ q: this.store.q(), category: this.store.category() }))).pipe(
      switchMap(({ q, category }) =>
        this.api.medicines(q, category).pipe(
          map((medicines): ListState => ({ medicines, error: '' })),
          catchError((err: Error) => of<ListState>({ medicines: null, error: err.message })),
        ),
      ),
    ),
    { initialValue: { medicines: null, error: '' } as ListState },
  );

  constructor() {
    // Ждём 250 мс после последней буквы, чтобы не слать запрос на каждое нажатие
    toObservable(this.input)
      .pipe(debounceTime(250), takeUntilDestroyed())
      .subscribe((q) => this.store.q.set(q));
  }

  protected submit() {
    this.store.q.set(this.input());
  }
}
