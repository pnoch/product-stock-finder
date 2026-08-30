import Fuse from "fuse.js";
import { Product } from "./types";
import { getDiscoveredProducts } from "./storage";

export const PRODUCT_CATALOG: Omit<
  Product,
  "addedAt" | "isWatched" | "listings"
>[] = [
  {
    id: "mikrotik-crs804-4ddq-hrm",
    name: "MikroTik CRS804-4DDQ-hRM",
    modelNumber: "CRS804-4DDQ-hRM",
    brand: "MikroTik",
    category: "Networking Switch",
    description:
      "400G Cloud Router Switch with 4x QSFP-DD ports, 2x 10G Ethernet, RouterOS v7. Ideal for AI/GPU clusters and high-performance aggregation.",
  },
  {
    id: "mikrotik-ccr2216",
    name: "MikroTik CCR2216-1G-12XS-2XQ",
    modelNumber: "CCR2216-1G-12XS-2XQ",
    brand: "MikroTik",
    category: "Router",
    description: "Cloud Core Router with 12x 25G SFP28, 2x 100G QSFP28 ports.",
  },
  {
    id: "mikrotik-crs518",
    name: "MikroTik CRS518-16XS-2XQ",
    modelNumber: "CRS518-16XS-2XQ",
    brand: "MikroTik",
    category: "Networking Switch",
    description: "Cloud Router Switch with 16x 25G SFP28 and 2x 100G QSFP28.",
  },
  {
    id: "mikrotik-rb5009",
    name: "MikroTik RB5009UG+S+IN",
    modelNumber: "RB5009UG+S+IN",
    brand: "MikroTik",
    category: "Router",
    description:
      "High-performance router with 7x Gigabit, 1x 2.5G, 1x SFP+ ports.",
  },
  {
    id: "mikrotik-hex-s",
    name: "MikroTik hEX S",
    modelNumber: "RB760iGS",
    brand: "MikroTik",
    category: "Router",
    description: "5-port Gigabit router with SFP port and PoE output.",
  },
  {
    id: "ubiquiti-udm-pro",
    name: "Ubiquiti UniFi Dream Machine Pro",
    modelNumber: "UDM-PRO",
    brand: "Ubiquiti",
    category: "Network Gateway",
    description:
      "Enterprise network appliance with 10G SFP+ WAN and 8-port Gigabit switch.",
  },
  {
    id: "ubiquiti-usw-pro-48",
    name: "Ubiquiti UniFi Switch Pro 48",
    modelNumber: "USW-PRO-48",
    brand: "Ubiquiti",
    category: "Networking Switch",
    description: "48-port managed switch with 4x SFP+ uplinks.",
  },
  {
    id: "intel-x710-da2",
    name: "Intel X710-DA2 10GbE NIC",
    modelNumber: "X710-DA2",
    brand: "Intel",
    category: "Network Card",
    description: "Dual-port 10GbE SFP+ network adapter.",
  },
  {
    id: "mellanox-cx6",
    name: "Mellanox ConnectX-6",
    modelNumber: "MCX653106A-ECAT",
    brand: "NVIDIA/Mellanox",
    category: "Network Card",
    description: "200GbE HDR InfiniBand dual-port network adapter.",
  },
  {
    id: "cisco-c9300-48p",
    name: "Cisco Catalyst 9300-48P",
    modelNumber: "C9300-48P-E",
    brand: "Cisco",
    category: "Networking Switch",
    description: "48-port PoE+ managed switch with 4x 1G SFP uplinks.",
  },
  {
    id: "juniper-ex2300-48p",
    name: "Juniper EX2300-48P",
    modelNumber: "EX2300-48P",
    brand: "Juniper",
    category: "Networking Switch",
    description: "48-port PoE+ Gigabit switch with 4x SFP/SFP+ uplinks.",
  },
  {
    id: "aruba-2930f-48g",
    name: "Aruba 2930F 48G PoE+",
    modelNumber: "JL263A",
    brand: "Aruba (HPE)",
    category: "Networking Switch",
    description: "48-port PoE+ Gigabit switch with 4x SFP uplinks.",
  },
  {
    id: "mikrotik-crs326-24s",
    name: "MikroTik CRS326-24S+2Q+RM",
    modelNumber: "CRS326-24S+2Q+RM",
    brand: "MikroTik",
    category: "Networking Switch",
    description:
      "24x 10G SFP+ and 2x 40G QSFP+ rack-mount cloud router switch.",
  },
  {
    id: "mikrotik-ccr2004",
    name: "MikroTik CCR2004-1G-12S+2XS",
    modelNumber: "CCR2004-1G-12S+2XS",
    brand: "MikroTik",
    category: "Router",
    description: "Cloud Core Router with 12x 10G SFP+ and 2x 25G SFP28 ports.",
  },
  {
    id: "ubiquiti-usg-pro-4",
    name: "Ubiquiti UniFi Security Gateway Pro 4",
    modelNumber: "USG-PRO-4",
    brand: "Ubiquiti",
    category: "Network Gateway",
    description:
      "Enterprise gateway with dual Gigabit SFP WAN and 2x Gigabit LAN ports.",
  },
  {
    id: "netgear-m4300-96x",
    name: "NETGEAR M4300-96X",
    modelNumber: "XSM4396K0-100NES",
    brand: "NETGEAR",
    category: "Networking Switch",
    description: "96-port 10G/25G modular switch with 8x 100G QSFP28 uplinks.",
  },
  {
    id: "fs-s5860-20sq",
    name: "FS S5860-20SQ",
    modelNumber: "S5860-20SQ",
    brand: "FS.com",
    category: "Networking Switch",
    description:
      "20-port 25G SFP28 switch with 2x 100G QSFP28 uplinks, ONIE support.",
  },

  // ─── Single-Board Computers ────────────────────────────────────────────────
  {
    id: "raspberry-pi-5-8gb",
    name: "Raspberry Pi 5 8GB",
    modelNumber: "RPI5-8GB",
    brand: "Raspberry Pi",
    category: "Single-Board Computer",
    description:
      "8GB RAM single-board computer with BCM2712, dual 4K display, PCIe 2.0 x1.",
  },
  {
    id: "nvidia-jetson-orin-nano",
    name: "NVIDIA Jetson Orin Nano Developer Kit",
    modelNumber: "900-13767-0040-500",
    brand: "NVIDIA",
    category: "Single-Board Computer",
    description:
      "40TOPS AI inference dev kit with 6-core ARM CPU, 8GB GPU memory.",
  },

  // ─── GPUs ──────────────────────────────────────────────────────────────────
  {
    id: "nvidia-rtx-5090",
    name: "NVIDIA GeForce RTX 5090",
    modelNumber: "RTX 5090",
    brand: "NVIDIA",
    category: "GPU",
    description:
      "Flagship consumer GPU with 32GB GDDR7, 21760 CUDA cores. Extremely limited availability.",
  },
  {
    id: "nvidia-rtx-4090",
    name: "NVIDIA GeForce RTX 4090",
    modelNumber: "RTX 4090",
    brand: "NVIDIA",
    category: "GPU",
    description:
      "24GB GDDR6X, 16384 CUDA cores. High demand for AI workloads and gaming.",
  },
  {
    id: "amd-rx-7900-xtx",
    name: "AMD Radeon RX 7900 XTX",
    modelNumber: "RX 7900 XTX",
    brand: "AMD",
    category: "GPU",
    description:
      "24GB GDDR6, 6144 stream processors. AMD's flagship with chiplet design.",
  },

  // ─── Apple ─────────────────────────────────────────────────────────────────
  {
    id: "apple-macbook-pro-m4-max",
    name: "Apple MacBook Pro 16\" M4 Max",
    modelNumber: "M4 Max",
    brand: "Apple",
    category: "Laptop",
    description:
      "16-inch laptop with M4 Max chip, 48GB unified memory, 1TB SSD.",
  },
  {
    id: "apple-mac-studio-m4-ultra",
    name: "Apple Mac Studio M4 Ultra",
    modelNumber: "M4 Ultra",
    brand: "Apple",
    category: "Desktop",
    description:
      "Compact desktop with M4 Ultra, 192GB unified memory. Long lead times.",
  },
  {
    id: "apple-vision-pro",
    name: "Apple Vision Pro",
    modelNumber: "MVNP3LL/A",
    brand: "Apple",
    category: "Mixed Reality",
    description:
      "Spatial computing headset with M2 chip, micro-OLED displays, eye tracking.",
  },

  // ─── Raspberry Pi Accessories ──────────────────────────────────────────────
  {
    id: "raspberry-pi-active-cooler",
    name: "Raspberry Pi Active Cooler",
    modelNumber: "SC1148",
    brand: "Raspberry Pi",
    category: "Cooling",
    description:
      "Official active cooler for Raspberry Pi 5 with PWM fan and heat sink.",
  },

  // ─── Gaming Consoles ───────────────────────────────────────────────────────
  {
    id: "sony-ps5-pro",
    name: "Sony PlayStation 5 Pro",
    modelNumber: "CFI-2000",
    brand: "Sony",
    category: "Gaming Console",
    description:
      "Enhanced PS5 with 2TB SSD, advanced ray tracing, 8K support.",
  },
  {
    id: "valve-steam-deck-oled",
    name: "Valve Steam Deck OLED",
    modelNumber: "SD-OLED-1TB",
    brand: "Valve",
    category: "Handheld Gaming",
    description:
      "1TB OLED handheld gaming PC with 7.4\" HDR display, Wi-Fi 6E.",
  },
  {
    id: "nintendo-switch-2",
    name: "Nintendo Switch 2",
    modelNumber: "Switch 2",
    brand: "Nintendo",
    category: "Gaming Console",
    description:
      "Next-gen Nintendo console with 1080p LCD, magnetic Joy-Cons, backward compatibility.",
  },

  // ─── High-End Audio ────────────────────────────────────────────────────────
  {
    id: "sennheiser-hd800s",
    name: "Sennheiser HD 800 S",
    modelNumber: "HD 800 S",
    brand: "Sennheiser",
    category: "Headphones",
    description:
      "Open-back reference headphones with 56mm ring radiator, 6-51kHz frequency response.",
  },
  {
    id: "focal-utopia-2022",
    name: "Focal Utopia 2022",
    modelNumber: "UT01242",
    brand: "Focal",
    category: "Headphones",
    description:
      "Flagship open-back headphones with 40mm pure beryllium driver, made in France.",
  },
  {
    id: "sony-wh-1000xm6",
    name: "Sony WH-1000XM6",
    modelNumber: "WH-1000XM6",
    brand: "Sony",
    category: "Headphones",
    description:
      "Industry-leading noise canceling headphones with 40hr battery, LDAC support.",
  },
  {
    id: "apple-airpods-max-2",
    name: "Apple AirPods Max 2",
    modelNumber: "A3030",
    brand: "Apple",
    category: "Headphones",
    description:
      "Over-ear wireless headphones with H2 chip, adaptive EQ, spatial audio.",
  },

  // ─── Networking (more MikroTik) ────────────────────────────────────────────
  {
    id: "mikrotik-hap-ax3",
    name: "MikroTik hAP ax³",
    modelNumber: "C51iUG-5HaxD2HaxD",
    brand: "MikroTik",
    category: "Router",
    description:
      "Dual-band Wi-Fi 6 router with quad-core CPU, 256MB RAM, 5 Gigabit ports.",
  },
  {
    id: "mikrotik-chateau-5g-ax",
    name: "MikroTik Chateau 5G ax",
    modelNumber: "D51G-5HacD2HaxD+R11e-5HacD",
    brand: "MikroTik",
    category: "Router",
    description:
      "5G Cat 20 LTE router with Wi-Fi 6, 5 Gigabit ports, SFP, PoE input.",
  },
  {
    id: "mikrotik-lhg-xl-52qc",
    name: "MikroTik LHG XL 52 QC",
    modelNumber: "LHG XL 52 QC",
    brand: "MikroTik",
    category: "Wireless Bridge",
    description:
      "60GHz + 5GHz dual-band wireless bridge with 2km+ range, 2Gbps throughput.",
  },

  // ─── Smart Home ────────────────────────────────────────────────────────────
  {
    id: "ubiquiti-unifi-udr",
    name: "Ubiquiti UniFi Dream Router",
    modelNumber: "UDR",
    brand: "Ubiquiti",
    category: "Network Gateway",
    description:
      "Wi-Fi 6 router with UniFi OS, 3Gbps throughput, integrated controller.",
  },
  {
    id: "ubiquiti-unifi-g4-doorbell-pro",
    name: "Ubiquiti UniFi G4 Doorbell Pro",
    modelNumber: "UDG4-PRO",
    brand: "Ubiquiti",
    category: "Smart Home",
    description:
      "4K PoE doorbell with person detection, Package Detection, 2-way audio.",
  },

  // ─── Storage ───────────────────────────────────────────────────────────────
  {
    id: "samsung-990-pro-4tb",
    name: "Samsung 990 PRO 4TB",
    modelNumber: "MZ-V9P4T0BW",
    brand: "Samsung",
    category: "Storage",
    description:
      "4TB PCIe 4.0 NVMe SSD, 7450MB/s read, 6900MB/s write. High capacity, often out of stock.",
  },

  // ─── Enterprise / Prosumer ─────────────────────────────────────────────────
  {
    id: "ubiquiti-unifi-usw-pro-max-48",
    name: "Ubiquiti UniFi Switch Pro Max 48 PoE",
    modelNumber: "USW-Pro-Max-48-PoE",
    brand: "Ubiquiti",
    category: "Networking Switch",
    description:
      "48-port PoE++ managed switch with 2x 10G SFP+, 720W PoE budget.",
  },
  {
    id: "tp-link-er8411",
    name: "TP-Link ER8411",
    modelNumber: "ER8411",
    brand: "TP-Link",
    category: "Router",
    description:
      "Enterprise VPN router with 10G SFP+, 8 Gigabit, dual WAN, up to 10Gbps throughput.",
  },

  // ─── Power Protection ──────────────────────────────────────────────────────
  {
    id: "apc-smart-ups-3000",
    name: "APC Smart-UPS SRT 3000VA",
    modelNumber: "SRT3000XLI",
    brand: "APC",
    category: "UPS",
    description:
      "3000VA/2700W online double-conversion UPS, LCD display, SmartConnect.",
  },
];

const fuse = new Fuse(PRODUCT_CATALOG, {
  keys: [
    { name: "modelNumber", weight: 0.4 },
    { name: "name", weight: 0.3 },
    { name: "brand", weight: 0.15 },
    { name: "category", weight: 0.1 },
    { name: "description", weight: 0.05 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
});

export function searchCatalog(query: string): typeof PRODUCT_CATALOG {
  if (!query.trim()) return PRODUCT_CATALOG;
  return fuse.search(query).map((result) => result.item);
}

export async function getAllCatalog() {
  const discovered = await getDiscoveredProducts();
  return [...PRODUCT_CATALOG, ...discovered];
}

export async function searchCatalogAsync(query: string) {
  const catalog = await getAllCatalog();
  const fuseInstance = new Fuse(catalog, {
    keys: [
      { name: "modelNumber", weight: 0.4 },
      { name: "name", weight: 0.3 },
      { name: "brand", weight: 0.15 },
      { name: "category", weight: 0.1 },
      { name: "description", weight: 0.05 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });
  if (!query.trim()) return catalog;
  return fuseInstance.search(query).map((result) => result.item);
}
