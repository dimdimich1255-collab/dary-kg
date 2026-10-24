<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { api } from "./api.js";
import { store } from "./store.js";
import CatalogPage from "./pages/CatalogPage.vue";
import MedicinePage from "./pages/MedicinePage.vue";

const cities = ref([]);

// Маршрутизация по #адресу, как в vanilla-версии: #/ — каталог, #/medicine/5 — лекарство
const hash = ref(window.location.hash);
const medicineId = computed(() => hash.value.match(/^#\/medicine\/(\d+)/)?.[1] ?? null);

function onHashChange() {
  hash.value = window.location.hash;
  window.scrollTo(0, 0);
}

onMounted(async () => {
  window.addEventListener("hashchange", onHashChange);
  cities.value = await api("/api/cities").catch(() => []);
});
onUnmounted(() => window.removeEventListener("hashchange", onHashChange));
</script>

<template>
  <header class="top">
    <a href="#/" class="logo">💊 Dary<span>.kg</span></a>
    <select v-model="store.city" aria-label="Город">
      <option value="">Все города</option>
      <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
    </select>
  </header>

  <div class="notice">
    Данные об аптеках и ценах демонстрационные. Сайт не заменяет врача:
    перед приёмом лекарства посоветуйтесь со специалистом. Скорая помощь — <b>103</b>.
  </div>

  <main>
    <MedicinePage v-if="medicineId" :key="medicineId" :id="medicineId" />
    <CatalogPage v-else />
  </main>

  <footer>Учебный проект · Vue + FastAPI / Express + SQLite/PostgreSQL</footer>
</template>
