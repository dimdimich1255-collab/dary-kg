import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

// Типы ответов API — те же поля, что отдают Python- и Node-бэкенды
export interface MedicineShort {
  id: number;
  name: string;
  generic_name: string;
  category: string;
  form: string;
  prescription: boolean;
  image_url: string | null;
  min_price: number | null;
  rating: number | null;
  reviews_count: number;
}

export interface Pharmacy {
  id: number;
  name: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
  lat: number;
  lng: number;
}

export interface Offer {
  price_som: number;
  in_stock: boolean;
  updated_at: string;
  pharmacy: Pharmacy;
  distance_km: number | null;
}

export interface Medicine extends MedicineShort {
  purpose: string;
  contraindications: string;
  offers: Offer[];
}

export interface Review {
  id: number;
  author: string;
  rating: number;
  text: string;
  created_at: string;
}

export interface Location {
  lat: number;
  lng: number;
}

/** Все запросы к бэкенду. Адрес относительный: /api пересылает dev-сервер Angular или nginx. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  cities() {
    return this.get<string[]>('/api/cities');
  }

  categories() {
    return this.get<string[]>('/api/categories');
  }

  medicines(q: string, category: string) {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (category) params = params.set('category', category);
    return this.get<MedicineShort[]>('/api/medicines', params);
  }

  medicine(id: string, city: string, location: Location | null) {
    let params = new HttpParams();
    if (city) params = params.set('city', city);
    if (location) params = params.set('lat', location.lat).set('lng', location.lng);
    return this.get<Medicine>(`/api/medicines/${id}`, params);
  }

  reviews(medicineId: number) {
    return this.get<Review[]>(`/api/medicines/${medicineId}/reviews`);
  }

  addReview(medicineId: number, body: { author: string; text: string; rating: number }) {
    return this.http.post<Review>(`/api/medicines/${medicineId}/reviews`, body).pipe(catchError(toError));
  }

  private get<T>(url: string, params?: HttpParams): Observable<T> {
    return this.http.get<T>(url, { params }).pipe(catchError(toError));
  }
}

// Превращаем ошибку HTTP в обычную Error с текстом от сервера («Лекарство не найдено»)
function toError(err: HttpErrorResponse) {
  const detail = err.error?.detail;
  return throwError(() => new Error(typeof detail === 'string' ? detail : 'Ошибка сервера'));
}

export function stars(n: number | null): string {
  const r = Math.round(n || 0);
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}
