import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Review, stars } from './api';

@Component({
  selector: 'app-reviews-block',
  imports: [FormsModule],
  template: `
    <section class="box">
      <h2>Отзывы</h2>
      <div id="reviews">
        @if (reviews() === null) {
          <p class="muted">Загрузка…</p>
        } @else if (reviews()!.length === 0) {
          <p class="muted">Будьте первым, кто оставит отзыв.</p>
        } @else {
          <!-- Интерполяция в Angular всегда экранирует текст — HTML из отзыва не выполнится (защита от XSS) -->
          @for (r of reviews(); track r.id) {
            <div class="review" data-testid="review">
              <span class="who">{{ r.author }}</span>
              <span class="stars">{{ stars(r.rating) }}</span>
              <span class="muted"> · {{ formatDate(r.created_at) }}</span>
              <p>{{ r.text }}</p>
            </div>
          }
        }
      </div>

      <!-- ngNativeValidate: Angular по умолчанию отключает проверку required браузером, включаем обратно -->
      <form class="review-form" ngNativeValidate (ngSubmit)="submit()">
        <h3 style="margin: 8px 0 0">Оставить отзыв</h3>
        <input name="author" placeholder="Ваше имя" maxlength="60" required [(ngModel)]="author">
        <div class="rate">
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <button type="button" [class.on]="n <= rating()" [attr.aria-label]="n + ' из 5'" (click)="rating.set(n)">★</button>
          }
        </div>
        <textarea
          name="text"
          placeholder="Помогло ли лекарство? Были ли побочные эффекты?"
          maxlength="2000"
          required
          [(ngModel)]="text"
        ></textarea>
        <div class="error">{{ error() }}</div>
        <button [disabled]="sending()">Отправить отзыв</button>
      </form>
    </section>
  `,
})
export class ReviewsBlock implements OnInit {
  readonly medicineId = input.required<number>();

  private api = inject(Api);
  protected stars = stars;

  protected reviews = signal<Review[] | null>(null);
  protected author = '';
  protected text = '';
  protected rating = signal(0);
  protected error = signal('');
  protected sending = signal(false);

  ngOnInit() {
    this.load();
  }

  private load() {
    this.api.reviews(this.medicineId()).subscribe((list) => this.reviews.set(list));
  }

  protected submit() {
    this.error.set('');
    if (!this.rating()) { this.error.set('Поставьте оценку от 1 до 5 звёзд'); return; }
    this.sending.set(true);
    this.api.addReview(this.medicineId(), { author: this.author, text: this.text, rating: this.rating() }).subscribe({
      next: () => {
        this.author = '';
        this.text = '';
        this.rating.set(0);
        this.sending.set(false);
        this.load();
      },
      error: () => {
        this.error.set('Не получилось отправить: проверьте имя (от 2 букв) и текст (от 5 букв).');
        this.sending.set(false);
      },
    });
  }

  protected formatDate(s: string) {
    return new Date(s).toLocaleDateString('ru-RU');
  }
}
