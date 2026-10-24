<script setup>
import { onMounted, ref, watch } from "vue";
import { api } from "../api.js";
import { store } from "../store.js";
import MedicineImage from "../components/MedicineImage.vue";

const categories = ref([]);
const input = ref(store.q); // то, что сейчас в поле поиска
const medicines = ref(null); // null = ещё грузим
const error = ref("");

onMounted(async () => {
  categories.value = await api("/api/categories").catch(() => []);
});

// Ждём 250 мс после последней буквы, чтобы не слать запрос на каждое нажатие
let timer;
watch(input, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => { store.q = value; }, 250);
});

// Новый запрос при каждой смене поиска или категории.
// onCleanup помечает старый запрос, чтобы его ответ не перезаписал новый
watch(
  () => [store.q, store.category],
  async ([q, category], _, onCleanup) => {
    let cancelled = false;
    onCleanup(() => { cancelled = true; });
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    try {
      const data = await api(`/api/medicines?${params}`);
      if (!cancelled) { medicines.value = data; error.value = ""; }
    } catch (err) {
      if (!cancelled) error.value = err.message;
    }
  },
  { immediate: true },
);

function submit() {
  clearTimeout(timer);
  store.q = input.value;
}
</script>

<template>
  <form class="search" @submit.prevent="submit">
    <input
      v-model="input"
      type="search"
      placeholder="Название лекарства или симптом: «температура», «аллергия»…"
      autocomplete="off"
    >
    <button>Найти</button>
  </form>

  <div class="chips">
    <button
      v-for="c in ['', ...categories]"
      :key="c || 'all'"
      type="button"
      class="chip"
      :class="{ active: c === store.category }"
      @click="store.category = c"
    >
      {{ c || "Все" }}
    </button>
  </div>

  <div class="grid">
    <p v-if="error" class="error">Не удалось загрузить: {{ error }}</p>
    <p v-else-if="medicines === null" class="muted">Загрузка…</p>
    <p v-else-if="medicines.length === 0" class="muted">Ничего не найдено. Попробуйте другое слово.</p>
    <a
      v-for="m in medicines"
      v-else
      :key="m.id"
      class="card"
      :href="`#/medicine/${m.id}`"
      data-testid="medicine-card"
    >
      <div class="img"><MedicineImage :medicine="m" /></div>
      <div class="body">
        <h3>{{ m.name }}</h3>
        <div class="form">{{ m.form }}</div>
        <span v-if="m.prescription"><span class="badge">по рецепту</span></span>
        <div class="bottom">
          <span v-if="m.min_price != null" class="price"><small>от</small> {{ m.min_price }} сом</span>
          <span v-else class="muted">нет в наличии</span>
          <span class="muted">
            <template v-if="m.reviews_count > 0">
              <span class="stars">★</span> {{ m.rating }} ({{ m.reviews_count }})
            </template>
          </span>
        </div>
      </div>
    </a>
  </div>
</template>
