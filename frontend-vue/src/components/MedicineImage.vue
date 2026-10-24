<script setup>
import { computed } from "vue";

const props = defineProps({ medicine: { type: Object, required: true } });

const CATEGORY_COLORS = {
  "Жаропонижающие и обезболивающие": ["#e85d5d", "#fde3e3"],
  "Желудок и кишечник": ["#2f9e6e", "#dcf3e8"],
  "Аллергия": ["#8a63d2", "#ece4fa"],
  "Антибиотики": ["#2f6fd6", "#e0eafb"],
  "Сердце и давление": ["#d6336c", "#fbe1ea"],
  "Витамины": ["#e8890c", "#fdefd9"],
  "Антисептики": ["#1c9bb0", "#dbf2f6"],
};

const colors = computed(() => CATEGORY_COLORS[props.medicine.category] || ["#0f8a6c", "#e2f4ee"]);
const title = computed(() => props.medicine.name.replace(/\s*\(.*\)/, ""));
const size = computed(() => (title.value.length > 14 ? 17 : 22));
</script>

<!-- Пока нет настоящих фото — рисуем упаковку лекарства в SVG -->
<template>
  <img v-if="medicine.image_url" :src="medicine.image_url" :alt="medicine.name">
  <svg v-else viewBox="0 0 400 300" role="img" :aria-label="medicine.name">
    <rect width="400" height="300" :fill="colors[1]" />
    <g transform="rotate(-8 200 150)" font-family="system-ui">
      <rect x="80" y="70" width="240" height="150" rx="14" fill="#fff" :stroke="colors[0]" stroke-width="3" />
      <rect x="80" y="70" width="240" height="38" rx="14" :fill="colors[0]" />
      <rect x="80" y="94" width="240" height="14" :fill="colors[0]" />
      <text x="200" y="96" text-anchor="middle" fill="#fff" font-size="15" font-weight="600">
        {{ medicine.category.split(" ")[0] }}
      </text>
      <text x="200" y="150" text-anchor="middle" fill="#1d2a2a" :font-size="size" font-weight="700">{{ title }}</text>
      <text x="200" y="178" text-anchor="middle" fill="#5f6f6e" font-size="13">{{ medicine.form }}</text>
      <circle cx="292" cy="196" r="10" :fill="colors[0]" opacity=".25" />
      <circle cx="270" cy="200" r="7" :fill="colors[0]" opacity=".4" />
    </g>
  </svg>
</template>
