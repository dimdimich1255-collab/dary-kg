<script setup>
import { ref, watch } from "vue";
import { api, stars } from "../api.js";
import { store } from "../store.js";
import MedicineImage from "../components/MedicineImage.vue";
import OffersTable from "../components/OffersTable.vue";
import ReviewsBlock from "../components/ReviewsBlock.vue";

const props = defineProps({ id: { type: String, required: true } });

// Запоминаем, для какого города загружены данные: пока новый ответ не пришёл,
// заголовок и таблица должны показывать один и тот же (старый) город.
// (Эту ошибку поймали Playwright-тесты в React-версии.)
const medicine = ref(null);
const loadedCity = ref("");
const error = ref("");
const locating = ref(false);

// Перезагружаем, когда меняется город или местоположение
watch(
  () => [store.city, store.location],
  async ([city, location], _, onCleanup) => {
    let cancelled = false;
    onCleanup(() => { cancelled = true; });
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (location) { params.set("lat", location.lat); params.set("lng", location.lng); }
    try {
      const data = await api(`/api/medicines/${props.id}?${params}`);
      if (!cancelled) { medicine.value = data; loadedCity.value = city; }
    } catch (err) {
      if (!cancelled) error.value = err.message;
    }
  },
  { immediate: true },
);

function locate() {
  if (!navigator.geolocation) { alert("Браузер не умеет определять местоположение"); return; }
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false;
      store.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    },
    () => {
      locating.value = false;
      alert("Не удалось определить местоположение. Разрешите доступ к геолокации в браузере.");
    },
  );
}
</script>

<template>
  <template v-if="error">
    <p class="error">{{ error }}</p>
    <a href="#/">← К списку</a>
  </template>
  <p v-else-if="!medicine" class="muted">Загрузка…</p>
  <template v-else>
    <p><a href="#/">← Все лекарства</a></p>
    <div class="detail">
      <div class="img"><MedicineImage :medicine="medicine" /></div>
      <div>
        <h1>{{ medicine.name }}</h1>
        <div class="muted">{{ medicine.generic_name }} · {{ medicine.form }}</div>
        <p>
          <span v-if="medicine.prescription" class="badge">отпускается по рецепту врача</span>
          {{ " " }}
          <template v-if="medicine.reviews_count > 0">
            <span class="stars">{{ stars(medicine.rating) }}</span>
            {{ medicine.rating }} · {{ medicine.reviews_count }} отзыв(ов)
          </template>
          <span v-else class="muted">Отзывов пока нет</span>
        </p>
        <div class="box" style="margin-top: 0">
          <h2>Для чего нужно</h2>
          <p style="margin: 0">{{ medicine.purpose }}</p>
        </div>
        <div class="box">
          <h2>Противопоказания</h2>
          <p style="margin: 0">{{ medicine.contraindications }}</p>
        </div>
      </div>
    </div>

    <section class="box">
      <div class="box-head">
        <h2 style="margin: 0">Где купить {{ loadedCity ? `в г. ${loadedCity}` : "" }}</h2>
        <button class="ghost" :disabled="locating" @click="locate">
          {{ locating ? "Определяем…" : `📍 ${store.location ? "Обновить местоположение" : "Найти ближайшие"}` }}
        </button>
      </div>
      <OffersTable :offers="medicine.offers" />
    </section>

    <ReviewsBlock :medicine-id="medicine.id" />
  </template>
</template>
