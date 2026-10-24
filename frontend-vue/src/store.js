import { reactive, watch } from "vue";

function readCity() {
  try { return localStorage.getItem("city") || ""; } catch { return ""; }
}

// Общее состояние приложения. reactive — Vue сам перерисует всё, что его читает.
// (В React для этого пришлось передавать состояние через props из App.)
export const store = reactive({
  q: "",            // поиск в каталоге
  category: "",     // выбранная категория
  city: readCity(), // выбранный город
  location: null,   // { lat, lng } после «Найти ближайшие»
});

watch(() => store.city, (city) => {
  try { localStorage.setItem("city", city); } catch { /* приватный режим */ }
});
