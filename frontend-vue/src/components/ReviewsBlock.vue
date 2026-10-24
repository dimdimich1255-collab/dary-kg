<script setup>
import { onMounted, reactive, ref } from "vue";
import { api, stars } from "../api.js";

const props = defineProps({ medicineId: { type: Number, required: true } });

const reviews = ref(null);
const form = reactive({ author: "", text: "", rating: 0 });
const error = ref("");
const sending = ref(false);

async function load() {
  reviews.value = await api(`/api/medicines/${props.medicineId}/reviews`);
}
onMounted(load);

async function submit() {
  error.value = "";
  if (!form.rating) { error.value = "Поставьте оценку от 1 до 5 звёзд"; return; }
  sending.value = true;
  try {
    await api(`/api/medicines/${props.medicineId}/reviews`, {
      method: "POST",
      body: JSON.stringify(form),
    });
    Object.assign(form, { author: "", text: "", rating: 0 });
    await load();
  } catch {
    error.value = "Не получилось отправить: проверьте имя (от 2 букв) и текст (от 5 букв).";
  } finally {
    sending.value = false;
  }
}

const formatDate = (s) => new Date(s).toLocaleDateString("ru-RU");
</script>

<template>
  <section class="box">
    <h2>Отзывы</h2>
    <div id="reviews">
      <p v-if="reviews === null" class="muted">Загрузка…</p>
      <p v-else-if="reviews.length === 0" class="muted">Будьте первым, кто оставит отзыв.</p>
      <!-- {{ }} в Vue всегда экранирует текст — HTML из отзыва не выполнится (защита от XSS) -->
      <div v-for="r in reviews" v-else :key="r.id" class="review" data-testid="review">
        <span class="who">{{ r.author }}</span>
        {{ " " }}
        <span class="stars">{{ stars(r.rating) }}</span>
        <span class="muted"> · {{ formatDate(r.created_at) }}</span>
        <p>{{ r.text }}</p>
      </div>
    </div>

    <form class="review-form" @submit.prevent="submit">
      <h3 style="margin: 8px 0 0">Оставить отзыв</h3>
      <input v-model="form.author" placeholder="Ваше имя" maxlength="60" required>
      <div class="rate">
        <button
          v-for="n in 5"
          :key="n"
          type="button"
          :class="{ on: n <= form.rating }"
          :aria-label="`${n} из 5`"
          @click="form.rating = n"
        >★</button>
      </div>
      <textarea
        v-model="form.text"
        placeholder="Помогло ли лекарство? Были ли побочные эффекты?"
        maxlength="2000"
        required
      />
      <div class="error">{{ error }}</div>
      <button :disabled="sending">Отправить отзыв</button>
    </form>
  </section>
</template>
