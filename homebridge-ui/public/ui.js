/* global homebridge */
/**
 * Custom settings page for homebridge-vera2: lists the Vera controller's devices
 * with show/hide toggles, and renders the standard settings form below.
 *
 * The page talks to the controller via the plugin-ui server (`/devices`) and
 * persists the user's choices into `excludeDeviceIds` in the plugin config.
 */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const KIND_LABEL = {
    'switch': 'Switch',
    'dimmer': 'Dimmer',
    'rgb-light': 'RGB Light',
    'fan': 'Fan',
    'lock': 'Lock',
    'garage-door': 'Garage Door',
    'thermostat': 'Thermostat',
    'window-covering': 'Window Covering',
    'motion-sensor': 'Motion Sensor',
    'contact-sensor': 'Contact Sensor',
    'leak-sensor': 'Leak Sensor',
    'smoke-sensor': 'Smoke Sensor',
    'co-sensor': 'CO Sensor',
    'glass-break-sensor': 'Glass-break Sensor',
    'temperature-sensor': 'Temperature Sensor',
    'humidity-sensor': 'Humidity Sensor',
    'light-sensor': 'Light Sensor',
  };
  const label = (k) => KIND_LABEL[k] || k;

  let config = { platform: 'Vera2', name: 'Vera2' };
  let devices = [];
  const excluded = new Set(); // excluded Vera device ids (as strings)
  let includeMode = false; // true when includeDeviceIds is in use (overrides hiding)

  function setStatus(msg) {
    $('vera-status').textContent = msg || '';
  }

  async function init() {
    try {
      const arr = await homebridge.getPluginConfig();
      if (arr && arr[0]) {
        config = arr[0];
      }
      (config.excludeDeviceIds || []).forEach((id) => excluded.add(String(id)));
      includeMode = Array.isArray(config.includeDeviceIds) && config.includeDeviceIds.length > 0;
    } catch {
      /* ignore — fall back to defaults */
    }

    // Keep the normal settings form (host/port/etc.) visible below our panel.
    try {
      homebridge.showSchemaForm();
    } catch {
      /* ignore */
    }

    $('vera-refresh').addEventListener('click', loadDevices);
    $('vera-all').addEventListener('click', () => setAll(true));
    $('vera-none').addEventListener('click', () => setAll(false));
    $('vera-search').addEventListener('input', renderRows);

    if (includeMode) {
      const w = $('vera-warning');
      w.hidden = false;
      w.textContent =
        'Heads up: “Include only these device IDs” is set, which overrides hiding. Clear it in the settings ' +
        'form below to manage devices from this list.';
    }

    if (config.host) {
      loadDevices();
    }
  }

  async function loadDevices() {
    // Re-read the latest host/port in case the user just edited the form.
    try {
      const arr = await homebridge.getPluginConfig();
      if (arr && arr[0]) {
        config = arr[0];
        excluded.clear();
        (config.excludeDeviceIds || []).forEach((id) => excluded.add(String(id)));
        includeMode = Array.isArray(config.includeDeviceIds) && config.includeDeviceIds.length > 0;
      }
    } catch {
      /* ignore */
    }

    if (!config.host) {
      setStatus('Set the Vera host/IP in the settings below first, then click “Load devices”.');
      return;
    }

    setStatus(`Loading devices from ${config.host}…`);
    homebridge.showSpinner();
    try {
      const res = await homebridge.request('/devices', { host: config.host, port: config.port || 3480 });
      devices = (res && res.devices) || [];
      $('vera-toolbar').hidden = devices.length === 0;
      $('vera-table').hidden = devices.length === 0;
      setStatus(
        devices.length
          ? `${devices.length} device(s) found on ${config.host}.`
          : `No supported devices found on ${config.host}.`,
      );
      renderRows();
    } catch (err) {
      setStatus('');
      const message = (err && err.message) || String(err);
      homebridge.toast.error(message, 'Could not load devices');
    } finally {
      homebridge.hideSpinner();
    }
  }

  function renderRows() {
    const filter = ($('vera-search').value || '').toLowerCase();
    const tbody = $('vera-tbody');
    tbody.innerHTML = '';
    let shownCount = 0;

    for (const d of devices) {
      if (filter && !d.name.toLowerCase().includes(filter)) {
        continue;
      }
      const isShown = !excluded.has(String(d.id));
      if (isShown) {
        shownCount++;
      }

      const tr = document.createElement('tr');
      if (!isShown) {
        tr.classList.add('vera-hidden-row');
      }

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = isShown;
      cb.disabled = includeMode;
      cb.setAttribute('aria-label', `Show ${d.name}`);
      cb.addEventListener('change', () => toggle(String(d.id), cb.checked));

      const tdShow = document.createElement('td');
      tdShow.className = 'vera-col-show';
      tdShow.appendChild(cb);

      const tdName = document.createElement('td');
      tdName.textContent = d.name;

      const tdType = document.createElement('td');
      tdType.textContent = label(d.kind);

      const tdId = document.createElement('td');
      tdId.className = 'vera-col-id vera-id';
      tdId.textContent = d.id;

      const tdRoom = document.createElement('td');
      tdRoom.textContent = d.room || '';

      tr.append(tdShow, tdName, tdType, tdId, tdRoom);
      tbody.appendChild(tr);
    }

    const total = devices.length;
    const hidden = total - shownCount - countFilteredOut(filter);
    $('vera-count').textContent = filter
      ? `${tbody.childElementCount} shown by filter`
      : `${total - excluded.size} of ${total} exposed`;
    void hidden;
  }

  function countFilteredOut(filter) {
    if (!filter) {
      return 0;
    }
    return devices.filter((d) => !d.name.toLowerCase().includes(filter)).length;
  }

  function setAll(show) {
    if (includeMode) {
      return;
    }
    for (const d of devices) {
      if (show) {
        excluded.delete(String(d.id));
      } else {
        excluded.add(String(d.id));
      }
    }
    persist();
    renderRows();
  }

  function toggle(id, show) {
    if (show) {
      excluded.delete(id);
    } else {
      excluded.add(id);
    }
    persist();
    renderRows();
  }

  async function persist() {
    config.excludeDeviceIds = [...excluded]
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    try {
      await homebridge.updatePluginConfig([config]);
    } catch {
      /* ignore — the user can still Save the form manually */
    }
  }

  // The script is at the end of <body>, so the DOM is ready and the injected
  // `homebridge` global is available.
  init();
})();
