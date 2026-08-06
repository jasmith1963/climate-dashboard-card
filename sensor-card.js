const CARD_CSS = `
:host{display:block;--size:320px;--climate-bg:#fff;--climate-text:#111;--climate-secondary:#666;--climate-border:#ddd;--climate-track:rgba(127,127,127,.2)}ha-card{position:relative;box-sizing:border-box;width:min(100%,var(--size));aspect-ratio:1;padding:16px 18px 12px;overflow:hidden;color:var(--climate-text);background:var(--climate-bg);border:1px solid var(--climate-border)}
header{display:flex;align-items:center;justify-content:space-between;height:25px;gap:6px}h2{margin:0;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;line-height:1}button{border:0;padding:0;color:inherit;font:inherit;background:none;cursor:pointer}
.battery{display:flex;align-items:center;gap:2px;font-size:10px}.battery ha-icon{--mdc-icon-size:16px}.dial{position:absolute;left:50%;top:60%;display:grid;place-items:center;margin:0;padding:0;transform:translate(-50%,-50%)}
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
      temperature_cold_below: Number.isFinite(Number(config.temperature_cold_below)) ? Number(config.temperature_cold_below) : 18,
      temperature_warm_above: Number.isFinite(Number(config.temperature_warm_above)) ? Number(config.temperature_warm_above) : 24,
      temperature_hot_above: Number.isFinite(Number(config.temperature_hot_above)) ? Number(config.temperature_hot_above) : 28,
      humidity_dry_below: Number.isFinite(Number(config.humidity_dry_below)) ? Number(config.humidity_dry_below) : 40,
      humidity_high_above: Number.isFinite(Number(config.humidity_high_above)) ? Number(config.humidity_high_above) : 60,
      humidity_critical_above: Number.isFinite(Number(config.humidity_critical_above)) ? Number(config.humidity_critical_above) : 70,
      show_zero_marker: config.show_zero_marker !== false
    };
    this.style.setProperty("--size", this.config.card_size + "px");
    var dark = this.config.background === "black";
    this.style.setProperty("--climate-bg", dark ? "#0b0b0b" : "#ffffff");
    this.style.setProperty("--climate-text", dark ? "#f5f5f5" : "#111111");
    this.style.setProperty("--climate-secondary", dark ? "#c7c7c7" : "#666666");
    this.style.setProperty("--climate-border", dark ? "#343434" : "#dddddd");
    this.style.setProperty("--climate-track", dark ? "rgba(255,255,255,.18)" : "rgba(127,127,127,.2)");
    this.style.setProperty("--marker-color", dark ? "#ffffff" : "#202020");
    this.render();
  }

  set hass(value) { this._hass = value; this.render(); }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 5, rows: 5, min_columns: 4, min_rows: 4 }; }
  getReading(key) { return reading(this._hass, this.config && this.config[key]); }

  text(item, fallback, decimals) {
    return item ? item.value.toFixed(decimals) + escapeHtml(item.unit || fallback) : "—" + fallback;
  }

  temperatureColor(value) {
    if (value === null) return "#8a8a8a";
    var anchors = [
      [this.config.min_temperature, "#0d47a1"],
      [0, "#2196f3"],
      [this.config.temperature_cold_below, "#2eaa60"],
      [this.config.temperature_warm_above, "#d4b000"],
      [this.config.temperature_hot_above, "#f39c12"],
      [this.config.max_temperature, "#e74c3c"]
    ].sort(function (a, b) { return a[0] - b[0]; });
    if (value <= anchors[0][0]) return anchors[0][1];
    for (var index = 1; index < anchors.length; index += 1) {
      if (value <= anchors[index][0]) {
        var start = anchors[index - 1];
        var end = anchors[index];
        var distance = Math.max(0.001, end[0] - start[0]);
        return mixColor(start[1], end[1], (value - start[0]) / distance);
      }
    }
    return anchors[anchors.length - 1][1];
  }

  humidityColor(value) {
    if (value === null) return "#8a8a8a";
    var dark = this.config.background === "black";
    if (value < this.config.humidity_dry_below) return dark ? "#ffb74d" : "#d97706";
    if (value <= this.config.humidity_high_above) return dark ? "#55d98b" : "#168a4a";
    if (value < this.config.humidity_critical_above) return dark ? "#ffd54f" : "#a66f00";
    return dark ? "#ff6b6b" : "#d32f2f";
  }

  arcSegments(progress) {
    if (progress <= 0) return "";
    var totalArc = progress * 75;
    var segmentCount = 72;
    var segmentLength = 75 / segmentCount;
    var segments = [];
    for (var index = 0; index < segmentCount; index += 1) {
      var start = index * segmentLength;
      if (start >= totalArc) break;
      var visibleLength = Math.min(segmentLength + 0.08, totalArc - start);
      var ratio = (start + visibleLength / 2) / 75;
      var temperature = this.config.min_temperature + ratio * (this.config.max_temperature - this.config.min_temperature);
      var color = this.temperatureColor(temperature);
      segments.push(`<circle class="arc-segment" cx="60" cy="60" r="50" pathLength="100" style="stroke:${color};stroke-dasharray:${visibleLength.toFixed(3)} ${(100 - visibleLength).toFixed(3)};stroke-dashoffset:${(-start).toFixed(3)}"></circle>`);
    }
    var startColor = this.temperatureColor(this.config.min_temperature);
    var endColor = this.temperatureColor(this.config.min_temperature + progress * (this.config.max_temperature - this.config.min_temperature));
    var startCap = `<circle class="arc-cap" cx="60" cy="60" r="50" pathLength="100" style="stroke:${startColor};stroke-dasharray:.01 99.99;stroke-dashoffset:0"></circle>`;
    var endCap = `<circle class="arc-cap" cx="60" cy="60" r="50" pathLength="100" style="stroke:${endColor};stroke-dasharray:.01 99.99;stroke-dashoffset:${(-totalArc).toFixed(3)}"></circle>`;
    return startCap + segments.join("") + endCap;
  }

  zeroMarker() {
    var minimum = this.config.min_temperature;
    var maximum = this.config.max_temperature;
    if (!this.config.show_zero_marker || minimum >= 0 || maximum <= 0) return "";
    var ratio = (0 - minimum) / (maximum - minimum);
    var angle = (135 + ratio * 270) * Math.PI / 180;
    var x1 = 60 + Math.cos(angle) * 47;
    var y1 = 60 + Math.sin(angle) * 47;
    var x2 = 60 + Math.cos(angle) * 53;
    var y2 = 60 + Math.sin(angle) * 53;
    return `<line class="zero-marker" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"></line>`;
  }

  currentMarker(progress, color) {
    var ratio = clamp(progress, 0, 1);
    var angle = (135 + ratio * 270) * Math.PI / 180;
    var x = 60 + Math.cos(angle) * 50;
    var y = 60 + Math.sin(angle) * 50;
    return `<circle class="current-marker" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.25" style="fill:${color}"></circle>`;
  }

  render() {
    if (!this.config || !this._hass) return;
    var temp = this.getReading("temperature");
    var humidity = this.getReading("humidity");
    var battery = this.getReading("battery");
    var batteryValue = battery ? battery.value : null;
    var temperatureValue = temp ? temp.value : null;
    var humidityValue = humidity ? humidity.value : null;
    var dialSize = Math.round(this.config.card_size * 0.58);
    var temperatureRange = Math.max(1, this.config.max_temperature - this.config.min_temperature);
    var temperatureProgress = temperatureValue === null ? 0 : clamp((temperatureValue - this.config.min_temperature) / temperatureRange, 0, 1);
    var arcColor = this.temperatureColor(temperatureValue);
    var humidityColor = this.humidityColor(humidityValue);
    var batteryColor = batteryValue !== null && batteryValue >= 80 ? "#2eaa60" : batteryValue !== null && batteryValue >= 30 ? "#e6a700" : "#d94c4c";
    var batteryIcon = batteryValue === null ? "mdi:battery-unknown" : batteryValue >= 95 ? "mdi:battery" : batteryValue >= 80 ? "mdi:battery-80" : batteryValue >= 60 ? "mdi:battery-60" : batteryValue >= 40 ? "mdi:battery-40" : batteryValue >= 20 ? "mdi:battery-20" : "mdi:battery-alert";
    var definitions = [["co2", "CO₂", "ppm"], ["tvoc", "TVOC", "ppb"], ["pressure", "Druk", "hPa"], ["dew_point", "Dauwpunt", "°C"]];
    var extras = definitions.filter((item) => this.config[item[0]]).map((item) => {
      var key = item[0];
      return `<button class="extra" data-entity="${escapeHtml(this.config[key])}"><small>${item[1]}</small>${this.text(this.getReading(key), item[2], key === "dew_point" ? 1 : 0)}</button>`;
    }).join("");

    this.shadowRoot.innerHTML = `<style>${CARD_CSS}</style><ha-card>
      <header><h2>${escapeHtml(this.config.title)}</h2>${this.config.battery ? `<button class="battery" data-entity="${escapeHtml(this.config.battery)}" style="color:${batteryColor}"><ha-icon icon="${batteryIcon}"></ha-icon>${this.text(battery, "%", 0)}</button>` : ""}</header>
      <button class="dial" style="top:${this.config.dial_position}%;width:${dialSize}px;height:${dialSize}px" data-entity="${escapeHtml(this.config.temperature)}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="50" pathLength="100"></circle>${this.arcSegments(temperatureProgress)}${this.zeroMarker()}${temperatureValue === null ? "" : this.currentMarker(temperatureProgress, arcColor)}</svg>
      <span class="values"><strong style="color:${arcColor}">${this.text(temp, "°C", 1)}</strong>${this.config.humidity ? `<span style="color:${humidityColor}"><ha-icon icon="mdi:water-percent" style="color:${humidityColor}"></ha-icon>${this.text(humidity, "%", 0)}</span>` : ""}</span></button><footer>${extras}</footer></ha-card>`;
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((node) => {
      node.addEventListener("click", () => this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: node.dataset.entity } })));
    });
  }
}

if (!customElements.get("climate-dashboard-card-v23")) {
  customElements.define("climate-dashboard-card-v23", ClimateDashboardCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "climate-dashboard-card-v23", name: "Climate Dashboard Card v2.3", preview: true });
  console.info("Climate Dashboard Card v2.3.2 geladen");
}
