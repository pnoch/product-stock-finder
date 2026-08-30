import Fuse from "fuse.js";
import { Product } from "./types";

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
