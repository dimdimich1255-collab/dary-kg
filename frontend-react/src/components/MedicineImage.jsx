const CATEGORY_COLORS = {
  "Жаропонижающие и обезболивающие": ["#e85d5d", "#fde3e3"],
  "Желудок и кишечник": ["#2f9e6e", "#dcf3e8"],
  "Аллергия": ["#8a63d2", "#ece4fa"],
  "Антибиотики": ["#2f6fd6", "#e0eafb"],
  "Сердце и давление": ["#d6336c", "#fbe1ea"],
  "Витамины": ["#e8890c", "#fdefd9"],
  "Антисептики": ["#1c9bb0", "#dbf2f6"],
};

// Пока нет настоящих фото — рисуем упаковку лекарства в SVG
export default function MedicineImage({ medicine: m }) {
  if (m.image_url) return <img src={m.image_url} alt={m.name} />;

  const [main, soft] = CATEGORY_COLORS[m.category] || ["#0f8a6c", "#e2f4ee"];
  const title = m.name.replace(/\s*\(.*\)/, "");
  const size = title.length > 14 ? 17 : 22;

  return (
    <svg viewBox="0 0 400 300" role="img" aria-label={m.name}>
      <rect width="400" height="300" fill={soft} />
      <g transform="rotate(-8 200 150)" fontFamily="system-ui">
        <rect x="80" y="70" width="240" height="150" rx="14" fill="#fff" stroke={main} strokeWidth="3" />
        <rect x="80" y="70" width="240" height="38" rx="14" fill={main} />
        <rect x="80" y="94" width="240" height="14" fill={main} />
        <text x="200" y="96" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600">
          {m.category.split(" ")[0]}
        </text>
        <text x="200" y="150" textAnchor="middle" fill="#1d2a2a" fontSize={size} fontWeight="700">{title}</text>
        <text x="200" y="178" textAnchor="middle" fill="#5f6f6e" fontSize="13">{m.form}</text>
        <circle cx="292" cy="196" r="10" fill={main} opacity=".25" />
        <circle cx="270" cy="200" r="7" fill={main} opacity=".4" />
      </g>
    </svg>
  );
}
