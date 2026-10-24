export default function OffersTable({ offers }) {
  if (!offers.length) {
    return <p className="muted">В выбранном городе этого лекарства нет. Выберите «Все города».</p>;
  }

  const min = Math.min(...offers.filter((o) => o.in_stock).map((o) => o.price_som));
  const withDistance = offers[0].distance_km != null;

  return (
    <table className="offers">
      <thead>
        <tr>
          <th>Аптека</th>
          <th className="hide-sm">Режим работы</th>
          {withDistance && <th>Расстояние</th>}
          <th>Цена</th>
        </tr>
      </thead>
      <tbody>
        {offers.map((o) => {
          const best = o.in_stock && o.price_som === min;
          const p = o.pharmacy;
          return (
            <tr key={p.id} className={`${best ? "best" : ""} ${o.in_stock ? "" : "out"}`}>
              <td>
                <b>{p.name}</b><br />
                <span className="muted">{p.city}, {p.address}</span><br />
                <a href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a>{" · "}
                <a
                  href={`https://2gis.kg/search/${encodeURIComponent(`${p.city} ${p.address}`)}`}
                  target="_blank"
                  rel="noopener"
                >
                  на карте
                </a>
              </td>
              <td className="hide-sm">{p.hours}</td>
              {withDistance && <td>{o.distance_km} км</td>}
              <td>
                {o.in_stock ? (
                  <>
                    <span className="price">{o.price_som} сом</span>
                    {best && <><br /><small>дешевле всего</small></>}
                  </>
                ) : "нет в наличии"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
