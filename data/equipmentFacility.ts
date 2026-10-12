import type { EquipmentInfo, EquipmentTypeId } from "@/types/equipment";

/** Rack-level entries live in data/equipment.ts; everything else is here. */
export type RackEntryId = "rack" | "server-1u" | "server-2u" | "tor-switch" | "patch-panel" | "rack-pdu" | "blanking-panel";

type Entry = Omit<EquipmentInfo, "id">;

/**
 * Educational content for the facility: GPU systems, network, power chain,
 * cooling, fire safety, operations, security and site. Figures come from
 * vendor datasheets and industry surveys; see docs/research.md for sources
 * and the ranges where sources disagree.
 */
const ENTRIES: Record<Exclude<EquipmentTypeId, RackEntryId>, Entry> = {
  // -------------------------------------------------------------------------
  // AI / GPU systems
  // -------------------------------------------------------------------------
  "gpu-rack": {
    name: "GPU Rack (NVIDIA GB200 NVL72 class)",
    category: "compute",
    shortDescription:
      "A single rack that works like one giant AI computer: 72 GPUs wired together so they can share work as if they were one chip. It is so powerful it has to be cooled with liquid.",
    technicalDetails:
      "An NVL72 rack holds 18 one-unit compute trays (each with 2 Grace CPUs and 4 Blackwell GPUs) and 9 NVLink switch trays in a 48U MGX frame. At the rear, a spine of about 5,000 passive copper cables connects every GPU to every other GPU at 1.8 TB/s each (130 TB/s for the rack), so the 72 GPUs act as one NVLink domain for training and inference. Power shelves (33 kW each) convert AC to ~50 V DC onto a rear busbar. Around 85% of the heat is removed by liquid: cold plates on the GPUs, CPUs and switches are fed from blue supply and red return manifolds with a quick-disconnect hose to every tray. For scale-out, each GPU also has its own 400G (ConnectX-7) or 800G (ConnectX-8) network port.",
    typicalSpecs: [
      { label: "GPUs / CPUs", value: "72 Blackwell GPUs, 36 Grace CPUs" },
      { label: "Dimensions", value: "600 W x 1068 D x 2236 H mm (48U)" },
      { label: "Weight", value: "≈1.36-1.47 t" },
      { label: "Power", value: "≈120-132 kW (GB300: up to ~142 kW)" },
      { label: "Cooling", value: "≈85% liquid (cold plates), ≈15% air" },
      { label: "Coolant", value: "inlet ≤45 °C, ≈80-130 L/min per rack" },
      { label: "NVLink bandwidth", value: "130 TB/s per rack" },
    ],
    connectsTo: ["gpu-compute-tray", "nvlink-switch-tray", "power-shelf", "cdu", "busway", "spine-switch"],
    funFact:
      "NVIDIA chose copper instead of optics for the NVLink spine, which saves roughly 20 kW of transceiver power per rack. That is about as much as two average enterprise racks consume.",
  },
  "gpu-compute-tray": {
    name: "GPU Compute Tray",
    category: "compute",
    shortDescription: "A thin tray holding 4 GPUs and 2 CPUs on liquid-cooled cold plates. 18 of them make up one NVL72 rack.",
    technicalDetails:
      "Each 1U tray carries two 'Bianca' boards, each pairing one Grace CPU with two Blackwell GPUs over a 900 GB/s chip-to-chip link. Cold plates sit directly on the processors; coolant enters and leaves through blind-mate quick disconnects at the rear, so a tray can be pulled for service without draining the rack. The front carries the scale-out NICs (one 400G port per GPU), BlueField-3 DPUs for storage and north-south traffic, E1.S NVMe drives and the BMC port.",
    typicalSpecs: [
      { label: "Processors", value: "4 Blackwell GPUs + 2 Grace CPUs" },
      { label: "GPU memory", value: "192 GB HBM3e per GPU (GB300: 288 GB)" },
      { label: "Network", value: "4 x 400G ConnectX-7 + 2 x BlueField-3" },
      { label: "Storage", value: "4 x E1.S NVMe + M.2 boot" },
      { label: "Cooling", value: "Cold plates + quick disconnects" },
    ],
    connectsTo: ["gpu-rack", "nvlink-switch-tray", "power-shelf", "cdu"],
  },
  "gpu-chip": {
    name: "NVIDIA Blackwell GPU (B200)",
    category: "compute",
    shortDescription: "The chip that does the AI maths: two huge silicon dies joined into one GPU, surrounded by stacks of ultra-fast memory.",
    technicalDetails:
      "Each Blackwell GPU packages two reticle-sized dies (208 billion transistors in total) joined by a 10 TB/s chip-to-chip link so software sees a single GPU. Eight stacks of HBM3e memory sit beside the dies on the same package: 192 GB at about 8 TB/s (288 GB in Blackwell Ultra / GB300). It connects to its Grace CPU over NVLink-C2C (900 GB/s) and to the other 71 GPUs in the rack through NVLink 5 at 1.8 TB/s. At around 1,000-1,200 W per GPU, air cannot carry the heat away fast enough, so a liquid cold plate sits directly on top.",
    typicalSpecs: [
      { label: "Transistors", value: "208 billion (2 dies)" },
      { label: "Memory", value: "192 GB HBM3e, ≈8 TB/s" },
      { label: "NVLink 5", value: "1.8 TB/s per GPU" },
      { label: "Power", value: "≈1.0-1.2 kW" },
      { label: "Cooling", value: "Direct-to-chip liquid cold plate" },
    ],
    connectsTo: ["grace-cpu", "cold-plate", "nvlink-switch-tray", "nic-card"],
    funFact: "One GB200 NVL72 rack's 72 GPUs together hold about 13.8 TB of HBM: enough fast memory to keep trillion-parameter models resident.",
  },
  "grace-cpu": {
    name: "NVIDIA Grace CPU",
    category: "compute",
    shortDescription: "The general-purpose processor paired with each pair of GPUs. It runs the operating system and feeds the GPUs with data.",
    technicalDetails:
      "Grace is a 72-core Arm Neoverse V2 CPU with up to 480 GB of LPDDR5X memory soldered around the package (≈500 GB/s). In a GB200 superchip one Grace connects to two Blackwell GPUs over coherent NVLink-C2C at 900 GB/s, so the GPUs can use the CPU's memory almost like their own. LPDDR5X uses far less power than DDR5 DIMMs, which matters when every watt has to be cooled.",
    typicalSpecs: [
      { label: "Cores", value: "72 Arm Neoverse V2" },
      { label: "Memory", value: "Up to 480 GB LPDDR5X, ≈500 GB/s" },
      { label: "CPU-GPU link", value: "NVLink-C2C, 900 GB/s" },
      { label: "Cooling", value: "Liquid cold plate" },
    ],
    connectsTo: ["gpu-chip", "cold-plate", "nic-card"],
  },
  "cold-plate": {
    name: "Liquid Cold Plate",
    category: "cooling",
    shortDescription: "A copper block with tiny internal channels that sits on a chip. Coolant flowing through it carries the heat away, far better than air.",
    technicalDetails:
      "Direct-to-chip cooling clamps a nickel-plated copper plate with micro-channels (fins a fraction of a millimetre wide) onto each GPU, CPU and NVSwitch through a thin thermal interface material. Coolant from the rack manifold, typically water with propylene glycol at up to ~45 °C inlet, flows through the CPU plate and then the GPU plates in series and returns about 10-15 °C warmer. Water carries roughly 3,500 times more heat per unit volume than air, which is what makes 120+ kW racks possible. Warm-water cooling also allows dry coolers instead of chillers.",
    typicalSpecs: [
      { label: "Material", value: "Nickel-plated copper, micro-channel" },
      { label: "Coolant inlet", value: "Up to ≈45 °C (PG25 / treated water)" },
      { label: "Flow", value: "≈1-2 L/min per plate" },
      { label: "Heat removed", value: "≈85% of the tray's heat" },
    ],
    connectsTo: ["gpu-chip", "grace-cpu", "quick-disconnect", "cdu"],
  },
  "quick-disconnect": {
    name: "Quick-Disconnect Coupling",
    category: "cooling",
    shortDescription: "A self-sealing coolant connector. When a tray slides out, both halves close instantly so not a drop of liquid escapes.",
    technicalDetails:
      "Blind-mate, dry-break couplings (UQD / UQDB per the OCP specification) join each tray to the rack's supply and return manifolds. Spring-loaded flat-face valves in both halves close before the seals separate, so disconnecting spills only a few microlitres and introduces no air. Because they blind-mate at the rear, a technician simply slides a tray out: coolant, NVLink and power all disconnect together, and they reconnect the same way on reinsertion. Leak sensors in the tray and rack watch for any drips.",
    typicalSpecs: [
      { label: "Type", value: "Blind-mate, dry-break (OCP UQD/UQDB)" },
      { label: "Spill on disconnect", value: "< 0.1 mL" },
      { label: "Hot-swappable", value: "Yes, with the loop running" },
    ],
    connectsTo: ["cold-plate", "gpu-rack", "cdu"],
  },
  "nic-card": {
    name: "ConnectX-7 NIC / BlueField-3 DPU",
    category: "network",
    shortDescription: "Network cards that connect each GPU to the rest of the AI cluster and the tray to storage and the outside world.",
    technicalDetails:
      "Each compute tray carries four ConnectX-7 400 Gb/s NICs, one per GPU, for the scale-out fabric (InfiniBand or Spectrum-X Ethernet) that links many NVL72 racks into one training cluster, using GPUDirect RDMA so data moves GPU-to-GPU without touching the CPU. Two BlueField-3 DPUs handle storage, security and north-south traffic in hardware, offloading the CPUs. GB300 trays move to 800 Gb/s ConnectX-8.",
    typicalSpecs: [
      { label: "Scale-out", value: "4 × 400G ConnectX-7 (1 per GPU)" },
      { label: "DPU", value: "2 × BlueField-3 (dual-port 400G)" },
      { label: "Feature", value: "GPUDirect RDMA" },
    ],
    connectsTo: ["gpu-chip", "spine-switch", "tor-switch"],
  },
  "nvlink-switch-tray": {
    name: "NVLink Switch Tray",
    category: "network",
    shortDescription: "The tray that lets all 72 GPUs talk to each other directly at enormous speed, as if they were one big GPU.",
    technicalDetails:
      "Each 1U tray holds two NVSwitch chips with 72 NVLink ports each, 57.6 Tb/s per tray. Nine trays sit in the middle of the rack, between the compute trays, keeping copper runs short. Their ports blind-mate into the rear NVLink spine cartridges. This is the 'scale-up' network: unlike Ethernet or InfiniBand, it gives every GPU memory-semantic access to every other GPU's memory.",
    typicalSpecs: [
      { label: "Switch chips", value: "2 x NVSwitch" },
      { label: "Bandwidth", value: "57.6 Tb/s per tray" },
      { label: "Per-GPU NVLink", value: "1.8 TB/s" },
      { label: "Cooling", value: "Liquid (cold plates)" },
    ],
    connectsTo: ["gpu-compute-tray", "gpu-rack"],
  },
  "power-shelf": {
    name: "Rack Power Shelf",
    category: "power",
    shortDescription: "Converts the facility's AC power into the low-voltage DC the GPU trays use, through a shared busbar at the back of the rack.",
    technicalDetails:
      "Each 1U shelf holds six hot-swap 5.5 kW power supplies (33 kW per shelf) configured N+N, so half can fail without dropping the load. A GB200 rack uses 6-8 shelves split between the top and bottom of the rack, feeding a vertical ~50 V DC busbar that every tray plugs into. Each shelf's AC inputs come from the A or B busway, preserving the facility's dual power paths all the way into the rack.",
    typicalSpecs: [
      { label: "Capacity", value: "33 kW per shelf (6 x 5.5 kW PSUs)" },
      { label: "Output", value: "≈48-54 V DC to busbar" },
      { label: "Redundancy", value: "N+N PSUs, A/B AC feeds" },
    ],
    connectsTo: ["gpu-rack", "busway"],
  },
  "network-rack": {
    name: "Network Rack",
    category: "network",
    shortDescription: "A rack full of high-speed switches, routers and patch panels instead of servers: the junction box of the data centre's network.",
    technicalDetails:
      "Network racks in the core (the Main Distribution Area in TIA-942 terms) house spine switches, border routers and dense fibre patching. Every leaf switch in the halls has an uplink to every spine switch, so the core carries the east-west traffic between racks while the border routers handle north-south traffic to the internet and carriers. Network racks are usually 750-800 mm wide to leave room for vertical cable management.",
    typicalSpecs: [
      { label: "Contents", value: "Spine switches, routers, fibre patching" },
      { label: "Power", value: "≈3-10 kW" },
      { label: "Cabling", value: "Hundreds of single-mode fibre pairs" },
    ],
    connectsTo: ["spine-switch", "border-router", "patch-panel", "cross-connect"],
  },
  "spine-switch": {
    name: "Spine Switch",
    category: "network",
    shortDescription: "A very fast switch in the network core. Every top-of-rack switch connects up to every spine, so any two servers are always just a few hops apart.",
    technicalDetails:
      "In a leaf-spine (Clos) fabric every leaf has one uplink to every spine. Traffic between any two racks therefore crosses exactly one spine, latency is predictable, and capacity grows by adding spines. A modern spine such as NVIDIA Spectrum-X SN5600 offers 64 x 800 GbE OSFP ports (51.2 Tb/s) in 2U; AI fabrics use rail-optimised designs with one 400-800G NIC port per GPU. Equal-cost multi-path (ECMP) routing spreads flows across all spines, so losing one spine only reduces capacity slightly.",
    typicalSpecs: [
      { label: "Ports", value: "64 x 800G OSFP (51.2 Tb/s)" },
      { label: "Height", value: "2U" },
      { label: "Latency", value: "≈0.5-1 µs" },
      { label: "Power", value: "≈1-2 kW" },
    ],
    connectsTo: ["tor-switch", "border-router", "network-rack"],
  },
  "border-router": {
    name: "Border Router",
    category: "network",
    shortDescription: "The gateway between the data centre and the outside world. It exchanges routes with internet providers and carriers.",
    technicalDetails:
      "Border (edge) routers run BGP with carriers, internet exchanges and cloud on-ramps reached through cross-connects in the Meet-Me Room. They hold full internet routing tables (around a million IPv4 routes), apply filtering and DDoS protection, and connect via coherent optics (e.g. 400G ZR/ZR+) to other campuses. They are deployed in pairs on diverse fibre paths so a router or fibre failure only reroutes traffic.",
    typicalSpecs: [
      { label: "Interfaces", value: "Line cards of 100/400G QSFP-DD" },
      { label: "Protocol", value: "BGP with carriers and exchanges" },
      { label: "Redundancy", value: "Pairs on diverse paths" },
    ],
    connectsTo: ["spine-switch", "cross-connect", "carrier-cage"],
  },

  // -------------------------------------------------------------------------
  // Network infrastructure
  // -------------------------------------------------------------------------
  "carrier-cage": {
    name: "Carrier Cage",
    category: "network",
    shortDescription: "A locked mesh enclosure where a telecom carrier keeps its own equipment inside the data centre.",
    technicalDetails:
      "Carriers (long-haul, metro, subsea backhaul) and cloud on-ramps install their transmission gear in secured cages in or beside the Meet-Me Room. A carrier-neutral facility hosts many of them, which is valuable to customers: any tenant can buy a cross-connect to any carrier in minutes instead of waiting months for new fibre to be built.",
    typicalSpecs: [
      { label: "Construction", value: "Welded wire mesh, locked gate" },
      { label: "Contents", value: "Carrier DWDM and routing gear" },
      { label: "Access", value: "Carrier staff only, logged" },
    ],
    connectsTo: ["cross-connect", "fiber-entry", "border-router"],
  },
  "cross-connect": {
    name: "Cross-Connect Frame (ODF)",
    category: "network",
    shortDescription: "Rows of fibre ports where a short patch cord joins a carrier to a customer. That cord is the 'cross-connect' customers pay for.",
    technicalDetails:
      "Optical distribution frames terminate structured single-mode cabling from every carrier cage and every customer space. Connecting two parties is just a patch between two ports, documented in the facility's cable management system. Large interconnection hubs operate hundreds of thousands of cross-connects; Equinix reportedly runs about 480,000. Low insertion loss and clean connectors matter, because every mated pair adds ~0.2-0.5 dB to the link budget.",
    typicalSpecs: [
      { label: "Media", value: "Single-mode OS2, LC / MPO" },
      { label: "Loss", value: "≈0.2-0.5 dB per mated pair" },
      { label: "Lead time", value: "Hours to days for a new link" },
    ],
    connectsTo: ["carrier-cage", "border-router", "patch-panel"],
  },
  "fiber-entry": {
    name: "Diverse Fibre Entry",
    category: "network",
    shortDescription: "Underground ducts where carrier fibre enters the building. There are two, on different sides, so one digger can't cut off the whole site.",
    technicalDetails:
      "Outside-plant fibre arrives in conduits through handholes or vaults and terminates in entrance cabinets. Best practice is at least two, ideally three, physically diverse entry points with separate routes all the way back to different carrier exchanges. If a fibre is cut on one path, routing protocols and optical protection move traffic to the other within milliseconds to seconds.",
    typicalSpecs: [
      { label: "Entries", value: "2 (north and west), diverse routes" },
      { label: "Conduit", value: "HDPE ducts, typically 3-4 per route" },
      { label: "Failover", value: "Sub-second (protection) to seconds (BGP)" },
    ],
    connectsTo: ["carrier-cage", "cross-connect"],
    funFact: "Accidental cable cuts by construction work are one of the most common causes of network outages, which is why serious sites insist on path diversity.",
  },
  "cable-tray": {
    name: "Overhead Cable Trays",
    category: "network",
    shortDescription: "Raceways above the racks that carry thousands of cables: yellow channels for fibre, wire baskets for copper.",
    technicalDetails:
      "Overhead pathways keep cables out of the cooling airflow and make changes easy. Fibre runs in enclosed yellow raceways with controlled bend radius (to avoid signal loss); copper runs in open wire baskets; power runs separately on busway. Separating power and data avoids electromagnetic interference and makes fault-finding simpler. Everything hangs from threaded rods anchored to the structure above.",
    typicalSpecs: [
      { label: "Fibre", value: "Yellow raceway, bend radius controlled" },
      { label: "Copper", value: "Galvanised wire basket" },
      { label: "Support", value: "Threaded rods every ~1.5-2.5 m" },
    ],
    connectsTo: ["tor-switch", "spine-switch", "patch-panel"],
  },

  // -------------------------------------------------------------------------
  // Power chain
  // -------------------------------------------------------------------------
  "power-line": {
    name: "High-Voltage Power Line",
    category: "power",
    shortDescription: "The overhead line bringing electricity from the national grid to the site, at 132,000 volts.",
    technicalDetails:
      "Large data centres connect to the transmission grid at 115-345 kV (here 132 kV) because the distribution network cannot carry tens of megawatts. High voltage keeps current, and therefore losses, low. Ideally a campus has two feeds from different grid substations, so a fault on one line does not take the site down. Grid connection capacity has become one of the biggest constraints on building new data centres.",
    typicalSpecs: [
      { label: "Voltage", value: "132 kV (typical range 115-345 kV)" },
      { label: "Circuits", value: "Double-circuit lattice towers" },
      { label: "Capacity", value: "Tens to hundreds of MW" },
    ],
    connectsTo: ["substation"],
  },
  substation: {
    name: "Utility Substation",
    category: "power",
    shortDescription: "Where grid power arrives and is stepped down from transmission voltage to a level the site can distribute.",
    technicalDetails:
      "The switchyard terminates the incoming lines on steel gantries, then circuit breakers and disconnectors protect and isolate large power transformers that step 132 kV down to 33 kV (or 11-34.5 kV). A control house holds protection relays and SCADA. Underground medium-voltage cables then run to transformers beside the building. Large transformers currently take 40-100+ weeks to deliver, so they are ordered early.",
    typicalSpecs: [
      { label: "Transformation", value: "132 kV → 33 kV" },
      { label: "Transformers", value: "2 x 60-90 MVA (N+1)" },
      { label: "Protection", value: "SF6 / vacuum breakers, relays, SCADA" },
    ],
    connectsTo: ["power-line", "transformer"],
  },
  transformer: {
    name: "Transformer",
    category: "power",
    shortDescription: "Changes electricity from one voltage to another. Big ones at the substation, smaller ones right next to the building.",
    technicalDetails:
      "Power transformers at the substation step 132 kV down to 33 kV. Pad-mounted MV/LV transformers beside the building (typically 2.5-3 MVA each) step that down to 400-480 V for the switchboards; a 3 MVA unit delivers about 3,600 A on the secondary side. Oil-filled units shed heat through radiator fins. Each electrical room is fed by its own transformers, keeping the A and B power paths separate from the grid onwards.",
    typicalSpecs: [
      { label: "Pad-mount rating", value: "2.5-3 MVA, 33 kV → 400/480 V" },
      { label: "Efficiency", value: ">99%" },
      { label: "Cooling", value: "Oil-natural, air-natural (ONAN)" },
    ],
    connectsTo: ["substation", "switchgear"],
  },
  switchgear: {
    name: "Main Switchboard (Switchgear)",
    category: "power",
    shortDescription: "A long row of cabinets full of giant circuit breakers that send power where it needs to go and cut it off instantly if something goes wrong.",
    technicalDetails:
      "The low-voltage main switchboard receives power from the transformer and from the generator (through the ATS), then distributes it through feeder breakers to the UPS systems and to mechanical loads such as chillers and pumps. Air circuit breakers rated for thousands of amps protect against short circuits; a mimic diagram on the doors shows how the busbars connect. Separate A and B switchboards in separate rooms mean one fire or fault cannot take down both paths.",
    typicalSpecs: [
      { label: "Voltage", value: "400-480 V, 3-phase" },
      { label: "Busbar rating", value: "3,200-6,300 A" },
      { label: "Breakers", value: "Air circuit breakers, draw-out" },
    ],
    connectsTo: ["transformer", "ats", "ups", "chiller"],
  },
  ats: {
    name: "Automatic Transfer Switch (ATS)",
    category: "power",
    shortDescription: "The 'brain' that notices when grid power fails, starts the generators and switches the building over to them.",
    technicalDetails:
      "The ATS continuously monitors utility voltage and frequency. On a failure it signals the generators to start, waits for them to reach stable voltage and frequency, then transfers the load. NFPA 110 Type 10 requires this within 10 seconds. During that gap the UPS batteries carry the IT load, so servers never notice. When the grid returns and stays stable (typically for several minutes), the ATS transfers back and the generators cool down and stop.",
    typicalSpecs: [
      { label: "Transfer time", value: "≤10 s to generator (NFPA 110 Type 10)" },
      { label: "Rating", value: "2,000-4,000 A" },
      { label: "Modes", value: "Open or closed transition" },
    ],
    connectsTo: ["switchgear", "generator", "ups"],
  },
  ups: {
    name: "UPS (Uninterruptible Power Supply)",
    category: "power",
    shortDescription: "Keeps the servers running without even a blip when the power fails, using batteries, until the generators take over.",
    technicalDetails:
      "A double-conversion UPS turns incoming AC into DC (rectifier), keeps the batteries charged on that DC bus, and turns it back into clean AC (inverter). Because the load always runs from the inverter, a utility failure causes no interruption: the batteries simply take over the DC bus. A module like the Vertiv Liebert EXL S1 handles 1-1.2 MW at about 97% efficiency (99% in eco mode). Multiple modules per path are paralleled N+1, and the A and B systems are independent (2N).",
    typicalSpecs: [
      { label: "Rating", value: "1,000-1,200 kW per module" },
      { label: "Efficiency", value: "≈97% online, ≈99% eco mode" },
      { label: "Size", value: "2654 W x 914 D x 2009 H mm, ≈2.1 t" },
      { label: "Topology", value: "Double conversion, N+1 per path, 2N overall" },
    ],
    connectsTo: ["switchgear", "battery-cabinet", "rpp", "busway"],
  },
  "battery-cabinet": {
    name: "Lithium-Ion Battery Cabinet",
    category: "power",
    shortDescription: "Banks of batteries that power the whole data hall for a few minutes, which is all it takes for the generators to start.",
    technicalDetails:
      "Each cabinet holds about 50 kWh of lithium-ion modules with its own battery management system. A string of cabinets gives a UPS roughly 5 minutes at full load, far more than the ~10-30 seconds generators need. Li-ion has largely replaced VRLA lead-acid: it uses 40-70% less floor space, weighs about 60% less and lasts 10-15 years instead of 3-5+. Rooms have thermal-runaway detection and dedicated suppression.",
    typicalSpecs: [
      { label: "Energy", value: "≈51 kWh per cabinet" },
      { label: "Size", value: "600 x 1100 x 2000 mm, ≈680 kg" },
      { label: "Runtime", value: "≈5 min at full load (design)" },
      { label: "Life", value: "10-15 years" },
    ],
    connectsTo: ["ups"],
  },
  generator: {
    name: "Diesel Generator",
    category: "power",
    shortDescription: "A huge engine that makes electricity when the grid fails. It can run the data centre for days on its fuel supply.",
    technicalDetails:
      "Containerised gensets such as the Caterpillar 3516C (up to 2.5 MW) or Cummins QSK95 (3 MW) sit on double-wall belly fuel tanks with a roof radiator and exhaust silencer. They are designed to start and accept full load within 10 seconds (NFPA 110 Type 10) and are kept warm by jacket heaters so they always start. Sites typically hold 24-48 hours of fuel and have refuelling contracts. Generators are load-tested monthly; many operators are switching to HVO renewable diesel to cut lifecycle CO₂.",
    typicalSpecs: [
      { label: "Rating", value: "2-3 MW standby each" },
      { label: "Start to full load", value: "≤10 s" },
      { label: "Fuel use", value: "≈500-650 L/h at full load" },
      { label: "Redundancy", value: "N+1 or 2N" },
      { label: "Fuel on site", value: "24-48 h at full load" },
    ],
    connectsTo: ["ats", "fuel-tank", "switchgear"],
    funFact: "A 2.5 MW generator burns roughly a bathtub of diesel every 15 minutes at full load.",
  },
  "fuel-tank": {
    name: "Bulk Fuel Tank",
    category: "power",
    shortDescription: "Stores extra diesel so the generators can keep running for days if the grid is down.",
    technicalDetails:
      "Bulk tanks top up the generators' belly tanks automatically through a fuel polishing and transfer system. They sit in concrete bunds that can hold 110% of the tank's volume in case of a leak. For a 2.5 MW genset, 24 hours of fuel is roughly 15-16 m³. Fuel quality is tested regularly, because diesel degrades over time.",
    typicalSpecs: [
      { label: "Capacity", value: "≈50-100 m³ per tank" },
      { label: "Containment", value: "Double wall + 110% bund" },
      { label: "Runtime target", value: "24-48 h facility load" },
    ],
    connectsTo: ["generator"],
  },
  rpp: {
    name: "Power Distribution Unit (Floor PDU / RPP)",
    category: "power",
    shortDescription: "A cabinet in the data hall that takes power from the UPS and splits it into many circuits for the racks.",
    technicalDetails:
      "Floor-standing PDUs (often with an isolating transformer) and Remote Power Panels take the UPS output and distribute it through branch breakers, or feed overhead busway, to the rack PDUs. They meter every circuit so operators know exactly how much power each rack uses. A-side and B-side PDUs are fed from different UPS systems.",
    typicalSpecs: [
      { label: "Rating", value: "150-300 kVA" },
      { label: "Output", value: "400/230 V or 415/240 V branch circuits" },
      { label: "Monitoring", value: "Per-circuit metering" },
    ],
    connectsTo: ["ups", "busway", "rack-pdu"],
  },
  busway: {
    name: "Overhead Busway",
    category: "power",
    shortDescription: "A metal track above the racks carrying electricity. Racks plug into it with tap-off boxes, like lamps on a track light.",
    technicalDetails:
      "Track busway (e.g. Starline T5, 250-1,250 A) replaces bundles of under-floor cable. Plug-in tap-off units with breakers and metering can be added or moved live, so new racks get power in minutes. Two busways run over each row, one per feed (A and B). For AI racks, busway is provisioned for 150-200 kW per rack.",
    typicalSpecs: [
      { label: "Rating", value: "250-1,250 A" },
      { label: "Voltage", value: "400-480 V, 4-pole" },
      { label: "Tap-offs", value: "Hot-pluggable with breakers and metering" },
    ],
    connectsTo: ["rpp", "rack-pdu", "power-shelf", "ups"],
  },

  // -------------------------------------------------------------------------
  // Cooling
  // -------------------------------------------------------------------------
  crah: {
    name: "CRAH (Computer Room Air Handler)",
    category: "cooling",
    shortDescription: "A large air conditioner along the wall that sucks in warm air, cools it with chilled water and blows it under the raised floor.",
    technicalDetails:
      "A downflow CRAH such as the Vertiv Liebert CW181 (181 kW) draws hot return air in at the top, passes it over a chilled-water coil, and pushes it into the raised-floor plenum with EC fans lowered below floor level. Perforated tiles release that air into the cold aisles. A CRAH uses chilled water; a CRAC has its own refrigerant compressor. Units are controlled together on supply-air temperature and floor pressure, and installed N+1 or N+2 so one can fail or be serviced.",
    typicalSpecs: [
      { label: "Capacity", value: "≈100-200 kW each" },
      { label: "Size", value: "3099 W x 1067 D x 2388 H mm (CW181)" },
      { label: "Chilled water", value: "≈16-20 °C supply / 24-30 °C return" },
      { label: "Fans", value: "EC plug fans in the floor void" },
    ],
    connectsTo: ["chilled-water-pipe", "raised-floor", "cold-aisle-containment"],
  },
  "fan-wall": {
    name: "Fan Wall",
    category: "cooling",
    shortDescription: "A wall of big fans and cooling coils that blows cool air straight into the hall, with no raised floor needed.",
    technicalDetails:
      "Fan walls (e.g. Vertiv CoolLoop Thermal Wall, 400-500 kW per module) sit along one side of a slab-floor hall. A grid of EC fans pushes air horizontally through chilled-water coils into the cold aisles, while hot air is returned via contained hot aisles and the ceiling plenum. They suit AI halls well: heavy racks sit on the slab, and fan walls handle the 10-20% of heat that liquid cooling leaves behind.",
    typicalSpecs: [
      { label: "Capacity", value: "≈220-500 kW per module" },
      { label: "Airflow", value: "20,000-90,000 m³/h" },
      { label: "Size", value: "≈3 x 1.5 x 3.7 m" },
    ],
    connectsTo: ["chilled-water-pipe", "cold-aisle-containment"],
  },
  cdu: {
    name: "Coolant Distribution Unit (CDU)",
    category: "cooling",
    shortDescription: "Pumps and a heat exchanger that send clean coolant through the GPU racks and hand the heat to the building's water system.",
    technicalDetails:
      "A CDU separates two loops. The facility water system (FWS) brings water from the dry coolers or chillers to the CDU's plate heat exchanger. The technology cooling system (TCS) is a sealed, finely filtered loop (often PG25) that the CDU pumps through overhead headers into each rack's manifolds and cold plates. TCS supply is typically FWS temperature plus a 3-5 K approach. In-row CDUs like the CoolIT CHx2000 move up to ~2 MW; two per row give N+1 redundancy. Pressure, flow, temperature and leak sensors feed the NOC.",
    typicalSpecs: [
      { label: "Capacity", value: "≈0.6-2.3 MW (in-row)" },
      { label: "Flow", value: "≈1,800-2,100 L/min" },
      { label: "Approach", value: "3-5 K (FWS → TCS)" },
      { label: "Filtration", value: "≈50 µm on the TCS loop" },
    ],
    connectsTo: ["gpu-rack", "dry-cooler", "chilled-water-pipe"],
  },
  chiller: {
    name: "Chiller",
    category: "cooling",
    shortDescription: "A big refrigeration machine that makes the cold water used to cool the data halls.",
    technicalDetails:
      "In a water-cooled centrifugal chiller, refrigerant evaporates in the evaporator shell, pulling heat out of the chilled water; a compressor raises its pressure and temperature; and it condenses in the condenser shell, dumping that heat into condenser water that goes to the cooling towers. Modern data centres run warmer chilled water (16-20 °C rather than the old 7 °C), which raises efficiency and allows 'free cooling' through a plate heat exchanger for much of the year without running compressors at all.",
    typicalSpecs: [
      { label: "Capacity", value: "≈3.5-10 MW (1,000-3,000 tons)" },
      { label: "Chilled water", value: "≈16-20 °C supply" },
      { label: "Redundancy", value: "N+1" },
      { label: "Efficiency", value: "COP ≈ 6-10 at warm water temps" },
    ],
    connectsTo: ["pump", "cooling-tower", "chilled-water-pipe", "crah"],
  },
  "cooling-tower": {
    name: "Cooling Tower",
    category: "cooling",
    shortDescription: "Rooftop towers where a big fan pulls air through falling water, carrying the chillers' heat away into the sky.",
    technicalDetails:
      "Warm condenser water from the chillers is sprayed over fill media while a fan draws air through it; a small fraction evaporates, which cools the rest very efficiently. Cells range from ~120 to 800 tons each with fans 2-4 m across. Evaporation consumes water, so water treatment and consumption (water usage effectiveness, WUE) are important; many new AI sites use dry coolers instead.",
    typicalSpecs: [
      { label: "Capacity", value: "≈0.4-2.8 MW per cell" },
      { label: "Fan", value: "2.1-3.7 m diameter" },
      { label: "Principle", value: "Evaporative (uses water)" },
    ],
    connectsTo: ["chiller", "pump"],
  },
  "dry-cooler": {
    name: "Dry Cooler",
    category: "cooling",
    shortDescription: "Rooftop radiators with fans that cool water using outside air. It's like a car radiator, but the size of a shipping container.",
    technicalDetails:
      "V-shaped finned coils with rows of EC fans reject heat to ambient air with no compressor and little or no water. Adiabatic versions wet pads in front of the coils only on hot days. Because liquid-cooled GPU racks accept warm coolant (W32-W45 classes), dry coolers can often cool them all year without chillers, which is a big reason AI halls can reach PUE near 1.1-1.2. In winter, dry coolers also provide free cooling for the chilled-water system.",
    typicalSpecs: [
      { label: "Capacity", value: "≈0.6-3.4 MW per unit" },
      { label: "Fans", value: "Up to 2 x 12 EC fans" },
      { label: "Water use", value: "None (adiabatic: only on hot days)" },
    ],
    connectsTo: ["cdu", "chiller", "chilled-water-pipe"],
  },
  pump: {
    name: "Pump",
    category: "cooling",
    shortDescription: "Electric pumps that keep water moving around the cooling system. Without them, nothing gets cooled.",
    technicalDetails:
      "Chilled-water pumps circulate water from the chillers to the CRAHs and fan walls; condenser-water pumps move heat from the chillers to the cooling towers. Variable-speed drives match flow to load, and since pump power scales roughly with the cube of speed, running slower saves a lot of energy. Pumps are installed N+1, and they are on the mechanical switchboards (which are generator-backed but not on UPS), so cooling restarts within seconds after a power failure.",
    typicalSpecs: [
      { label: "Type", value: "End-suction / split-case centrifugal" },
      { label: "Control", value: "Variable-speed drive" },
      { label: "Redundancy", value: "N+1" },
    ],
    connectsTo: ["chiller", "cooling-tower", "chilled-water-pipe"],
  },
  "chilled-water-pipe": {
    name: "Chilled Water Pipework",
    category: "cooling",
    shortDescription: "Insulated pipes carrying cold water out to the cooling units (blue) and warm water back (red).",
    technicalDetails:
      "Supply pipes (blue) carry chilled water from the plant to CRAHs, fan walls and CDUs; return pipes (red) bring it back warmer. Condenser water (green) runs between the chillers and the cooling towers. The temperature difference (ΔT) sets how much heat each litre carries: at ΔT 10 K, removing 1 kW needs about 1.4 L/min. Loops are often arranged as a ring with isolation valves so any section can be maintained without stopping cooling (concurrent maintainability, Tier III).",
    typicalSpecs: [
      { label: "Supply / return", value: "≈16-20 °C / 24-30 °C (air), warmer for liquid" },
      { label: "Flow rule", value: "≈1.4 L/min per kW at ΔT 10 K" },
      { label: "Colour code", value: "Blue supply, red return, green condenser" },
    ],
    connectsTo: ["chiller", "crah", "cdu", "pump"],
  },
  "cold-aisle-containment": {
    name: "Aisle Containment",
    category: "cooling",
    shortDescription: "Doors and a roof that seal off an aisle so cold air and hot air can't mix. This makes cooling far more efficient.",
    technicalDetails:
      "Cold-aisle containment closes the aisle between rack fronts with end doors and roof panels, so all cold air from the perforated tiles must go through the servers. Hot-aisle containment instead encloses the rack exhausts and ducts hot air back to the coolers; it is common in fan-wall and AI halls. Either way, stopping hot and cold air from mixing lets operators raise supply temperatures within ASHRAE's 18-27 °C recommended inlet range, cutting cooling energy substantially.",
    typicalSpecs: [
      { label: "Inlet target", value: "18-27 °C (ASHRAE recommended)" },
      { label: "Parts", value: "Sliding doors, roof panels, blanking" },
      { label: "Benefit", value: "Higher supply temps, lower fan energy" },
    ],
    connectsTo: ["crah", "fan-wall", "blanking-panel"],
  },
  "raised-floor": {
    name: "Raised Floor and Plenum",
    category: "cooling",
    shortDescription: "A floor made of removable tiles on short legs. The space underneath carries cold air, pipes and cables.",
    technicalDetails:
      "Standard 600 x 600 mm tiles sit on adjustable pedestals 300-900 mm above the slab (600 mm here). CRAHs pressurise the void with cold air, and perforated tiles (typically 25-56% open) in the cold aisles let it rise exactly where server intakes are. Many new hyperscale and AI halls use slab floors instead, since they are cheaper and better for 1.4-tonne racks, with power, cabling and liquid cooling run overhead.",
    typicalSpecs: [
      { label: "Tile", value: "600 x 600 mm" },
      { label: "Height", value: "300-900 mm (600 mm here)" },
      { label: "Perforated tiles", value: "≈25-56% open area" },
    ],
    connectsTo: ["crah", "cold-aisle-containment", "chilled-water-pipe"],
  },

  // -------------------------------------------------------------------------
  // Fire safety
  // -------------------------------------------------------------------------
  vesda: {
    name: "VESDA Smoke Detection",
    category: "safety",
    shortDescription: "Thin red pipes that constantly sniff the air and can detect smoke long before you could see or smell it.",
    technicalDetails:
      "Very Early Smoke Detection Apparatus is aspirating detection: a fan draws air through small sampling holes in a pipe network to a laser detection chamber. Sensitivity reaches 0.005% obscuration per metre, hundreds of times more sensitive than ordinary detectors. It has staged alarms (Alert, Action, Fire 1, Fire 2), so staff can find an overheating component before it becomes a fire. Pipes run at ceiling level, in containment and in the return-air path.",
    typicalSpecs: [
      { label: "Sensitivity", value: "0.005-20% obs/m" },
      { label: "Coverage", value: "Up to ≈2,000 m² per detector" },
      { label: "Alarm levels", value: "Alert, Action, Fire 1, Fire 2" },
    ],
    connectsTo: ["gas-suppression", "sprinkler", "noc"],
  },
  "gas-suppression": {
    name: "Clean-Agent Fire Suppression",
    category: "safety",
    shortDescription: "Cylinders of special gas that flood the room and put out a fire in seconds, without damaging the electronics.",
    technicalDetails:
      "Halocarbon agents (FK-5-1-12, sold as Novec 1230, or FM-200 / HFC-227ea) reach design concentration within 10 seconds and extinguish fire mainly by absorbing heat. Inert gases (IG-541: nitrogen, argon and CO₂) instead lower oxygen to a level that stops combustion but is still safe to breathe briefly, discharging over 60-120 s from 200-300 bar cylinders. Release normally needs two independent detections, followed by a pre-discharge alarm and countdown so people can leave. Supply is shifting: 3M ended Novec 1230 production in 2025 (other makers still produce FK-5-1-12), and HFCs like FM-200 are being phased down.",
    typicalSpecs: [
      { label: "Halocarbon discharge", value: "≤10 s" },
      { label: "Inert gas discharge", value: "60-120 s" },
      { label: "Activation", value: "Double knock + countdown" },
    ],
    connectsTo: ["vesda", "sprinkler"],
  },
  sprinkler: {
    name: "Pre-Action Sprinklers",
    category: "safety",
    shortDescription: "Sprinkler pipes that stay empty until a fire is confirmed, because water and servers don't mix. Water is the last resort.",
    technicalDetails:
      "In a double-interlock pre-action system the pipes are filled with supervisory air, not water. Water only enters when a detection system confirms fire and a sprinkler head has also opened from heat. This prevents accidental discharge from a knocked head. Water is kept as the last line of defence because it can destroy equipment, but codes usually require it, and it protects the building if a fire gets beyond what the gas can handle.",
    typicalSpecs: [
      { label: "Type", value: "Double-interlock pre-action" },
      { label: "Pipes", value: "Dry, supervised air at 10-20 psi" },
      { label: "Role", value: "Last resort after gas suppression" },
    ],
    connectsTo: ["vesda", "gas-suppression"],
  },

  // -------------------------------------------------------------------------
  // Operations and security
  // -------------------------------------------------------------------------
  noc: {
    name: "Network Operations Center",
    category: "infrastructure",
    shortDescription: "The control room where staff watch the whole data centre around the clock and respond to any alarm.",
    technicalDetails:
      "Operators monitor the building management system (BMS: cooling, power, fire), DCIM (asset, capacity and power per rack), network monitoring and security systems. They follow runbooks for incidents, coordinate maintenance windows and escalate to on-call engineers. Most facilities staff the NOC 24/7/365, often with a 'follow-the-sun' remote NOC as backup.",
    typicalSpecs: [
      { label: "Staffing", value: "24/7/365" },
      { label: "Systems", value: "BMS, EPMS, DCIM, NMS, security" },
      { label: "Key metrics", value: "PUE, power per feed, inlet temps, alerts" },
    ],
    connectsTo: ["video-wall", "vesda", "cctv"],
  },
  "video-wall": {
    name: "NOC Video Wall",
    category: "infrastructure",
    shortDescription: "A wall of large screens showing live power, temperature, network traffic and alarms for the whole facility.",
    technicalDetails:
      "Narrow-bezel LCD panels driven by a video-wall controller show dashboards from the BMS, DCIM and network tools, plus CCTV feeds. Key indicators include facility and IT power, PUE, rack inlet temperatures as a heat map, network throughput and the active alarm list, so everyone in the room shares the same picture during an incident.",
    typicalSpecs: [
      { label: "Panels", value: "8 x 55\" narrow-bezel LCD" },
      { label: "Content", value: "Power, PUE, thermal map, network, alerts, CCTV" },
    ],
    connectsTo: ["noc"],
  },
  mantrap: {
    name: "Mantrap",
    category: "safety",
    shortDescription: "A small glass booth with two doors that can never both be open, so only one authorised person gets through at a time.",
    technicalDetails:
      "The outer door opens with a badge; once it closes, the person must pass a second factor (biometric) before the inner door unlocks. Sensors detect a second person (tailgating) and lock both doors. Mantraps typically guard the transition from public areas to the secure technical corridor and again at data hall entrances.",
    typicalSpecs: [
      { label: "Interlock", value: "Only one door open at a time" },
      { label: "Authentication", value: "Badge + biometric" },
      { label: "Anti-tailgating", value: "Weight / optical sensors" },
    ],
    connectsTo: ["badge-reader", "biometric-scanner", "cctv"],
  },
  "badge-reader": {
    name: "Badge Reader",
    category: "safety",
    shortDescription: "Reads your access card. Every door logs who went through and when.",
    technicalDetails:
      "Encrypted smart cards (e.g. DESFire or iCLASS SE) are checked against an access-control system that grants rights per person, per area and per time window. Every swipe is logged, and the logs are audited for compliance frameworks such as ISO 27001, SOC 2 and PCI DSS.",
    typicalSpecs: [
      { label: "Technology", value: "13.56 MHz encrypted smart card" },
      { label: "Logging", value: "Every event, retained for audit" },
    ],
    connectsTo: ["mantrap", "biometric-scanner"],
  },
  "biometric-scanner": {
    name: "Biometric Scanner",
    category: "safety",
    shortDescription: "Checks something you are, such as your palm veins, iris or fingerprint, as well as the card you carry.",
    technicalDetails:
      "Multi-factor authentication (card plus biometric, sometimes plus PIN) prevents a lost or shared badge from granting access. Palm-vein and iris readers are popular because they are hard to spoof and work with gloves or without contact.",
    typicalSpecs: [
      { label: "Modalities", value: "Palm vein, iris, fingerprint, face" },
      { label: "Use", value: "Second factor at mantraps and halls" },
    ],
    connectsTo: ["mantrap", "badge-reader"],
  },
  cctv: {
    name: "CCTV Camera",
    category: "safety",
    shortDescription: "Security cameras watching the fence, doors and every aisle. Recordings are kept for weeks.",
    technicalDetails:
      "IP cameras with analytics cover the perimeter, entrances, mantraps and data hall aisles, recording continuously. Retention is commonly 30-90 days (PCI DSS often requires 90). Video analytics flag loitering, line crossing and tailgating to the security desk.",
    typicalSpecs: [
      { label: "Retention", value: "30-90 days" },
      { label: "Coverage", value: "Perimeter, doors, aisles" },
      { label: "Analytics", value: "Line crossing, loitering, tailgating" },
    ],
    connectsTo: ["noc", "mantrap", "security-fence"],
  },
  "security-fence": {
    name: "Perimeter Security",
    category: "safety",
    shortDescription: "The first layer of defence: a tall anti-climb fence, crash-rated barriers and a guarded gate.",
    technicalDetails:
      "Security is layered from the outside in. First comes a 2.4-3 m anti-climb fence with intrusion detection, then crash-rated vehicle barriers (ASTM F2656 M50 / K12 stops a 6.8 t truck at 80 km/h), then a guarded gate and controlled parking. Inside are building entry, mantraps, data halls, locked cages and finally locked racks. Each layer slows an intruder and gives the security team more time to respond.",
    typicalSpecs: [
      { label: "Fence", value: "2.4-3.0 m anti-climb with sensors" },
      { label: "Barriers", value: "ASTM F2656 M30-M50 rated" },
      { label: "Layers", value: "Site → building → hall → cage → rack" },
    ],
    connectsTo: ["guard-house", "cctv", "mantrap"],
  },
  "guard-house": {
    name: "Guard House / Security Desk",
    category: "safety",
    shortDescription: "Where security officers check visitors and vehicles and watch the camera feeds 24/7.",
    technicalDetails:
      "Officers verify identity against pre-booked visits, issue temporary badges, inspect vehicles and deliveries, and monitor CCTV and alarms. Many sites use a vehicle sally port, where one gate must close before the next opens.",
    typicalSpecs: [
      { label: "Staffing", value: "24/7" },
      { label: "Functions", value: "Visitor ID, badges, CCTV, patrols" },
    ],
    connectsTo: ["security-fence", "cctv"],
  },

  // -------------------------------------------------------------------------
  // Site
  // -------------------------------------------------------------------------
  building: {
    name: "Data Centre Building",
    category: "infrastructure",
    shortDescription: "The building that houses everything: two data halls, power and cooling plant, network rooms and offices.",
    technicalDetails:
      "This single-storey shell (84 x 52 m, ~12.5 m to the roof screen, ~7 m clear inside) holds about 9-10 MW of IT load: an air-cooled hall of ~200 racks and a liquid-cooled AI hall of 60 NVL72 racks. Structure, roof and walls are designed for heavy rooftop plant, high floor loads and wind. Power runs as two fully separate paths (2N) and cooling as N+1, consistent with an Uptime Institute Tier III-IV design. Tier III means concurrently maintainable (≈99.982%), Tier IV means fault tolerant (≈99.995%).",
    typicalSpecs: [
      { label: "IT capacity", value: "≈9-10 MW" },
      { label: "Footprint", value: "84 x 52 m" },
      { label: "Redundancy", value: "2N power, N+1 cooling" },
      { label: "Design PUE", value: "≈1.2-1.3 (industry avg ≈1.56)" },
    ],
    connectsTo: ["substation", "generator", "dry-cooler", "fiber-entry"],
    funFact:
      "PUE (Power Usage Effectiveness) is total facility power divided by IT power. Uptime Institute's 2024 survey put the industry average at 1.56, while Google reports about 1.09 across its fleet.",
  },
  "water-tank": {
    name: "Water Storage Tank",
    category: "infrastructure",
    shortDescription: "Stores water for the fire sprinklers and for topping up the cooling towers.",
    technicalDetails:
      "On-site storage keeps the fire protection system and evaporative cooling running if the municipal supply is interrupted. Cooling towers consume water through evaporation and blowdown, which is why water usage effectiveness (WUE, litres per kWh of IT energy) is now reported alongside PUE.",
    typicalSpecs: [
      { label: "Uses", value: "Fire protection, cooling makeup" },
      { label: "Metric", value: "WUE (L/kWh)" },
    ],
    connectsTo: ["cooling-tower", "sprinkler"],
  },
};

export const FACILITY_EQUIPMENT = Object.fromEntries(
  Object.entries(ENTRIES).map(([id, e]) => [id, { id, ...e }]),
) as Record<Exclude<EquipmentTypeId, RackEntryId>, EquipmentInfo>;
