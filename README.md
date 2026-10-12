# Data Center Explorer

An interactive 3D model of a modern colocation / AI data center campus, built to teach how a data center works: accurate enough for an engineer, clear enough for a beginner.

Fly over the site, drop into the building with X-ray view, walk the cold aisles, and click any piece of equipment (a GPU tray, a CRAH, a UPS, a generator) to learn what it does, its typical specs and what it connects to.

## Running it

Requires Node.js 20+ (developed on Node 22).

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts:

```bash
npm run build   # production build
npm run lint    # ESLint
npm test        # unit tests: simulation model, scenarios, data routes, rack layout, GPU tray, walk collisions (Vitest)
npx tsc --noEmit  # strict type check
```

## Using it

- **Explore panel (left):** jump to any zone: the substation, generator yard, rooftop cooling, each room, or close-ups such as an NVL72 GPU rack, its rear manifolds, or a CDU. The floor plan above it is clickable too.
- **Camera modes (toolbar):**
  - **Orbit:** drag to orbit, scroll to zoom (towards the cursor), right-drag to pan.
  - **Walk:** first person at 1.7 m eye height. Press *Click to look around* to capture the mouse. WASD or arrow keys move, Shift runs, clicking inspects whatever is under the crosshair, and Esc frees the mouse. You collide with walls, racks and equipment, so use the doorways (the main entrance is on the south side). You step up onto Hall A's raised floor.
  - **Tour:** an 18-stop guided tour (arrival, power, cooling, white space, network, operations). Each stop flies the camera, switches on the relevant overlays, highlights a key object and narrates. Use auto-play or Previous / Next.
- **Click** anything to open its info panel (right). Hover shows the name.
- **Toolbar:** Scenarios menu, X-ray (remove roof and facade), rack doors, and layers for cables, pipes, raised-floor tiles and ceilings.
- **GPU tray service:** click any compute tray in a GPU rack, choose *Pull out & service this tray*, then drag its front handle (or use the slider) to slide it out on its rails. The rear coolant quick-disconnects, NVLink connectors and busbar clip decouple as it moves. Remove it onto the service cart, switch to the exploded view, and click the GPUs, Grace CPUs, cold plates, couplings or NICs to learn about them.
- **Simulation panel (bottom):** play/pause and speed, overall compute load, outdoor temperature, and the Data, Power, Airflow and Heat map overlays. With Data on, pick a scenario (web page, video stream, database query, AI inference) to see its hop-by-hop path and latencies.
- **Facility metrics (bottom right):** live total power, IT load, PUE, inlet temperatures, network traffic, alerts, and where the overhead goes.
- **Sound (toolbar):** synthesised ambience that follows where you are and what's happening: data-hall fan noise rising with load, electrical hum, cooling-plant drone, wind outside, generators cranking and running, the fire sounder, UPS beeps and BMS chimes. It is generated with the Web Audio API, so there are no audio files. Off by default.
- **Quality (toolbar):**
  - **High:** ambient occlusion and full post-processing.
  - **Balanced (default):** no ambient occlusion, 2048² shadows, 1× resolution.
  - **Low:** no post-processing, 2048² shadows, no grass tufts, 1× resolution.
  - **Default: Balanced.** The level is fixed and only changes when you pick another one. There is deliberately no automatic switching: changing level rebuilds the post-processing chain, and doing that on the fly from the frame rate made the view flash black.
- **Debug panel (top, dev only):** exposure, light, LED brightness, bloom, ambient occlusion, a post-processing bypass and an FPS counter.

## Simulations

All simulations run on one clock (`lib/sim/clock.ts`), so play, pause and speed apply everywhere: packets, airflow, power pulses, fans and LED activity.

| Overlay | What it shows |
|---|---|
| Data | Requests (green) travel internet → fibre entry → entrance cabinet → cross-connect → border router → spine → overhead fibre → leaf → server, and responses (lime) travel back. The server flashes while it "processes". Hop labels show latency. Inside the building every hop takes microseconds; the internet and server processing dominate. |
| Power | Pulses run along both independent 2N paths: substation → transformer → ATS → switchboard → UPS (with its battery DC link) → busway → Hall A PDUs and Hall B. kW labels at each stage; generator paths stay dark until a utility failure. |
| Airflow | Hall A: cold air rises through perforated tiles, passes through the servers (turning from blue to red), exhausts into the hot aisle and returns to the CRAHs. Hall B: fan walls push air down the cold aisles into the hot-aisle containment and back through the ceiling plenum. |
| Heat map | Floor thermal map from every rack's inlet and exhaust temperature, plus heat-coloured caps on each rack. |

### Failure scenarios

Choose one from **⚠ Scenarios** in the toolbar. The camera flies to the action, the relevant overlays switch on, and a narration panel walks through each step with a progress bar.

| Scenario | What happens |
|---|---|
| Utility power loss | Lights flicker and drop to emergency level. The UPS carries the load on battery (state of charge shown), generators crank and run up (fans spin, beacons change, exhaust appears), and the ATS transfers within 10 s (NFPA 110 Type 10). Later the grid returns, the load retransfers and the generators cool down. |
| CRAH unit failure | CRAH-A4 trips (red beacon and fault display). Nearby racks heat up with thermal lag (a distance-weighted rise in the model), the NOC alarms, the other units ramp up, and temperatures recover after the repair. |
| Server failure | The target server dies; requests are dropped (red flash) until health checks fail, then the load balancer routes traffic to another rack. |
| Switch failure | Spine NC1-04 fails; ECMP reroutes through another spine in about 300 ms. |
| Fire detected | Smoke from rack A05-10, VESDA Alert → Action → Fire 1 → Fire 2, red strobes, a 30 s evacuation countdown, then clean agent floods the hall (fog) within 10 s, followed by the hold period and ventilation. |
| Fibre cut | An excavator cuts route A; traffic moves to the diverse route B from the west within about 0.5 s. |

Scenario timelines and their effects (`lib/sim/scenarios.ts`) are pure functions with unit tests.

The load slider drives everything: per-rack power, temperatures, cooling power (fan affinity law, chillers vs free cooling), packet rate, fan speed and LED activity. The facility model (`lib/sim/model.ts`) is pure TypeScript and unit tested. It computes IT power per rack, UPS and distribution losses (including no-load losses, so PUE worsens at low load), cooling power and PUE.

## What is modelled

| Area | Contents |
|---|---|
| Site | 132 kV overhead line and substation, pad transformers, 8 x 2.5 MW generators with fuel tanks, perimeter fence, crash-rated gate, guard house, CCTV, two diverse fibre entries, parking, water tank |
| Rooftop | Cooling towers and V-shape dry coolers with spinning fans, cooling-water headers |
| Data Hall A | ~200 air-cooled 42U racks in 5 pods, 600 mm raised floor with perforated tiles, cold-aisle containment, 12 downflow CRAHs, under-floor chilled water, overhead busway and fibre/copper trays |
| Data Hall B | 60 liquid-cooled NVIDIA GB200 NVL72-class racks, hot-aisle containment, in-row CDUs (N+1), fan walls, TCS and FWS pipework |
| Network | Meet-Me Room with carrier cages and cross-connect frames, network core with spine switches and border routers |
| Power | Electrical rooms A and B (switchboards, ATS, UPS), Li-ion battery room, 2N A/B paths down to rack PDUs |
| Cooling plant | Water-cooled chillers, chilled- and condenser-water pumps, free-cooling heat exchanger, headers to the halls |
| Safety and ops | VESDA, pre-action sprinklers, clean-agent cylinder banks, mantrap, badge and biometric readers, NOC with video wall |

Technical figures (rack dimensions, power, cooling temperatures, redundancy levels, PUE, generator start times and so on) come from vendor datasheets and industry surveys. See [`docs/research.md`](docs/research.md) for sources and the ranges where sources disagree.

## How the code is organised

```
app/                 Next.js App Router entry (page, layout, global CSS)
components/
  scene/             Canvas, lighting/sky/clouds, post-processing, camera rig and flights
  site/              Terrain, roads, parking, trees, fence and gate, substation, generator yard
  building/          Building shell (facade/cutaway), interior walls/floors/ceilings, rooftop plant
  zones/             One component per room: data halls, MMR + core, cooling plant, power rooms, NOC, security, fire room
  simulation/        Sim driver, packet flow, power flow, airflow particles, heat map, live NOC screens
  equipment/         Reusable equipment: racks (detailed + LOD field), GPU rack, CRAH, CDU, fan wall, UPS, switchgear, generator…
  common/            Primitives (bevelled boxes, cylinders), pipe networks, spinning fans, Selectable wrapper
  ui/                Toolbar, explore panel + minimap, info panel, hover label, debug panel
data/                Pure data: site and room layout, rack placements, zones/camera shots, guided tour, equipment descriptions
lib/
  rack/              Pure TypeScript rack model: slot layout, part recipes, cabling, PDUs, NVL72 layout, GB200 compute-tray internals
  sim/               Pure TypeScript simulation: clock, facility model (power, cooling, PUE, temperatures), data and power routes, failure scenarios
  walk/              Walk-mode collision world (walls, racks, equipment as 2D boxes) and circle-vs-box sliding
  three/             Shared geometries, cached materials, procedural textures, surface-detail shader, rack face textures
store/useStore.ts    Zustand: selection, hover, camera flights, cutaway, layers
types/               Shared types (equipment ids, rack slots)
docs/                Research notes and the rendering-quality plan
```

### Key techniques

- **Pure layout logic, separate from rendering.** `lib/rack` turns a list of rack slots into placed devices, then into flat lists of boxes and LEDs ("parts") and cable routes. It has no Three.js dependency, so it can be unit tested.
- **Instancing everywhere.** A rack's contents render as one `InstancedMesh` per material, LEDs blink on the GPU through a per-instance attribute, and floor tiles, pedestals, fence posts, cars, trees and grass tufts are all instanced.
- **Level of detail for racks.** Every rack is one instanced bevelled box painted with a texture of its front and rear. The racks nearest the camera, plus the selected one, swap to fully modelled racks. Models are cached per rack configuration, so swapping costs nothing.
- **Realistic rendering.** AgX filmic tone mapping, N8AO ambient occlusion, SMAA, bloom on emissive LEDs and screens, an HDR environment for reflections (CC0, bundled via `@pmndrs/assets`), a physical sky with clouds and matched haze, bevelled edges, physically plausible metal/dielectric materials, and a world-space procedural surface-detail shader (colour and roughness variation, fine relief, ground grime) that works on scaled primitives without UV stretching.
- **Static batching.** `StaticBatch` merges every static mesh in the site, building and interiors into one mesh per material. The campus view drops from about 1,480 to about 130 draw calls, and the X-ray interior from about 2,500 to about 230. The originals stay on a pick-only layer, so clicking, hover labels and outlines still work. Animated parts (fans, doors, trays, status lights) are excluded.
- **Loading screen.** Progress through engine download and asset loading, then `renderer.compileAsync` pre-compiles every shader before the scene is revealed, so the first interactions don't stutter.
- **Shadows on demand.** The shadow map re-renders only when the scene changes. Its frustum tightens around the building when you are inside, for sharper interior shadows.
- **GLTF-ready.** Equipment components are self-contained, so any of them can later be replaced by a `useGLTF` model (for example, assets authored in Blender) without touching the rest of the scene.

## Roadmap

- GLTF models for hero equipment (e.g. authored in Blender), loaded with `useGLTF` in place of the procedural versions
- Pre-compiling interior shaders in the background before the first X-ray view
- Mobile / touch controls
