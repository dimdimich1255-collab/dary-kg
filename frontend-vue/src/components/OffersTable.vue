<script setup>
import { computed } from "vue";

const props = defineProps({ offers: { type: Array, required: true } });

const min = computed(() => Math.min(...props.offers.filter((o) => o.in_stock).map((o) => o.price_som)));
const withDistance = computed(() => props.offers.length > 0 && props.offers[0].distance_km != null);

const isBest = (o) => o.in_stock && o.price_som === min.value;
const mapUrl = (p) => `https://2gis.kg/search/${encodeURIComponent(`${p.city} ${p.address}`)}`;
</script>

<template>
  <p v-if="!offers.length" class="muted">В выбранном городе этого лекарства нет. Выберите «Все города».</p>
  <table v-else class="offers">
    <thead>
      <tr>
        <th>Аптека</th>
        <th class="hide-sm">Режим работы</th>
        <th v-if="withDistance">Расстояние</th>
        <th>Цена</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="o in offers" :key="o.pharmacy.id" :class="{ best: isBest(o), out: !o.in_stock }">
        <td>
          <b>{{ o.pharmacy.name }}</b><br>
          <span class="muted">{{ o.pharmacy.city }}, {{ o.pharmacy.address }}</span><br>
          <a :href="`tel:${o.pharmacy.phone.replace(/\s/g, '')}`">{{ o.pharmacy.phone }}</a> ·
          <a :href="mapUrl(o.pharmacy)" target="_blank" rel="noopener">на карте</a>
        </td>
        <td class="hide-sm">{{ o.pharmacy.hours }}</td>
        <td v-if="withDistance">{{ o.distance_km }} км</td>
        <td>
          <template v-if="o.in_stock">
            <span class="price">{{ o.price_som }} сом</span>
            <template v-if="isBest(o)"><br><small>дешевле всего</small></template>
          </template>
          <template v-else>нет в наличии</template>
        </td>
      </tr>
    </tbody>
  </table>
</template>
