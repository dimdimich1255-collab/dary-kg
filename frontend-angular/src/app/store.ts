import { Injectable, effect, signal } from '@angular/core';
import { Location } from './api';

function readCity(): string {
  try { return localStorage.getItem('city') || ''; } catch { return ''; }
}

/** Общее состояние приложения. Сервис один на всё приложение, компоненты получают его через inject(). */
@Injectable({ providedIn: 'root' })
export class Store {
  readonly q = signal('');                         // поиск в каталоге
  readonly category = signal('');                  // выбранная категория
  readonly city = signal(readCity());              // выбранный город
  readonly location = signal<Location | null>(null); // после «Найти ближайшие»

  constructor() {
    effect(() => {
      const city = this.city();
      try { localStorage.setItem('city', city); } catch { /* приватный режим */ }
    });
  }
}
