import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { Product } from "@/lib/types";

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

  // ─── Single-Board Computers ───
  { id: "raspberry-pi-5-4gb", name: "Raspberry Pi 5 (4GB)", modelNumber: "SC1112", brand: "Raspberry Pi", category: "Single-Board Computer", description: "Quad-core 2.4GHz SBC with 4GB RAM, PCIe 2.0, dual 4K output. Frequently out of stock." },
  { id: "raspberry-pi-5-16gb", name: "Raspberry Pi 5 (16GB)", modelNumber: "SC1112", brand: "Raspberry Pi", category: "Single-Board Computer", description: "16GB variant of the Pi 5 for memory-heavy workloads; chronically back-ordered." },
  { id: "raspberry-pi-4-4gb", name: "Raspberry Pi 4 Model B (4GB)", modelNumber: "SC0194", brand: "Raspberry Pi", category: "Single-Board Computer", description: "Quad-core 1.5GHz SBC with 4GB RAM, dual micro-HDMI, Gigabit Ethernet." },
  { id: "raspberry-pi-zero-2-w", name: "Raspberry Pi Zero 2 W", modelNumber: "SC0510", brand: "Raspberry Pi", category: "Single-Board Computer", description: "Compact quad-core Wi-Fi SBC for lightweight always-on services." },
  { id: "raspberry-pi-cm4-8gb", name: "Raspberry Pi Compute Module 4 (8GB)", modelNumber: "CM4008000", brand: "Raspberry Pi", category: "Single-Board Computer", description: "Industrial compute module with 8GB RAM and optional eMMC, for custom carrier boards." },
  { id: "orange-pi-5", name: "Orange Pi 5", modelNumber: "Orange Pi 5", brand: "Orange Pi", category: "Single-Board Computer", description: "Rockchip RK3588S SBC with 8K decode and PCIe, a Pi alternative with more I/O." },
  { id: "radxa-rock-5b", name: "Radxa Rock 5B", modelNumber: "Rock 5B", brand: "Radxa", category: "Single-Board Computer", description: "RK3588 SBC with 2.5GbE, PCIe 3.0, and up to 16GB RAM." },
  { id: "beaglebone-black", name: "BeagleBone Black", modelNumber: "BB-BBLK-000", brand: "BeagleBoard", category: "Single-Board Computer", description: "AM335x SBC with real-time PRUs, a long-standing embedded workhorse." },
  { id: "banana-pi-m5", name: "Banana Pi BPI-M5", modelNumber: "BPI-M5", brand: "Banana Pi", category: "Single-Board Computer", description: "Amlogic S905X3 SBC with 4GB RAM and Gigabit Ethernet." },
  { id: "khadas-vim4", name: "Khadas VIM4", modelNumber: "VIM4", brand: "Khadas", category: "Single-Board Computer", description: "Amlogic A311D2 SBC with 8GB RAM, HDMI in/out, and M.2." },
  { id: "odroid-n2-plus", name: "ODROID-N2+", modelNumber: "ODROID-N2+", brand: "ODROID", category: "Single-Board Computer", description: "Amlogic S922X SBC with 4GB RAM, a media/NAS favorite." },
  { id: "libre-le-potato", name: "Libre Computer Le Potato", modelNumber: "AML-S905X-CC", brand: "Libre Computer", category: "Single-Board Computer", description: "Low-cost Amlogic S905X SBC, a budget Pi alternative." },
  { id: "nanopi-r5s", name: "NanoPi R5S", modelNumber: "NanoPi R5S", brand: "FriendlyElec", category: "Single-Board Computer", description: "RK3568 router SBC with dual 2.5GbE and one Gigabit port." },

  // ─── Storage / NAS ───
  { id: "synology-ds923", name: "Synology DiskStation DS923+", modelNumber: "DS923+", brand: "Synology", category: "Storage", description: "4-bay NAS with AMD Ryzen R1600, 10GbE upgrade slot, and NVMe cache." },
  { id: "synology-ds224", name: "Synology DiskStation DS224+", modelNumber: "DS224+", brand: "Synology", category: "Storage", description: "2-bay NAS with Intel Celeron J4125, ideal for home backup." },
  { id: "synology-ds1522", name: "Synology DiskStation DS1522+", modelNumber: "DS1522+", brand: "Synology", category: "Storage", description: "5-bay NAS with AMD Ryzen R1600 and expandable 10GbE." },
  { id: "synology-ds1621", name: "Synology DiskStation DS1621+", modelNumber: "DS1621+", brand: "Synology", category: "Storage", description: "6-bay NAS with AMD Ryzen V1500B and dual NVMe cache slots." },
  { id: "qnap-ts-464", name: "QNAP TS-464", modelNumber: "TS-464", brand: "QNAP", category: "Storage", description: "4-bay NAS with Intel Celeron N5095, 2.5GbE, and M.2 slots." },
  { id: "terramaster-f4-423", name: "TerraMaster F4-423", modelNumber: "F4-423", brand: "TerraMaster", category: "Storage", description: "4-bay NAS with Intel Celeron N5095 and dual 2.5GbE." },
  { id: "wd-red-plus-4tb", name: "WD Red Plus 4TB", modelNumber: "WD40EFPX", brand: "Western Digital", category: "Storage", description: "NAS-grade 3.5in CMR drive, 5400 RPM, 4TB." },
  { id: "wd-red-plus-8tb", name: "WD Red Plus 8TB", modelNumber: "WD80EFPX", brand: "Western Digital", category: "Storage", description: "NAS-grade 3.5in CMR drive, 5640 RPM, 8TB." },
  { id: "seagate-ironwolf-8tb", name: "Seagate IronWolf 8TB", modelNumber: "ST8000VN004", brand: "Seagate", category: "Storage", description: "NAS-optimized 3.5in CMR drive, 7200 RPM, 8TB." },
  { id: "seagate-ironwolf-pro-12tb", name: "Seagate IronWolf Pro 12TB", modelNumber: "ST12000NT001", brand: "Seagate", category: "Storage", description: "Enterprise NAS 3.5in drive, 7200 RPM, 12TB." },
  { id: "synology-ds1823xs", name: "Synology DiskStation DS1823xs+", modelNumber: "DS1823xs+", brand: "Synology", category: "Storage", description: "8-bay NAS with AMD Ryzen V1780B and built-in 10GbE." },
  { id: "qnap-ts-673a", name: "QNAP TS-673A", modelNumber: "TS-673A", brand: "QNAP", category: "Storage", description: "6-bay NAS with AMD Ryzen V1500B and dual 2.5GbE." },
  { id: "ugreen-nasync-dxp4800", name: "UGREEN NASync DXP4800 Plus", modelNumber: "DXP4800 Plus", brand: "UGREEN", category: "Storage", description: "4-bay NAS with Intel Pentium Gold 8505 and 10GbE." },

  // ─── Networking Switches ───
  { id: "mikrotik-crs310", name: "MikroTik CRS310-1G-5S-4S+IN", modelNumber: "CRS310-1G-5S-4S+IN", brand: "MikroTik", category: "Networking Switch", description: "1x Gigabit Ethernet, 5x 1G SFP, 4x 10G SFP+ switch with RouterOS." },
  { id: "mikrotik-crs328", name: "MikroTik CRS328-24P-4S+RM", modelNumber: "CRS328-24P-4S+RM", brand: "MikroTik", category: "Networking Switch", description: "24x Gigabit PoE+ ports plus 4x SFP+ 10G, rackmount." },
  { id: "mikrotik-css326", name: "MikroTik CSS326-24G-2S+RM", modelNumber: "CSS326-24G-2S+RM", brand: "MikroTik", category: "Networking Switch", description: "24x Gigabit with 2x SFP+ 10G, SwOS, rackmount." },
  { id: "mikrotik-crs305", name: "MikroTik CRS305-1G-4S+IN", modelNumber: "CRS305-1G-4S+IN", brand: "MikroTik", category: "Networking Switch", description: "4x SFP+ 10G switch with one Gigabit port, fanless." },
  { id: "mikrotik-crs309", name: "MikroTik CRS309-1G-8S+IN", modelNumber: "CRS309-1G-8S+IN", brand: "MikroTik", category: "Networking Switch", description: "8x SFP+ 10G switch with one Gigabit port." },
  { id: "ubiquiti-usw-flex", name: "Ubiquiti UniFi Switch Flex", modelNumber: "USW-Flex", brand: "Ubiquiti", category: "Networking Switch", description: "5-port Gigabit PoE switch, weatherproof, powered by PoE++." },
  { id: "ubiquiti-usw-pro-24", name: "Ubiquiti UniFi Switch Pro 24", modelNumber: "USW-Pro-24", brand: "Ubiquiti", category: "Networking Switch", description: "24x Gigabit with 2x SFP+ 10G, managed by UniFi." },
  { id: "ubiquiti-usw-lite-16", name: "Ubiquiti UniFi Switch Lite 16 PoE", modelNumber: "USW-Lite-16-PoE", brand: "Ubiquiti", category: "Networking Switch", description: "16x Gigabit PoE with 2x SFP, fanless, compact." },
  { id: "ubiquiti-usw-aggregation", name: "Ubiquiti UniFi Switch Aggregation", modelNumber: "USW-Aggregation", brand: "Ubiquiti", category: "Networking Switch", description: "8x SFP+ 10G aggregation switch for backbone links." },
  { id: "tp-link-sg108", name: "TP-Link TL-SG108", modelNumber: "TL-SG108", brand: "TP-Link", category: "Networking Switch", description: "8-port unmanaged Gigabit switch, fanless metal case." },
  { id: "tp-link-sg3428", name: "TP-Link TL-SG3428", modelNumber: "TL-SG3428", brand: "TP-Link", category: "Networking Switch", description: "24x Gigabit L2 managed switch with 4x SFP." },
  { id: "aruba-instant-on-1930-24g", name: "Aruba Instant On 1930 24G", modelNumber: "JL682A", brand: "Aruba (HPE)", category: "Networking Switch", description: "24x Gigabit smart-managed switch with 4x SFP+." },
  { id: "netgear-gs308", name: "NETGEAR GS308", modelNumber: "GS308", brand: "NETGEAR", category: "Networking Switch", description: "8-port unmanaged Gigabit switch, fanless." },
  { id: "cisco-cbs350-24t-4g", name: "Cisco CBS350-24T-4G", modelNumber: "CBS350-24T-4G", brand: "Cisco", category: "Networking Switch", description: "24x Gigabit managed switch with 4x SFP." },
  { id: "fs-s3900-24t4s", name: "FS S3900-24T4S", modelNumber: "S3900-24T4S", brand: "FS.com", category: "Networking Switch", description: "24x Gigabit L2+ managed switch with 4x SFP." },

  // ─── Network Gateways ───
  { id: "ubiquiti-udm-se", name: "Ubiquiti UniFi Dream Machine SE", modelNumber: "UDM-SE", brand: "Ubiquiti", category: "Network Gateway", description: "All-in-one gateway, controller, and 8-port PoE switch with 10G SFP+." },
  { id: "ubiquiti-uxg-pro", name: "Ubiquiti UniFi Next-Gen Gateway Pro", modelNumber: "UXG-Pro", brand: "Ubiquiti", category: "Network Gateway", description: "Rackmount UniFi gateway with dual 10G SFP+ and Gigabit WAN." },
  { id: "ubiquiti-ucg-ultra", name: "Ubiquiti UniFi Cloud Gateway Ultra", modelNumber: "UCG-Ultra", brand: "Ubiquiti", category: "Network Gateway", description: "Compact UniFi gateway with 2.5GbE WAN and multi-WAN failover." },
  { id: "ubiquiti-uxg-lite", name: "Ubiquiti UniFi Gateway Lite", modelNumber: "UXG-Lite", brand: "Ubiquiti", category: "Network Gateway", description: "Entry UniFi gateway for small networks, 1GbE." },
  { id: "tp-link-er605", name: "TP-Link ER605", modelNumber: "ER605", brand: "TP-Link", category: "Network Gateway", description: "Omada multi-WAN Gigabit VPN router." },
  { id: "tp-link-er7206", name: "TP-Link ER7206", modelNumber: "ER7206", brand: "TP-Link", category: "Network Gateway", description: "Omada multi-WAN Gigabit VPN router with SFP." },
  { id: "mikrotik-rb4011", name: "MikroTik RB4011iGS+RM", modelNumber: "RB4011iGS+RM", brand: "MikroTik", category: "Network Gateway", description: "10x Gigabit router with SFP+ 10G, rackmount, RouterOS." },
  { id: "gl-inet-flint-2", name: "GL.iNet Flint 2", modelNumber: "GL-MT6000", brand: "GL.iNet", category: "Network Gateway", description: "Wi-Fi 6 router with 2.5GbE ports and OpenWrt." },

  // ─── Wireless Bridges / Access Points ───
  { id: "ubiquiti-u7-pro", name: "Ubiquiti UniFi U7 Pro", modelNumber: "U7-Pro", brand: "Ubiquiti", category: "Wireless Bridge", description: "Wi-Fi 7 access point with 2.5GbE uplink and 6GHz band." },
  { id: "ubiquiti-u7-pro-wall", name: "Ubiquiti UniFi U7 Pro Wall", modelNumber: "U7-Pro-Wall", brand: "Ubiquiti", category: "Wireless Bridge", description: "Wall-mounted Wi-Fi 7 access point with 2.5GbE." },
  { id: "ubiquiti-u6-plus", name: "Ubiquiti UniFi U6+", modelNumber: "U6+", brand: "Ubiquiti", category: "Wireless Bridge", description: "Wi-Fi 6 access point with Gigabit uplink." },
  { id: "ubiquiti-u6-lite", name: "Ubiquiti UniFi U6 Lite", modelNumber: "U6-Lite", brand: "Ubiquiti", category: "Wireless Bridge", description: "Compact Wi-Fi 6 access point for small spaces." },
  { id: "ubiquiti-u6-enterprise", name: "Ubiquiti UniFi U6 Enterprise", modelNumber: "U6-Enterprise", brand: "Ubiquiti", category: "Wireless Bridge", description: "Tri-band Wi-Fi 6E access point with 2.5GbE." },
  { id: "ubiquiti-u6-mesh", name: "Ubiquiti UniFi U6 Mesh", modelNumber: "U6-Mesh", brand: "Ubiquiti", category: "Wireless Bridge", description: "Outdoor-rated Wi-Fi 6 mesh access point." },
  { id: "tp-link-eap610", name: "TP-Link EAP610", modelNumber: "EAP610", brand: "TP-Link", category: "Wireless Bridge", description: "Omada Wi-Fi 6 ceiling access point with Gigabit uplink." },
  { id: "tp-link-eap653", name: "TP-Link EAP653", modelNumber: "EAP653", brand: "TP-Link", category: "Wireless Bridge", description: "Omada Wi-Fi 6 access point with Gigabit uplink." },

  // ─── Network Cards ───
  { id: "intel-x520-da2", name: "Intel X520-DA2", modelNumber: "X520-DA2", brand: "Intel", category: "Network Card", description: "Dual-port SFP+ 10G PCIe NIC, a homelab staple." },
  { id: "intel-x550-t2", name: "Intel X550-T2", modelNumber: "X550-T2", brand: "Intel", category: "Network Card", description: "Dual-port 10GBASE-T PCIe NIC." },
  { id: "intel-x540-t2", name: "Intel X540-T2", modelNumber: "X540-T2", brand: "Intel", category: "Network Card", description: "Dual-port 10GBASE-T PCIe NIC, widely available used." },
  { id: "intel-i225-t1", name: "Intel i225-T1", modelNumber: "I225-T1", brand: "Intel", category: "Network Card", description: "Single-port 2.5GbE PCIe NIC." },
  { id: "mellanox-connectx-4-lx", name: "Mellanox ConnectX-4 Lx", modelNumber: "MCX4121A-ACAT", brand: "NVIDIA/Mellanox", category: "Network Card", description: "Dual-port SFP28 25G PCIe NIC with RoCE." },
  { id: "mellanox-connectx-5", name: "Mellanox ConnectX-5", modelNumber: "MCX515A-CCAT", brand: "NVIDIA/Mellanox", category: "Network Card", description: "Single-port QSFP28 100G PCIe NIC." },
  { id: "mellanox-connectx-6-lx", name: "Mellanox ConnectX-6 Lx", modelNumber: "MCX631102AS-ADAT", brand: "NVIDIA/Mellanox", category: "Network Card", description: "Dual-port SFP28 25G PCIe 4.0 NIC with IPsec." },

  // ─── Mini-PCs (Desktop) ───
  { id: "intel-nuc-13-pro", name: "Intel NUC 13 Pro", modelNumber: "NUC13ANHi7", brand: "Intel", category: "Desktop", description: "Compact mini-PC with Core i7-1360P, dual Thunderbolt 4." },
  { id: "intel-nuc-12-pro", name: "Intel NUC 12 Pro", modelNumber: "NUC12WSHi7", brand: "Intel", category: "Desktop", description: "Mini-PC with Core i7-1260P and 2.5GbE." },
  { id: "asus-nuc-14-pro", name: "ASUS NUC 14 Pro", modelNumber: "NUC14RVH", brand: "ASUS", category: "Desktop", description: "Mini-PC with Core Ultra 7 and dual 2.5GbE." },
  { id: "minisforum-um790-pro", name: "Minisforum UM790 Pro", modelNumber: "UM790 Pro", brand: "Minisforum", category: "Desktop", description: "Ryzen 9 7940HS mini-PC with dual 2.5GbE and USB4." },
  { id: "minisforum-ms-01", name: "Minisforum MS-01", modelNumber: "MS-01", brand: "Minisforum", category: "Desktop", description: "Homelab mini-PC with dual 10G SFP+, dual 2.5GbE, and PCIe slot." },
  { id: "beelink-ser7", name: "Beelink SER7", modelNumber: "SER7", brand: "Beelink", category: "Desktop", description: "Ryzen 7 7840HS mini-PC with dual 2.5GbE." },
  { id: "beelink-gtr7", name: "Beelink GTR7", modelNumber: "GTR7", brand: "Beelink", category: "Desktop", description: "Ryzen 7 7840HS mini-PC with dual 2.5GbE and USB4." },
  { id: "gmktec-nucbox-k8", name: "GMKtec NucBox K8", modelNumber: "NucBox K8", brand: "GMKtec", category: "Desktop", description: "Ryzen 7 8845HS mini-PC with dual 2.5GbE." },
  { id: "asrock-4x4-7840u", name: "ASRock 4X4 BOX-7840U", modelNumber: "4X4 BOX-7840U", brand: "ASRock", category: "Desktop", description: "Ryzen 7 7840U mini-PC with dual 2.5GbE." },

  // ─── UPS ───
  { id: "apc-back-ups-pro-1500", name: "APC Back-UPS Pro 1500VA", modelNumber: "BR1500MS2", brand: "APC", category: "UPS", description: "1500VA/900W line-interactive UPS with AVR and USB." },
  { id: "apc-smart-ups-1500", name: "APC Smart-UPS 1500VA", modelNumber: "SMT1500C", brand: "APC", category: "UPS", description: "1500VA/1000W LCD UPS with pure sine wave output." },
  { id: "cyberpower-cp1500", name: "CyberPower CP1500PFCLCD", modelNumber: "CP1500PFCLCD", brand: "CyberPower", category: "UPS", description: "1500VA/1000W PFC sine-wave UPS with LCD." },

  // ─── Cooling ───
  { id: "noctua-nf-a12x25", name: "Noctua NF-A12x25 PWM", modelNumber: "NF-A12x25", brand: "Noctua", category: "Cooling", description: "120mm premium quiet case/radiator fan." },
  { id: "noctua-nf-a14", name: "Noctua NF-A14 PWM", modelNumber: "NF-A14", brand: "Noctua", category: "Cooling", description: "140mm premium quiet case fan." },
  { id: "arctic-mx-6", name: "Arctic MX-6 Thermal Paste", modelNumber: "MX-6", brand: "Arctic", category: "Cooling", description: "High-performance CPU thermal compound, 4g." },
];

export const SEARCH_OPTIONS: IFuseOptions<(typeof PRODUCT_CATALOG)[number]> = {
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
};

// No price on catalog items; fall back to name for deterministic order but keep chip parity
export function sortCatalogByPrice(items: typeof PRODUCT_CATALOG): typeof PRODUCT_CATALOG {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function buildFuse(catalog: typeof PRODUCT_CATALOG) {
  return new Fuse(catalog, SEARCH_OPTIONS);
}

export function searchCatalog(query: string): typeof PRODUCT_CATALOG {
  if (!query.trim()) return PRODUCT_CATALOG;
  return buildFuse(PRODUCT_CATALOG).search(query).map((result) => result.item);
}

export async function getAllCatalog() {
  return [...PRODUCT_CATALOG];
}

export function getAllCategories(): string[] {
  return [...new Set(PRODUCT_CATALOG.map((p) => p.category))].sort();
}

export function getAllBrands(): string[] {
  return [...new Set(PRODUCT_CATALOG.map((p) => p.brand))].sort();
}
