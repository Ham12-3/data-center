# AI / Colocation Data Center Campus: Reference Sheet for the 3D Model

Compiled October 2026 from vendor datasheets, standards summaries and trade press. Where sources disagree, the range is given. Items marked **(est.)** are derived by calculation or from general practice, not taken from a datasheet.

Handy conversions: 1 RU = 44.45 mm; 1 refrigeration ton = 3.517 kW; water flow at ΔT 10 K ≈ 1.43 L/min per kW (PG25 ≈ 1.5–1.6); air flow at ΔT 12 K ≈ 250 m³/h per kW **(est.)**.

---

## 1. NVIDIA GB200 NVL72 rack (and GB300 NVL72)

**Dimensions and mass**
- Rack: **600 W × 1068 D × 2236 H mm**, 48 RU, NVIDIA MGX rack (Supermicro and ASUS datasheets). GIGABYTE lists 2299 mm high. HPE lists 2495 mm, which probably includes extra top hardware or casters.
- Weight: **~1.36 t (3,000 lb)** fully populated is the figure most often cited. HPE gives 3,245 lb (~1,472 kg) loaded.

**Power**
- **~120 kW** per rack (NVIDIA DGX docs). SemiAnalysis gives 123.6 kW including AC conversion losses. HPE gives 132 kW, split **115 kW liquid-cooled + 17 kW air-cooled**, so about 85–87 % of the heat goes to liquid.
- **6–8 power shelves**, each 1 RU and 33 kW, with six 5.5 kW PSUs per shelf (N+N). Output is ~50–54 V DC onto a **rear vertical busbar**.

**Tray layout, top to bottom** (GIGABYTE spec list and ServeTheHome teardown; no single NVIDIA drawing found)
1. 3 × 1U power shelves (4 in 8-shelf configurations), plus 1U management/ToR switches near the top
2. **10 × 1U compute trays**
3. **9 × 1U NVLink Switch trays** (in the middle of the rack)
4. **8 × 1U compute trays**
5. 3 × 1U power shelves (4 in 8-shelf configurations)

That is 18 compute trays + 9 switch trays = 27 RU of compute and switching. The remaining RU hold power, management and blanks. Some builds (e.g. Dell) also put an in-rack CDU at the bottom.

**What is in each tray**
- Compute tray (1U): 2 "Bianca" boards, each with 1 Grace CPU and 2 Blackwell GPUs. That gives **2 CPUs + 4 GPUs per tray**, and 36 CPUs + 72 GPUs per rack. Each tray also holds 4 × E1.S NVMe drives and 1 × M.2 boot drive.
- NVLink Switch tray (1U): 2 × NVSwitch ASICs (72 NVLink ports each), 57.6 Tb/s per tray. The rack NVLink domain is **130 TB/s**, or 1.8 TB/s per GPU.

**NVLink spine at the rear**
- **5,184 passive copper cables** (Jensen Huang's keynote rounded this to "5,000 cables, ~2 miles") sit in a vertical spine chassis at the rear. Trays blind-mate into it.
- GIGABYTE lists **4 × NVLink cable cartridges**.
- NVIDIA says using copper instead of optics saves ~20 kW per rack.

**Liquid cooling**
- Cold plates sit on the GPUs, CPUs and NVSwitches. NICs, SSDs and PSUs are cooled by fans.
- Coolant reaches each tray through **vertical supply and return manifolds at the rear** of the rack, with quick-disconnect couplings at every tray. Leak detection is built in at both tray and rack level.
- Coolant temperatures: **maximum inlet 45 °C, return up to 65 °C** (NVIDIA's Ian Buck; QCT). Typical facility TCS supply is 25–40 °C.
- Flow: **~80–130 L/min per rack**. Introl says 80, QCT says 110–130. A single cold plate takes about 1.8 L/min.

**Networking (GB200)**
- Each tray has **4 × ConnectX-7 400G** single-port OSFP NICs for the scale-out fabric, one per GPU (72 per rack).
- Each tray also has 2 × BlueField-3 DPUs (dual-port 400G) for storage and north-south traffic, plus 1 GbE BMC ports.
- The fabric can be InfiniBand (Quantum) or Ethernet (Spectrum-X).

**GB300 NVL72 (Blackwell Ultra)**
- Same 18 + 9 tray architecture. Each GPU (B300) has 288 GB of HBM3e.
- Each tray carries **4 × ConnectX-8 at 800G** plus BlueField-3.
- Power: NVIDIA says **up to 142 kW** (8 × 33 kW shelves). HPE gives 132 kW nominal TDP and ~155 kW peak, and recommends provisioning busway for 192 kW.
- Performance: 1.44 EF FP4.

Sources: https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html · https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/components.html · https://www.supermicro.com/manuals/brochure/Brochure-AI-SuperCluster-NVIDIA-GB200-NVL72.pdf · https://gigabyte.com/FileUpload/global/MicroSite/602/DLB2-CB1_datasheet_v1.0.pdf · https://www.hpe.com/us/en/collaterals/collateral.a50009224enw.html · https://newsletter.semianalysis.com/p/gb200-hardware-architecture-and-component · https://www.datacenterdynamics.com/en/news/nvidia-announces-liquid-cooled-gb200-nvl72-system-with-72-blackwell-gpus

---

## 2. Coolant Distribution Units (CDUs)

**The two loops**
- **FWS (facility water system)** is the primary loop. It carries water from the chillers, dry coolers or towers to the CDU's heat exchanger. ASHRAE's liquid-cooling classes describe it by maximum supply temperature: **W17, W27, W32, W40, W45, W+**.
- **TCS (technology cooling system)** is the secondary loop. It runs from the CDU to the rack manifolds and cold plates. It is a closed, finely filtered loop, typically PG25 or treated water. TCS supply temperature equals FWS supply plus the CDU approach (ATD), usually 3–5 K.

| Unit | Type | Capacity | Dimensions (H × W × D) | Notes |
|---|---|---|---|---|
| Vertiv CoolChip CDU 100 | In-rack, 4U | ~101 kW @ 4 °C ATD | 174 × 445 × 868 mm, 59 kg | Rack-mounted |
| Vertiv CoolChip CDU 600 | In-row | 600 kW @ 4 °C ATD | 2000 × 600 × 1200 mm | 50 µm filter, top or bottom pipe connections |
| Vertiv CoolChip CDU 2300 | In-row / plant | 2300 kW @ 4 °C ATD | 2400 × 1200 × 1200 mm | Redundant pumps, Modbus/BACnet, 0–40 °C ambient |
| CoolIT CHx2000 | In-row | 2000 kW @ 5 °C ATD | 750 × 1200 mm footprint | 2100 L/min primary, 1800 L/min secondary (PG25), 53 psi head, ~12 kW pump power |
| Motivair (Schneider) MCDU range | In-rack to row | 102 kW – 2.5 MW (MCDU-70) | n/a | MCDU-45/55 are built for utility corridors |

- HPE's GB300 reference uses a **1.3 MW in-row CDU for up to 8 racks**. CoolIT says its 2 MW CDU can serve about 12 × 120 kW NVL72 racks at ~1.2 L/min per kW.
- Placement options:
  - in-rack (4U, ~100 kW, one rack)
  - in-row (cabinet width, 0.6–2.3 MW, a row of racks)
  - in a "utility corridor" or gallery outside the white space

Sources: https://www.vertiv.com/en-us/products-catalog/thermal-management/high-density-solutions/vertiv-coolchip-cdu-2300/ · https://vertiv.com/en-us/products-catalog/thermal-management/high-density-solutions/vertiv-coolchip-cdu-100 · https://www.coolitsystems.com/cdu-product/chx2000/ · https://www.motivaircorp.com/uploads/files/brochures/CDU_Brochure_2023.pdf · https://www.upsite.com/blog/major-changes-to-ashraes-fifth-edition-of-thermal-guidelines-part-3-liquid-cooling-chapter-updates/

---

## 3. CRAH / CRAC units and fan walls

**Downflow CRAH (Vertiv Liebert CW181)**
- 181 kW, **2388 H × 3099 W × 1067 D mm**, 1,143 kg.
- EC plug fans that can be lowered into the raised floor, which needs a void of at least 610 mm. Large A-frame coil.
- Larger CW units with 3 EC fans reach ~59,500 m³/h.
- A CRAC has its own compressor (DX refrigerant). A CRAH uses chilled water only.

**Fan walls**: chilled-water coil walls in a corridor beside the hall, blowing horizontally into a slab-floor hall with no raised floor.
- Vertiv CoolLoop Thermal Wall CA60: **400 kW, 3050 W × 1524 D × 3665 H mm**, 4–6 fans, 20,000–60,000 m³/h.
- Vertiv CoolLoop Thermal Wall CA80: **500 kW**, 3960 mm wide, 8 fans, up to 90,000 m³/h.
- Stulz CyberWall: **220 kW per module** with 16 °C water inlet, 55,000 m³/h, about **100 kW per metre of wall**.
- Mitsubishi CVWALL: rated with 20/30 °C water and 37 °C return air.
- Typical fan-wall modules are 1.5–4 m wide, ~1.6 m deep and 1.75–4 m tall.

**Chilled-water temperatures**
- Legacy plants run 7/12 °C. Modern air-cooled halls run **~16–20 °C supply / 24–30 °C return**.

Sources: https://www.vertiv.com/en-in/products-catalog/thermal-management/room-cooling/cw181-181kw/ · https://www.vertiv.com/4add96/globalassets/documents/data-sheets/vertiv-coolloop-thermal-wall-ds-en-na-sl-70713-web.pdf · https://www.datacenterdynamics.com/en/product-news/stulz-launches-cyberwall-fan-wall-cooling-/

---

## 4. Chillers, cooling towers, dry and adiabatic coolers

**Air-cooled chillers** (typically on the roof or in a ground-level mechanical yard)
- Carrier AquaForce 30XF:
  - Capacity: **390–2100 kW**. Uses R-1234ze and variable-speed screw compressors.
  - Built-in hydronic free cooling. Restarts to 100 % load in under 3 minutes.
  - Size: **~2.24 m W × 2.5 m H × 12.7–15.1 m L**, with long rows of top-mounted axial condenser fans.
  - Frankfurt data center: 38 units, each about 1.8 MW on a 16.7 × 2.3 m footprint, with 16.6/24.4 °C water.
- Trane Sintesis eXcellent GVAF: **up to 2.5 MW** per unit. Runs at up to 54 °C ambient, with free cooling and fast restart.

**Water-cooled plant**
- Indoor centrifugal chillers, commonly **~1,000–3,000 tons (3.5–10.5 MW)** each **(est.)**, connected to rooftop or yard cooling towers.
- Marley NC crossflow tower cells range from **~120 to ~800 tons per cell**, with fans **2.1–3.7 m (7–12 ft)** across.
  - Example: a 284-ton cell is ~4.7 L × 2.4 W × 3.6 H m.

**Dry and adiabatic coolers** (common for liquid-cooled AI halls because they use little or no water)
- Güntner High Density adiabatic cooler: **590–3,370 kW**.
- Güntner V-shape VARIO: up to **2 × 12 EC fans**. The hydroBLU wetted pads switch on only above a set ambient temperature.
- BAC TrilliumSeries dry cooler: up to ~2.9 MW.
- BAC TRF adiabatic cooler: 350–1600 kW.
- A large BAC dry cooler is about 11.6 L × 3.5 W × 6.0 H m and ~22 t operating weight. The source table is compressed, so verify this.

**Free cooling and economizers**
- Raising chilled-water supply to **17–20 °C** greatly extends free-cooling hours. Airedale cites up to **95 % of the year** in London at 17/22 °C. Schneider claims ~40 % lower opex at 18–20 °C (vendor claim).
- Liquid-cooled TCS loops at W32–W40 can often be cooled by dry coolers alone, with no chillers.

Sources: https://www.carrier.com/us/en/commercial/chillers/30xf/technical-specifications/ · https://www.eurovent-certification.com/en/cms/news/free-cooling-solution-for-frankfurt-data-centre · https://www.datacenterdynamics.com/en/news/trane-launches-latest-chillers-in-sintesis-excellent-gvaf-line · https://guntner.com/en-us/products/dry-coolers/high-density-dc · https://baltimoreaircoil.com/products/dry-coolers · https://blog.se.com/datacenter/2016/08/17/water-temperatures-data-center-cooling/

---

## 5. Power chain

**From grid to rack**
1. Utility transmission at **115–345 kV**. A 400 MW campus typically needs multiple 230 or 345 kV feeds into an on-site HV substation.
2. HV/MV transformers step down to campus MV: **34.5 kV / 13.8 kV** in the US, or ~11/20/33 kV in Europe.
3. MV switchgear and ring.
4. **2.5–3 MVA pad-mount transformers** (34.5 kV to 480 V; ~3,600 A secondary at 3 MVA).
5. LV main switchgear with **ATS** or generator paralleling.
6. UPS.
7. PDUs and RPPs, or overhead busway, at **480/277 V (US) or 415/240 V**.
8. Rack power shelves.

Large transformers currently take **40–100+ weeks** to deliver.

**UPS**
- Vertiv Liebert EXL S1, 1000–1200 kVA/kW:
  - **2009 H × 2654 W × 914 D mm, 2,117 kg**.
  - Efficiency 97 % in double conversion, 99 % in Dynamic Online, >99 % in ECO mode.
- Schneider Galaxy VX: up to **1500 kW**, built from **250 kW power cabinets**, with up to 4 units in parallel.

**Batteries**
- Vertiv HPL P1 Li-ion cabinet:
  - **600 × 1100 × 2000 mm, 680 kg**, 51.2 kWh, 409 V DC.
  - Up to 8 cabinets per UPS.
- Schneider Li-ion rack: 650 W × 530 D × 2055 H mm, 510 kg.
- Li-ion vs. VRLA: Li-ion takes **40–70 % less floor space and is ~60 % lighter**, and lasts 10–15 years versus 3–5+ for VRLA. These are vendor figures.
- Typical design runtime is **~5 minutes at full load**, sometimes up to 10–15 minutes **(est., industry practice)**. Generators pick up the load within about 10–30 seconds, so the batteries only need to bridge that gap.

**Overhead busway**
- Starline T5 Track Busway: **250–1250 A**, 4-pole, 600 V (US) or 415 V.
- Tap-off plug-in units hold breakers, metering and drop cords. The same units fit every size.

**Redundancy**
- **N**: no spare.
- **N+1**: one spare module.
- **2N**: two fully independent A and B paths.
- **2(N+1)**: two paths, each with a spare module.
- **Distributed / block redundant**: for example "4-to-make-3" (4N/3) or a catcher-block design, common in hyperscale.

**Uptime Institute Tiers**

| Tier | Description | Availability |
|---|---|---|
| I | Basic capacity, N, single path | 99.671 % |
| II | Redundant components, N+1 | 99.741 % |
| III | Concurrently maintainable, N+1 with multiple paths | 99.982 % |
| IV | Fault tolerant, typically 2N or 2(N+1) | 99.995 % (one source misprints this as 99.95 %) |

Uptime's current Tier standard no longer centres on these percentages, but they are still widely quoted.

Sources: https://www.vertiv.com/en-emea/products-catalog/critical-power/uninterruptible-power-supplies-ups/liebert-exl-s1-1000-1200kvakw/ · https://download.schneider-electric.com/doc/GVX1250I-O_Brochure_EN/998-22339634_Galaxy%20VX_GMA_Brochure.pdf · https://www.vertiv.com/49fbc2/globalassets/shared/vertiv-hpl-p1-lithium-ion-battery-energy-storage-system-data-sheet-en-mka4l0ukhplp1lib.pdf · https://starlinepower.com/de/node/844 · https://www.truelook.com/blog/data-center-substation-design · https://www.datacentres.com/guides/data-centre-tiers-explained

---

## 6. Diesel generators

**Caterpillar 3516C (60 Hz)**
- Ratings: **2500 / 2250 / 2000 ekW standby**. Accepts 100 % load in one step (ISO 8528-5).
- 2000 ekW open set:
  - **6761 L × 2339 W × 2997 H mm, 16,275 kg dry**.
  - Fuel at 100 % / 75 % / 50 % load: **506 / 394 / 284 L/h**.
  - Exhaust: ~400 °C, 433 m³/min.
- 2500 ekW set: about **620–650 L/h** at full load **(est., scaled from the 2000 ekW figures)**.
- The reseller spec sheet's larger configuration is ~7.2–7.5 m × 2.4–2.6 m × 3.0 m.

**Cummins C3000 D6e (QSK95)**
- Ratings: **3000 kWe standby / 2750 prime / 2500 continuous**.
- Enclosed unit, shipping size from a dealer listing: **~15.1 L × 4.6 W × 4.1 H m, ~31.8 t**.
- Typical campus layout: rows of weatherproof, sound-attenuated enclosures sized like 40 ft containers or larger, sitting on sub-base ("belly") fuel tanks, each with a vertical exhaust stack and silencer. Stack height is set by air-permit dispersion modelling.

**Start time**
- **NFPA 110 Type 10** means power restored within **10 seconds**. Level 1 applies where failure endangers life. Data centers are often legally "optional standby" but are still designed to Type 10.

**Fuel**
- Common specifications are **24–48 hours** at full load. NFPA 110 Class X (96 hours) applies to Level 1 systems in seismic categories C–F.
- At 2.5 MW, 24 hours of fuel is about **15–16 m³** **(est.)**. Belly tanks often hold 12–24 hours; bulk tanks plus refuelling contracts cover the rest.

**HVO renewable diesel**
- A drop-in replacement for diesel. Vantage, Kao Data, Verne and AWS have adopted it.
- Vendors claim up to ~90 % lower lifecycle CO₂.
- It is expensive: about 95 % more than diesel in Northern Virginia.

Sources: https://www.cat.com/en_US/products/new/power-systems/electric-power/diesel-generator-sets/1000028912.html · https://penncatenergy.com/wp-content/uploads/2025/12/3516C-60-Hz-1650-2000-ekW-Spec-Sheet.pdf · https://www.cummins.com/en-na/generators/products/c3000d6e · https://www.csemag.com/complying-with-nfpa-110-in-mission-critical-facilities/ · https://www.datacenterfrontier.com/energy/article/33011772/vantage-data-centers-expands-rollout-of-hvo-renewable-diesel-fuel-for-generators

---

## 7. Fire safety

**VESDA aspirating smoke detection**
- Xtralis VESDA-E VEP: sensitivity **0.005–20 % obs/m**, up to 40 Class A sampling holes.
- Coverage: 1,000 m² with one pipe, 2,000 m² with four pipes.
- Has four alarm thresholds: Alert, Action, Fire 1 and Fire 2.
- Sampling pipes run at ceiling level and also in the hot-aisle containment and the return air path.

**Clean agents**
- **Halocarbons** (FM-200 / HFC-227ea, FK-5-1-12 / "Novec 1230") must deliver 95 % of design concentration in **≤10 s**.
  - FK-5-1-12 cylinders: 22–180 L at 25 bar, 40–180 L at 50 bar (34.5 and 42 bar versions also exist).
- **Inert gases** (IG-541 = 52 % N₂, 40 % Ar, 8 % CO₂; also IG-55 and IG-100) discharge over **60 s**. NFPA 2001 (2012 edition onward) allows **up to 120 s** for Class A hazards; secondary sources disagree on whether this extends to Class C.
  - IG-541 cylinders: **80 L or 140 L at 200 or 300 bar**, in large manifolded banks.
  - Design concentration includes a safety factor of at least 1.2.
- Agent availability:
  - 3M stopped making Novec 1230 at the end of 2025 as part of its PFAS exit. Other makers still sell FK-5-1-12, e.g. Fike SF1230.
  - FM-200 supply is shrinking under the AIM Act HFC phase-down, which runs to 2036.

**Pre-action sprinklers**
- **Double interlock**: water enters the dry pipes only after **both** a detection signal and a sprinkler head opening, which drops the supervisory air at 10–20 psi.
- Some authorities allow only single interlock in server rooms, e.g. San Francisco FD, citing NFPA 13 (2022).

Sources: https://eurofyre.co.uk/?p=461 · https://kidde-fenwal.com/Media/Data%20Sheets/Kidde_Natura_Inert_Gas_System_IG-541_Agent_Cylinder_Assembly_K-38-2015.pdf · https://digital.wpi.edu/show/x059cb425 · https://www.fike.com/knowledge-center/3m-novec-1230-discontinued-what-now/ · https://www.sf-fire.org/421-single-and-double-interlock-pre-action-systems

---

## 8. Network

**Meet-Me Room (MMR)**
- A secured, carrier-neutral room where carriers terminate their fibre. Tenants order **cross-connects**, structured single-mode patches from the MMR to their cage.
- Best practice is **≥2, ideally 3, physically diverse fibre entry points** and vaults, each feeding a separate MMR path.
- Interconnection density can be enormous: Equinix reportedly runs ~480,000 cross-connects.

**AI fabric**
- Leaf-spine or fat-tree topology, usually rail-optimised, with one 400–800G NIC port per GPU.
- NVIDIA Spectrum-X **SN5600**: **2U, 64 × 800GbE OSFP, 51.2 Tb/s**.
- NVIDIA Quantum-X800 **Q3400-RA** (XDR InfiniBand): **4U, 144 × 800G ports** on 72 OSFP cages, 115.2 Tb/s. A two-level fat tree of these switches connects **up to 10,368 NICs**.
- Border and edge routers, plus DCI optics (e.g. 400G ZR/ZR+ coherent), connect the fabric to carriers and other campuses.

**Latency**
- Light in fibre takes **~5 µs per km**, so ~1 ms round trip per 100 km of route.
- Real routes are longer than the straight-line distance, and risers and cross-connects add more.
- Legacy SLA references assume 10–20 µs of switching delay per hop; modern data center switches are far faster.

Sources: https://phoenixnap.com/blog/what-is-a-meet-me-room · https://www.datacentres.com/news/the-density-premium-why-480-000-cross-connects-make-equinix-worth-more-than-its--slot3-2026-08-29 · https://docs.nvidia.com/networking/display/XDRSwitchesUM/Introduction · https://avendor.com/products/nvidia-spectrum-sn5600-ethernet-switch · https://en.wikipedia.org/wiki/Latency_(engineering)

---

## 9. Physical security layers (outside in)

1. **Perimeter**:
   - **2.4–3.0 m (8–10 ft) anti-climb fence** with intrusion sensors.
   - Crash-rated bollards and gates. **ASTM F2656 M50 = DoS K12** (a 15,000 lb truck at 50 mph). M40 = K8 and M30 = K4. **P1** means the truck penetrates ≤1 m past the barrier.
2. **Site**:
   - Vehicle sally port (one gate must close before the next opens).
   - Guardhouse, controlled parking, CCTV with analytics, lighting.
3. **Building**:
   - One or two staffed entrances with **24/7 guards**, visitor ID and badge issue.
4. **Data hall**:
   - **Mantraps** (interlocked two-door portals that admit one person, with tailgating sensors).
   - **Biometric** multi-factor access (card + fingerprint, palm vein or iris).
5. **Colocation space**:
   - Locked cages (mesh, sometimes slab to slab), locked cabinets, per-rack access logs.
6. **CCTV retention**:
   - **30–90 days**. PCI DSS commonly requires 90 days.

Sources: https://www.datacentres.com/guides/data-centre-security-standards · https://deltascientific.com/2026/02/24/astm-f2656-explained · https://open-exam-prep.com/study-guides/exin-cdcp/fire-protection-physical-security/layered-physical-security-access-control

---

## 10. Facility level

**PUE**
- Uptime Institute 2024 survey: **1.56** industry average, flat for five years (1.58 in 2023). The capacity-weighted figure is **1.47**.
- Google fleet: **1.09** trailing twelve months, 2024. AWS: 1.15 (2023). Meta: ~1.08.
- New liquid-cooled AI builds target **~1.1–1.25** **(est.)**.

**Rack density**
- Uptime 2024: the average is still **below 8 kW**, the most common band is **7–9 kW**, and most operators have **no racks above 30 kW**.
- Air-cooled halls are typically designed for 5–15 kW per rack, rising to 30–40 kW with containment or rear-door heat exchangers.
- AI racks draw **120–142 kW** (GB200 and GB300 NVL72), and roadmaps go higher.

**ASHRAE thermal envelope (TC 9.9, 5th edition)**
- **Recommended inlet air 18–27 °C**, with upper limits of ~15 °C dew point and 70 % RH.
- Class A1 allowable: 15–32 °C, 20–80 % RH.
- A new class, H1, covers high-density equipment and has a narrower recommended range.

**Containment**
- Cold-aisle or hot-aisle containment with doors and roof panels.
- Hot-aisle containment with ducted ceiling return is common alongside fan walls.

**Floors**
- Raised floors are **300–900 mm** (12–36 in) with **600 × 600 mm** tiles.
- Hyperscale and AI halls increasingly use **slab floors**: cheaper, better for heavy 1.4 t racks and seismic loads. Power and cooling then come overhead (busway, cable tray and liquid manifolds), or through a pipe gallery for TCS loops.

**Halls and buildings**
- Typical data halls are **~1,000–1,500 m² at 4–10 MW**.
  - ATL4: two-storey, 10 halls × ~1,490 m², 4 MW each.
  - DFW9: two-storey, ~18,600 m², 60 MW.
  - Project Zeus: 4 × 7 MW halls per building.
- Storey heights:
  - Multi-storey: about **6 m floor to floor (~5.5 m clear)**, with a taller ~8 m ground floor.
  - Single-storey: up to ~7.3 m clear.
  - Overall building height: roughly **12–15 m** single-storey and **18–25 m** two-storey including the roof screen **(est.)**.

**Roof and yard (typical modern campus)**
- **Rooftop**: rows of air-cooled chillers or adiabatic dry coolers behind acoustic and visual screens, plus AHU and makeup-air units, exhaust fans, generator flues (if gensets are rooftop or close by), lightning protection and roof walkways.
- **At grade**: generator yard (one genset per 2–3 MW block plus N+1 redundant units), bulk fuel tanks, MV transformers and switchgear, the HV substation and a cooling-tower yard if water-cooled.

Sources: https://www.datacenterknowledge.com/energy-power-supply/data-center-industry-survey-highlights-cost-ai-and-sustainability-challenges · https://intelligence.uptimeinstitute.com/resource/uptime-institute-global-data-center-survey-2024 · https://www.datacenters.google/efficiency · https://www.upsite.com/blog/what-you-need-to-know-about-ashraes-fifth-edition-of-thermal-guidelines/ · https://www.upsite.com/?p=3013 · https://www.brasfieldgorrie.com/projects/atl4/ · https://assets.sttelemediagdc.com/sttgdc/global_en/public/2024-02/Noida_DC_1_2.pdf

---

### Known discrepancies / verify before modelling to the millimetre
- GB200 rack height: 2236 mm (Supermicro, ASUS, MGX) vs. 2299 mm (GIGABYTE) vs. 2495 mm (HPE).
- GB200 rack power: 120 kW (NVIDIA) vs. 123.6 kW (SemiAnalysis) vs. 132 kW (HPE).
- GB200 power shelves: 6 vs. 8.
- GB200 coolant flow: 80 vs. 130 L/min.
- Exact tray order is inferred from the GIGABYTE spec list and teardown photos, not from an official NVIDIA drawing.
- NFPA 2001 inert-gas 120 s allowance: confirmed for Class A; unclear for Class C.
- Cat 3516C 2500 ekW fuel burn is extrapolated. The Cummins C3000 D6e dimensions are shipping figures from a dealer listing.
