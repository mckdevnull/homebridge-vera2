# homebridge-vera2

A [Homebridge](https://homebridge.io) **dynamic platform** plugin (a plugin that discovers your devices automatically, instead of you listing each one by hand) that brings the devices, scenes, and House Mode from your **Vera** (MiCasaVerde / now Ezlo) smart-home controller into Apple HomeKit. It talks to your Vera directly over your home network using the legacy **Luup HTTP API** (Vera's built-in local web API), automatically discovers your devices, and exposes each one as the matching HomeKit accessory type (lights, switches, sensors, locks, thermostats, window coverings, and more). It is a clean, maintained replacement for the abandoned `homebridge-vera` and `homebridge-plugin-vera` projects, which rely on APIs removed in Homebridge 2.0.

> ### 🏠 Local-network only — no cloud account, no paywall
> - This plugin talks to your Vera **directly on your LAN** at `http://<vera-ip>:3480` using the Luup HTTP API.
> - **No Vera / Ezlo cloud account is required.**
> - It is **unaffected by the Ezlo cloud-API paywall taking effect 1 August 2026** — local control remains free.
> - For remote access, use Homebridge's own remote-access features (the plugin itself does not use the cloud).

Built for **Homebridge 2.0** and backward-compatible with **1.8+**. Written in TypeScript + ESM (modern JavaScript modules) with **zero runtime dependencies**, running on Node.js 22/24.

> 📦 **Heads-up: not on npm yet.** This plugin is at version `0.1.0` and is **not published to the npm registry** at the time of writing. That means you **cannot** find it by searching in Homebridge Config UI X, and `npm install -g homebridge-vera2` will fail with a "404 Not Found" error. For now, install it **from GitHub** instead — see [Installation](#installation) for the exact commands. Once it is published, the standard npm and Config UI X steps below will work too.
>
> **Important distinction:** plugin **search** in Config UI X only lists plugins published to npm, so this plugin will *not* appear there yet. But once you install it from GitHub (below) it **does** appear under the Config UI X **Plugins** tab (the list of *installed* plugins), where you can open its **Settings** form. You can also always configure it by editing `config.json` directly — see [Configuration](#configuration).

> 💡 **Throughout this README, replace the placeholders with your own values:** `<vera-ip>` is your Vera controller's IP address (for example, `192.168.1.50`), and `<your-homebridge-ip>` is the IP address of the machine running Homebridge.

---

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Supported devices](#supported-devices)
- [Verifying it works](#verifying-it-works)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Updating](#updating)
- [Uninstalling](#uninstalling)
- [Contributing / development](#contributing--development)
- [License](#license)

---

## Requirements

| Requirement | Details |
| --- | --- |
| **Node.js** | `^22.14.0 \|\| ^24.0.0` (Node.js 22 or 24) |
| **Homebridge** | `^1.8.0 \|\| ^2.0.0` (built for 2.0, also works on 1.8+) |
| **Vera controller** | A Vera unit reachable on your LAN that exposes the **Luup HTTP API on port 3480** |

### Supported controllers

This plugin targets **legacy Vera units (UI5 / UI7)** that expose the Luup HTTP API on port `3480`:

- VeraEdge
- VeraPlus
- VeraSecure
- VeraLite
- Vera3

> **Native Ezlo hubs (Ezlo Plus / Secure / Atom) are NOT supported.** They do not expose the Luup API; they use a newer WSS / JSON-RPC API (a different, websocket-based protocol) on port `17000`. (An Ezlo backend may be added in the future — the architecture is ready for it.)

### Find your Vera's IP address

You'll need the local IP address of your Vera controller. Find it in either of these ways:

1. **Your router's DHCP / client list** — log in to your router's admin page and look for a device named like `Vera`, `VeraEdge`, or `MiCasaVerde`. Note its IP (for example, `192.168.1.50`).
2. **The Vera UI** — open the Vera web interface and look in its network/Wi-Fi settings for the unit's local IP address.

> **Tip: give your Vera a fixed IP.** The `host` you configure below is the only required setting, and it is an IP address. If your router hands the Vera a different address later (a normal DHCP lease change), the plugin will suddenly stop connecting and your devices will show as "Not Responding". To avoid this, set up a **DHCP reservation** (sometimes called a "static lease") for the Vera in your router, or configure a static IP on the Vera itself, so its address never changes.

### Quick reachability check

Before installing, confirm the Vera answers on port `3480`. Replace `<vera-ip>` with your controller's IP.

**No terminal needed** — open this URL in a web browser:

```
http://<vera-ip>:3480/data_request?id=alive
```

You should see a simple response of `OK`. If the page is blank or you get a connection error, the Vera is not reachable at that IP/port — see [Troubleshooting](#troubleshooting--faq).

**From a terminal** (macOS/Linux; on Windows use PowerShell's `curl.exe`, or just paste the URL into a browser as above):

```bash
curl "http://<vera-ip>:3480/data_request?id=alive"
```

`OK` confirms the Vera's Luup engine is running. To go one step further and confirm the exact endpoint the plugin actually uses — and that it returns JSON — try this:

```bash
curl "http://<vera-ip>:3480/data_request?id=sdata&output_format=json"
```

You should see a JSON object that includes a `devices` list. If both checks pass, you're ready to install.

> For more on these `data_request` endpoints and the `id=alive` check, see the Luup Requests reference at [wiki.mios.com/index.php/Luup_Requests](https://wiki.mios.com/index.php/Luup_Requests).

---

## Installation

### Before you start

This is a **plugin for Homebridge**, so you need a working **Homebridge instance (with Config UI X)** running first. If you don't have Homebridge yet, follow the official setup guide: [github.com/homebridge/homebridge/wiki](https://github.com/homebridge/homebridge/wiki). Once Homebridge is installed and you can open its **Config UI X** web interface (typically `http://<your-homebridge-ip>:8581`), come back here.

A few terms used below:
- **Config UI X** — the Homebridge web dashboard where you install plugins and edit settings.
- **hb-service** — the Homebridge command-line service manager used by the standard service-based install.

### Installing while the plugin is not on npm

Because `homebridge-vera2` is **not yet published to npm** (see the heads-up at the top), the Config UI X search and the plain `npm install -g homebridge-vera2` command will not find it yet. Install directly from the GitHub repository instead.

#### Option A — install from GitHub with `hb-service` (recommended for now)

If you run Homebridge with `hb-service` (the standard service-based install):

```bash
sudo npm install -g git+https://github.com/mckdevnull/homebridge-vera2.git
sudo hb-service restart
```

> Depending on how your system is set up, you may not need `sudo`. If you get a permissions error, add `sudo`; if `sudo` is unnecessary on your machine, drop it.

> The plugin **ships prebuilt** — installing it does **not** compile anything, so no build tools (TypeScript, etc.) are needed on your machine. (If an earlier version failed to install on Windows with an error like `'rimraf' is not recognized` or `git dep preparation failed`, that install-time build step has been removed — just re-run the command above.)

After Homebridge restarts, the plugin appears under the Config UI X **Plugins** tab (the *installed* plugins list — **not** plugin search). Open its **Settings** there to configure it, or edit `config.json` directly (see [Configuration](#configuration)).

#### Option B — clone and build from source

```bash
git clone https://github.com/mckdevnull/homebridge-vera2.git
cd homebridge-vera2
npm install
npm run build
sudo npm link
sudo hb-service restart
```

This builds the plugin locally and links it into your global Homebridge install. Then configure it (see [Configuration](#configuration)).

#### Option C — Docker / Synology

If you run Homebridge in a Docker container (a self-contained, isolated app environment), including the Synology / `homebridge/homebridge` image:

- Open a shell inside the container and install from GitHub:

  ```bash
  docker exec -it homebridge sh
  npm install -g git+https://github.com/mckdevnull/homebridge-vera2.git
  ```

  Replace `homebridge` with your container's name. Then **restart the container** (or use the **Restart Homebridge** button in the container's Config UI X).

> **Networking tip:** Use **host networking** (the Docker setting that lets the container share the host machine's network) for the Homebridge container. This lets the plugin reach your Vera at `http://<vera-ip>:3480`, and lets HomeKit discover the bridge for pairing (which relies on mDNS/Bonjour, Apple's local-network device-discovery system).

### Once the plugin is published to npm

After `homebridge-vera2` is published, you'll be able to use the standard paths below. **They will not work until publication** — until then, use the GitHub options above.

- **Config UI X (easiest):** open Config UI X, go to the **Plugins** tab, search for **`homebridge-vera2`**, click **Install**, and configure it via the settings form.
- **Command line:**

  ```bash
  sudo npm install -g homebridge-vera2
  sudo hb-service restart
  ```
- **Docker / Synology:** install via the container's Config UI X exactly as above, or open a shell in the container (`docker exec -it homebridge sh`) and run `npm install -g homebridge-vera2`, then restart the container.

---

## Configuration

The plugin is a Homebridge **platform** (a plugin type that manages a whole set of accessories). Its platform alias — the identifier Homebridge uses to load this plugin — is **`Vera2`**.

The only setting you *must* provide is **`host`** (your Vera's IP address or hostname). Everything else has a sensible default.

### a. Configuring via Config UI X (recommended)

1. In Config UI X, go to **Plugins**, find **homebridge-vera2**, and click **Settings**.
2. Fill in the form:
   - **Host** — your Vera's IP address or hostname (for example, `192.168.1.50`). **This is required.**
   - **Name** — a label for the platform in your logs (defaults to `Vera2`).
   - Adjust the optional fields (port, polling, hide scenes, include/exclude device IDs, etc.) only if you need to. The defaults work for most setups.
3. **Save** and restart Homebridge when prompted.

### b. Editing `config.json` directly

Add a block to the `platforms` array using the exact alias `Vera2`. In practice you only need `platform`, `name`, and `host` — start minimal:

```json
{
  "platforms": [
    {
      "platform": "Vera2",
      "name": "Vera2",
      "host": "192.168.1.50"
    }
  ]
}
```

> Replace `"192.168.1.50"` with your Vera's actual IP address. The `platform` value **must** be `Vera2`.

If you want to override the optional settings, here is the same block with **every** option shown at its **default** value. Delete any line you don't need:

```json
{
  "platforms": [
    {
      "platform": "Vera2",
      "name": "Vera2",
      "host": "192.168.1.50",
      "port": 3480,
      "pollTimeoutSeconds": 30,
      "pollMinimumDelayMs": 200,
      "requestTimeoutSeconds": 10,
      "hideScenes": false,
      "hideHouseMode": false,
      "exposeArmDisarm": false,
      "includeDeviceIds": [],
      "excludeDeviceIds": [],
      "debug": false
    }
  ]
}
```

### All options

| Option | Default | Required | Description |
| --- | --- | --- | --- |
| `host` | _(none)_ | **Yes** | The local IP address or hostname of your Vera controller. |
| `name` | `Vera2` | No (defaults to `Vera2`) | Platform name shown in the Homebridge logs. |
| `port` | `3480` | No | Luup HTTP port. Default is 3480. (min 1, max 65535) |
| `pollTimeoutSeconds` | `30` | No | How long the controller holds each incremental update request open before returning. Higher = less traffic. (min 5, max 120) |
| `pollMinimumDelayMs` | `200` | No | Minimum time the controller waits before returning a change, to coalesce bursts. (min 0, max 5000) |
| `requestTimeoutSeconds` | `10` | No | Timeout for one-off control/read requests. (min 2, max 60) |
| `hideScenes` | `false` | No | Do not expose Vera scenes as momentary switches. |
| `hideHouseMode` | `false` | No | Do not expose the controller House Mode as a Security System accessory. |
| `exposeArmDisarm` | `false` | No | For armable security sensors, expose an additional switch to arm/disarm the sensor. |
| `includeDeviceIds` | `[]` | No | If set, ONLY these Vera device numbers are exposed (everything else hidden). See [Hiding or limiting which devices appear](#hiding-or-limiting-which-devices-appear). |
| `excludeDeviceIds` | `[]` | No | Vera device numbers to hide from HomeKit. See [Hiding or limiting which devices appear](#hiding-or-limiting-which-devices-appear). |
| `debug` | `false` | No | Verbose debug logging. |

> **Which option is really required?** Only **`host`** — if it is missing or empty, the plugin will not start. Everything else, including `name`, has a working default.

---

## Hiding or limiting which devices appear

By default every supported Vera device is exposed to HomeKit. There are two ways to hide the ones you don't want.

### Easiest: the device picker (Config UI X)

If you use Homebridge Config UI X, open the plugin's **Settings** — at the top you'll see a **Vera devices** panel listing every discovered device with a **Show** checkbox, its type, Vera ID and room:

- Click **Load devices** (it reads the host you've set), then **untick** any device you want to hide. Use the filter box or **Show all / Hide all** for bulk changes.
- Click **Save** at the bottom of the window and restart Homebridge. Unticked devices are removed from HomeKit.

That's it — no need to look up numbers by hand. (The picker manages the `excludeDeviceIds` list for you.)

### Manual: by device number

If you don't use Config UI X, reference each device by its **Vera device number**.

#### Step 1 — find a device's number

There is no separate device list in the settings form; the plugin prints one to the **log** every time it starts. Two easy ways to find a number:

1. **Homebridge log (recommended).** Open Config UI X → **Logs** (or `hb-service logs`) and restart the plugin. For every device you'll see a line like:

   ```
   [Vera2] Adding "Front Door" (Vera device 31) as lock
   [Vera2] Adding "Driveway Motion" (Vera device 147) as motion-sensor
   ```

   The number in `(Vera device N)` is what you use below. This is your full device inventory.
2. **Apple Home app.** Open the accessory → **Settings** (gear) → scroll to **Serial Number**. It is shown as `vera-<number>` (e.g. `vera-31`).

#### Step 2 — hide the ones you don't want

In the plugin settings, under **Exposed accessories → Exclude these device IDs**, click **+ Add**, type each number, and **Save**. Or edit `config.json` directly:

```json
{
  "platform": "Vera2",
  "name": "Vera2",
  "host": "192.168.1.50",
  "excludeDeviceIds": [147, 203, 256]
}
```

Restart Homebridge. Excluded devices are unregistered and disappear from the Home app.

### Or: expose only specific devices

If you'd rather start from nothing and pick a few, use **Include only these device IDs** (`includeDeviceIds`) instead. When that list is non-empty, **only** those device numbers are exposed and everything else is hidden:

```json
"includeDeviceIds": [31, 282]
```

> `includeDeviceIds` and `excludeDeviceIds` accept the Vera **device numbers** (integers). If both are set, the include list is applied first, then the exclude list.

---

## Supported devices

On startup the plugin discovers your Vera devices and maps each one to the closest HomeKit accessory type. The mapping is based on Vera's own category/subcategory classification.

| Vera device | HomeKit accessory |
| --- | --- |
| Dimmable light (category 2) | Lightbulb (+ Brightness) |
| Dimmable light, RGB (category 2, subcategory 4, or exposes `Color1` service) | Lightbulb (+ Brightness, Hue, Saturation) |
| Dimmable light (category 2) with `fan` in `device_type` / `device_file` | Fan (+ variable speed) |
| Switch (category 3) | Switch |
| Switch (category 3, subcategory 5) | Garage Door Opener |
| Switch (category 3) with `fan` in `device_type` / `device_file` | Fan |
| Security sensor — door/window (category 4, subcategory 1) | Contact Sensor |
| Security sensor — leak (category 4, subcategory 2) | Leak Sensor |
| Security sensor — motion (category 4, subcategory 3) | Motion Sensor |
| Security sensor — smoke (category 4, subcategory 4) | Smoke Sensor |
| Security sensor — CO (category 4, subcategory 5) | Carbon Monoxide Sensor |
| Security sensor — glass break (category 4, subcategory 6) | Motion Sensor |
| Security sensor — unknown subcategory (category 4) | Contact Sensor (safe generic fallback) |
| Thermostat (category 5) | Thermostat |
| Door lock (category 7) | Lock Mechanism |
| Window covering (category 8) | Window Covering |
| Humidity sensor (category 16) | Humidity Sensor |
| Temperature sensor (category 17) | Temperature Sensor |
| Light sensor (category 18) | Light Sensor |
| Garage door (category 32) | Garage Door Opener |
| Any other / unrecognized category | Unsupported (not exposed) |
| Scenes (from `sdata`) | Momentary Switch that runs the scene (unless `hideScenes`) |
| Controller House Mode | Security System accessory (unless `hideHouseMode`) |

### House Mode → HomeKit Security System

Unless you set `hideHouseMode: true`, your controller's House Mode is exposed as a Security System accessory:

| Vera House Mode | HomeKit Security System state |
| --- | --- |
| Home (1) | Stay |
| Away (2) | Away |
| Night (3) | Night |
| Vacation (4) | Disarmed |

Setting the Security System state in HomeKit changes the controller's House Mode accordingly.

### Extra services

- **Battery service:** Battery-powered devices also expose a Battery service, including low-battery status.
- **Arm/disarm switch (optional):** For armable security sensors, set `exposeArmDisarm: true` to add an extra **Switch** that arms/disarms the sensor.

---

## Verifying it works

1. **Restart Homebridge.**
   - **Config UI X / hb-service:** use the **Restart Homebridge** button in Config UI X, or run `sudo hb-service restart`.
   - **Docker / Synology:** restart the container (via your container manager), or use the **Restart Homebridge** button in the container's Config UI X.
2. **Watch the logs.** A successful startup discovers your devices and logs a line like:

   ```
   Discovered 12 supported device(s) and 3 scene(s) on Vera (C).
   ```

   (The numbers will match your setup, and the trailing letter is your Vera's temperature unit — `C` or `F`.) You may also see per-device lines such as `Skipping unsupported device ...` for devices whose category isn't mapped — that's normal.

   - **Config UI X / hb-service:** view live logs from the **Logs** tab in Config UI X, or run `sudo hb-service logs`.
   - **Docker / Synology:** use the **Logs** tab in the container's Config UI X, or run `docker logs <container>`.

   **What a failure looks like:** if `host` is missing you'll see `Vera2 configuration error: Missing required "host" ...`, and if the Vera can't be reached you'll see `Failed to connect to Vera at <host>:<port> ...`. If you see either, check your config and the [reachability check](#quick-reachability-check), then see [Troubleshooting](#troubleshooting--faq).
3. **Pair the Homebridge bridge with HomeKit** (only needed if you haven't already). Open the **Apple Home** app, tap **+** → **Add Accessory**, then **scan the QR code** shown on the Config UI X home/status page (it also appears in the Homebridge logs at startup). Enter the setup PIN if asked. For the full walkthrough, see [github.com/homebridge/homebridge/wiki](https://github.com/homebridge/homebridge/wiki).
4. **Check the Apple Home app.** Your Vera devices, scenes, and the House Mode security system appear **under your Homebridge bridge**. New accessories may take a moment to populate after a restart.

---

## Troubleshooting & FAQ

### I installed from GitHub but the plugin doesn't appear in Config UI X (and search can't find it)

Two different things are going on:

- **Search will never find it (yet).** Config UI X plugin *search* only lists plugins published to the **npm registry**. This plugin isn't published there yet, so it won't appear in search. That's expected — install it from GitHub instead (see [Installation](#installation)).
- **After a GitHub install it appears under the Plugins tab.** The plugin ships **prebuilt** (the compiled `dist/` is bundled), so installing needs no build tools and runs no build step. Once installed and Homebridge is restarted, it shows up under the **Plugins** tab (the *installed* list).

**Saw `'rimraf' is not recognized` or `git dep preparation failed` on Windows?** That came from an older version that tried to compile during installation. That step has been removed — the plugin now ships prebuilt. Just reinstall and restart:

```bash
npm install -g git+https://github.com/mckdevnull/homebridge-vera2.git
```

(then restart Homebridge — `hb-service restart`, the **Restart Homebridge** button, or restart the Docker container. On macOS/Linux you may need `sudo` before `npm`.)

**Sanity check** — confirm it installed: `npm ls -g homebridge-vera2`. If the plugin still doesn't load after a restart, check the Homebridge logs for the reason and reinstall with the command above.

**Then configure it.** Once Homebridge restarts, the plugin appears under the Config UI X **Plugins** tab — click **Settings** to use the form. You can also skip the UI entirely and add the platform block to `config.json` yourself (see [Configuration](#configuration)); manual config works regardless of whether the plugin shows in the UI.

### No devices found / cannot connect to the Vera

- Double-check the **`host`** value is your Vera's correct LAN IP.
- **Worked before, then suddenly stopped?** The Vera's IP may have changed (a DHCP lease change). Re-check its current IP and set a **DHCP reservation** so it stays fixed (see [Find your Vera's IP address](#find-your-veras-ip-address)).
- Confirm the Vera is reachable on **port 3480**, not a different port.
- Run the reachability checks again and confirm you get `OK` and then a JSON object containing `devices`:

  ```bash
  curl "http://<vera-ip>:3480/data_request?id=alive"
  curl "http://<vera-ip>:3480/data_request?id=sdata&output_format=json"
  ```
- Check that no **firewall** (on the Homebridge host, the network, or the Vera) is blocking traffic to port `3480`.
- If running in Docker, confirm the container can reach the Vera — **host networking** is recommended (see [Docker / Synology](#option-c--docker--synology)).
- Enable [debug logging](#enabling-debug-logging) to see the exact requests and responses.

### A device shows "Not Responding" in the Home app

- This usually means HomeKit can't get a fresh value from the device. Confirm the Vera is reachable (run the `alive` check above) and that Homebridge is running.
- If it worked before and many devices went "Not Responding" at once, the Vera's IP may have changed — re-check it and consider a DHCP reservation.
- A temporarily offline battery device or a slow controller can cause this. If it's transient, it often clears on its own once the device reports again.
- If it persists, try increasing `requestTimeoutSeconds` (default `10`, max `60`) so slow controllers have more time to respond.

### A device maps to the wrong HomeKit type

- Mapping is based on the Vera device's category/subcategory (see the [Supported devices](#supported-devices) table). For example, a switch with `fan` in its device type is exposed as a Fan, and an unknown security sensor falls back to a Contact Sensor.
- If a specific device is mapped in a way you don't want, you can hide it with `excludeDeviceIds` (see below).

### How do I include or exclude specific devices?

You filter by **Vera device number** (the device's ID in the Vera UI), entered as integers:

- To expose **only** certain devices, list their numbers in `includeDeviceIds`. When this list is non-empty, *only* those devices are exposed:

  ```json
  "includeDeviceIds": [12, 14, 27]
  ```
- To **hide** specific devices, list their numbers in `excludeDeviceIds`:

  ```json
  "excludeDeviceIds": [33, 40]
  ```
- Leave both empty (`[]`) to expose all supported devices.

### Scenes appear as momentary switches

This is expected. Each Vera scene is exposed as a **momentary switch** (a switch that turns itself back off immediately) that runs the scene when toggled. To stop exposing scenes entirely, set `hideScenes: true`.

### My thermostat shows the wrong temperature units

The thermostat reflects the values reported by the Vera. Apple Home displays temperatures in the units configured for your iOS / Home settings — change the temperature unit there if the displayed unit isn't what you expect.

### I have a native Ezlo hub (Ezlo Plus / Secure / Atom)

Native Ezlo hubs are **not supported**. They do not expose the Luup HTTP API; they use a different WSS / JSON-RPC API on port `17000`. Only legacy Vera units (UI5/UI7) that expose Luup on port `3480` work with this plugin.

### Enabling debug logging

Set `debug: true` in your config (or toggle it in the Config UI X form) and restart Homebridge for verbose logs that help diagnose connection and discovery issues.

```json
"debug": true
```

### Where do the Homebridge logs live?

- **Config UI X:** the **Logs** tab in the web interface.
- **`hb-service`:** run `sudo hb-service logs` to stream them.
- **Docker / Synology:** the **Logs** tab in the container's Config UI X, or `docker logs <container>`.
- The on-disk location depends on your installation (commonly under your Homebridge storage path). Config UI X shows you the active log source.

---

## Updating

> While the plugin is **not on npm**, update it the same way you installed it — re-run the GitHub install command and restart:
>
> ```bash
> sudo npm install -g git+https://github.com/mckdevnull/homebridge-vera2.git
> sudo hb-service restart
> ```
>
> (Docker / Synology: run the install inside the container with `docker exec -it homebridge sh`, then restart the container.)

Once the plugin is published to npm, you'll also be able to update it the standard way:

### Via Config UI X

1. Go to the **Plugins** tab.
2. If an update is available for **homebridge-vera2**, click **Update**.
3. Restart Homebridge when prompted (Docker / Synology: restart the container or use the **Restart Homebridge** button in the container's Config UI X).

### Via npm

```bash
sudo npm install -g homebridge-vera2
sudo hb-service restart
```

(Omit `sudo` if your setup doesn't require it. Docker / Synology: run inside the container, then restart it.)

---

## Uninstalling

1. **Remove the platform block** for `Vera2` from your `config.json` (or remove the plugin via the Config UI X Plugins tab, which handles the config too).
2. **Uninstall the package:**

   ```bash
   sudo npm uninstall -g homebridge-vera2
   ```

   (Docker / Synology: run this inside the container via `docker exec -it homebridge sh`.)
3. **Restart Homebridge:**
   - **Config UI X / hb-service:** `sudo hb-service restart`, or the **Restart Homebridge** button.
   - **Docker / Synology:** restart the container, or use the **Restart Homebridge** button in the container's Config UI X.

---

## Contributing / development

Contributions are welcome. The project is TypeScript + ESM with zero runtime dependencies.

```bash
# Install dev dependencies
npm install

# Build (compile TypeScript to dist/)
npm run build

# Type-check only
npm run lint

# Run the test suite
npm test

# Run tests with coverage
npm run test:coverage
```

For the architecture and design rationale (including the Vera Luup API reference and how an Ezlo backend could be added later), see [DESIGN.md on GitHub](https://github.com/mckdevnull/homebridge-vera2/blob/main/DESIGN.md).

---

## License

Licensed under the [Apache-2.0](LICENSE) license.
