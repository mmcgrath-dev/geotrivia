const RAD = Math.PI / 180;

function conicZone(rotLng, p1, p2, centerLng, centerLat, scale, tx, ty) {
  const s1 = Math.sin(p1 * RAD),
    s2 = Math.sin(p2 * RAD);
  const n = (s1 + s2) / 2;
  const C = 1 + s1 * (2 * n - s1);
  const r0 = Math.sqrt(C) / n;
  const raw = (lng, lat) => {
    const lam = (lng + rotLng) * RAD * n;
    const r = Math.sqrt(C - 2 * n * Math.sin(lat * RAD)) / n;
    return [r * Math.sin(lam), r0 - r * Math.cos(lam)];
  };
  const [ccx, ccy] = raw(centerLng - rotLng, centerLat);
  return {
    forward(lat, lng) {
      const [rx, ry] = raw(lng, lat);
      return { x: scale * (rx - ccx) + tx, y: ty - scale * (ry - ccy) };
    },
  };
}

// Exact d3.geoAlbersUsa() rotate/center/parallels; scale/translate adapted
// from its 960x500 defaults (k=1070, translate [480,250]) to this canvas's
// 960x600 via k=1285, as documented in the d3-geo source.
const USA_K = 1285,
  USA_TX = 480,
  USA_TY = 300;
const LOWER48 = conicZone(96, 29.5, 45.5, -0.6, 38.7, USA_K, USA_TX, USA_TY);
const ALASKA = conicZone(
  154,
  55,
  65,
  -2,
  58.5,
  USA_K * 0.35,
  USA_TX - 0.307 * USA_K,
  USA_TY + 0.201 * USA_K,
);
const HAWAII = conicZone(
  157,
  8,
  18,
  -3,
  19.9,
  USA_K,
  USA_TX - 0.205 * USA_K,
  USA_TY + 0.212 * USA_K,
);
