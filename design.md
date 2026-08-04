# Stock Tracker Pro — Design Document

## App Overview

A professional mobile app for tracking product availability and prices across 50+ global electronics distributors. Target users are IT professionals, procurement teams, and electronics enthusiasts who need to monitor hard-to-find products globally.

## Brand Identity

- **App Name:** Stock Tracker Pro
- **Tagline:** "Never miss a deal. Never miss a restock."
- **Primary Color:** #0F52BA (Sapphire Blue) — professional, trustworthy
- **Accent Color:** #00C896 (Emerald Green) — in-stock status, positive signals
- **Warning Color:** #F59E0B (Amber) — price changes, back-order
- **Error Color:** #EF4444 (Red) — out of stock
- **Background:** #0A0E1A (Deep Navy) dark / #F8FAFC light
- **Surface:** #131929 dark / #FFFFFF light
- **Typography:** System font (SF Pro on iOS, Roboto on Android)

## Screen List

### 1. Home / Dashboard (index)

- Summary cards: Total tracked items, In-stock count, Price alerts triggered
- Recent activity feed (stock changes, price drops)
- Quick-add product button (FAB)
- Pull-to-refresh for live updates

### 2. Watchlist (watchlist)

- All tracked products in a filterable list
- Each card shows: product name, best price, stock status badge, distributor count
- Sort by: name, price, date added, stock status
- Swipe to delete, tap to view details

### 3. Product Detail (product/[id])

- Product header with image, name, model number
- Stock status across all distributors (table view)
- Price history chart (sparkline)
- Set price alert button
- Open in browser button for each distributor
- Share product button

### 4. Search / Add Product (search)

- Search by model number or product name
- Pre-loaded catalog of popular networking/electronics products
- Manual add with URL
- Recent searches

### 5. Alerts (alerts)

- List of all active price/stock alerts
- Toggle alerts on/off
- Alert history (triggered alerts)
- Notification settings

### 6. Settings (settings)

- App theme (light/dark/auto)
- Notification preferences
- Check interval (manual / hourly / daily)
- Currency display preference
- About / version info
- Rate the app
- Privacy policy

## Key User Flows

### Flow 1: Add a Product to Watchlist

Home → FAB (+) → Search screen → Type model number → Select from results → Product added to watchlist → Confirmation toast

### Flow 2: Check Stock Status

Watchlist → Tap product card → Product Detail screen → View all distributors with stock status → Tap distributor → Opens in browser

### Flow 3: Set a Price Alert

Product Detail → "Set Alert" button → Enter target price → Confirm → Alert saved → Notification when price drops below threshold

### Flow 4: View Price History

Product Detail → Scroll to price chart → View 7/30/90 day history → Identify best buying time

## Navigation Structure

Bottom Tab Bar (4 tabs):

1. **Home** (house icon) — Dashboard
2. **Watchlist** (list icon) — All tracked products
3. **Alerts** (bell icon) — Notifications & alerts
4. **Settings** (gear icon) — App settings

## Component Design

### Product Card

- Rounded corners (12px), subtle shadow
- Left: product thumbnail or category icon
- Center: product name (bold), model number (muted), best price (large, colored)
- Right: stock status badge (green/amber/red pill)
- Bottom row: distributor count, last checked timestamp

### Distributor Row

- Distributor name + country flag emoji
- Price in local currency + converted THB
- Stock status badge
- "Visit" button (external link)

### Stock Status Badge

- ✅ Green pill: "In Stock"
- 🟡 Amber pill: "Back Order" + expected date
- 🔴 Red pill: "Out of Stock"
- ⚪ Gray pill: "Unknown"

## Pre-loaded Distributor Database (50+ sites)

Regions covered: USA, Europe (UK, Germany, Poland, Greece, EU), Asia-Pacific (Malaysia, Singapore, Hong Kong, Australia), Middle East (UAE), Africa (South Africa)

Key distributors pre-loaded:

- Server2U (Malaysia)
- Linitx (UK)
- Inter Projekt (Poland)
- NAS Store EU
- Aerial.net (Greece)
- MikroTik Store EU (Germany)
- MiRO (South Africa)
- Gear-Up.me (UAE)
- Baltic Networks (USA/Canada)
- Link Technologies (USA)
- Winncom (USA)
- B&H Photo (USA)
- DuxTel (Australia)
- WISP (Australia)
- PB Tech (New Zealand)
- GoWiFi (New Zealand)
- Getic (Greece)
- 100MEGA (Czech Republic)
- HellasCom (Greece)
- ROC-NOC (USA)

## Pre-loaded Product Catalog

Initial catalog focused on MikroTik and networking equipment:

- MikroTik CRS804-4DDQ-hRM (400G Switch)
- MikroTik CCR2216-1G-12XS-2XQ
- MikroTik CRS518-16XS-2XQ
- MikroTik RB5009UG+S+IN
- MikroTik hEX S
- Ubiquiti UniFi Dream Machine Pro
- Ubiquiti UniFi Switch Pro 48
- Intel X710-DA2 NIC
- Mellanox ConnectX-6
