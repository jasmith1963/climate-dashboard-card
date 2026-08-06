const CARD_CSS = `
:host{display:block;--size:320px;--climate-bg:#fff;--climate-text:#111;--climate-secondary:#666;--climate-border:#ddd;--climate-track:rgba(127,127,127,.2)}ha-card{position:relative;box-sizing:border-box;width:min(100%,var(--size));aspect-ratio:1;padding:16px 18px 12px;overflow:hidden;color:var(--climate-text);background:var(--climate-bg);border:1px solid var(--climate-border)}
header{display:flex;align-items:center;justify-content:space-between;height:25px}h2{margin:0;font-size:16px;line-height:1}button{border:0;padding:0;color:inherit;font:inherit;background:none;cursor:pointer}
.battery{display:flex;align-items:center;gap:3px;font-size:12px}.battery ha-icon{--mdc-icon-size:18px}.dial{position:absolute;left:50%;top:60%;display:grid;place-items:center;margin:0;padding:0;transform:translate(-50%,-50%)}
svg{position:absolute;inset:0;display:block;width:100%;height:100%}circle{fill:none;stroke-width:7;transform:rotate(135deg);transform-origin:60px 60px}.track{stroke:var(--climate-track);stroke-linecap:round;stroke-dasharray:75 25}.arc-segment{stroke-linecap:butt}.arc-cap{stroke-linecap:round}.zero-marker{stroke:var(--marker-color);stroke-width:1.25;stroke-linecap:round;opacity:.82}.current-marker{transform:none;stroke:var(--marker-color);stroke-width:1.6;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))}
.values{z-index:1;display:flex;align-items:center;flex-direction:column;gap:7px;transform:translateY(-7px)}.values strong{font-size:34px;font-weight:500;line-height:1;letter-spacing:-1px}.values span{display:flex;align-items:center;gap:3px;color:var(--climate-secondary);font-size:14px;line-height:1}.values ha-icon{--mdc-icon-size:16px;color:#3ea9e6}
footer{position:absolute;right:12px;bottom:8px;left:12px;display:flex;align-items:center;justify-content:center;gap:4px;min-height:22px}.extra{padding:3px 5px;border-radius:6px;color:var(--climate-secondary);background:rgba(127,127,127,.12);font-size:9px}.extra small{display:block;font-size:7px}
@media(max-width:600px){ha-card{padding:14px 16px 12px}.dial{top:66%!important;width:82%!important;height:auto!important;aspect-ratio:1}.values{gap:7px;transform:translateY(2px)}.values strong{font-size:23px;letter-spacing:-.5px}.values span{font-size:13px;font-weight:500}.values ha-icon{--mdc-icon-size:15px}h2{font-size:15px}.battery{font-size:11px}}`;

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
  });
}

function reading(hass, entityId) {
  var entity = entityId && hass && hass.states && hass.states[entityId];
  if (!entity || ["unknown", "unavailable", "none", ""].indexOf(entity.state) !== -1) return null;
  var value = Number.parseFloat(entity.state);
  return Number.isFinite(value) ? { value: value, unit: entity.attributes.unit_of_measurement || "" } : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hexToRgb(hex) {
  var value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function mixColor(first, second, amount) {
  var a = hexToRgb(first);
  var b = hexToRgb(second);
  var ratio = clamp(amount, 0, 1);
  var channel = function (start, end) { return Math.round(start + (end - start) * ratio); };
  return `rgb(${channel(a.r, b.r)},${channel(a.g, b.g)},${channel(a.b, b.b)})`;
}

class ClimateDashboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    var temperature = config && (config.temperature || config.temperature_entity);
    if (!temperature) throw new Error("temperature of temperature_entity ontbreekt");
    this.config = {
      title: config.title || config.name || "Klimaat",
      temperature: temperature,
      humidity: config.humidity || config.humidity_entity,
      battery: config.battery || config.battery_entity,
      co2: config.co2,
      tvoc: config.tvoc,
      pressure: config.pressure,
      dew_point: config.dew_point,
      card_size: Math.max(270, Math.min(400, Number(config.card_size) || 320)),
      dial_position: Math.max(50, Math.min(70, Number(config.dial_position) || 63)),
      background: String(config.background || "white").toLowerCase() === "black" ? "black" : "white",
      min_temperature: Number.isFinite(Number(config.min_temperature)) ? Number(config.min_temperature) : -10,
      max_temperature: Number.isFinite(Number(config.max_temperature)) ? Number(config.max_temperature) : 40,
