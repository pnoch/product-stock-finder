export interface Country {
  code: string;
  name: string;
  currency: string;
  region: string;
}

export const COUNTRIES: Country[] = [
  { code: "TH", name: "Thailand", currency: "THB", region: "Asia-Pacific" },
  { code: "SG", name: "Singapore", currency: "SGD", region: "Asia-Pacific" },
  { code: "MY", name: "Malaysia", currency: "MYR", region: "Asia-Pacific" },
  { code: "AU", name: "Australia", currency: "AUD", region: "Asia-Pacific" },
  { code: "NZ", name: "New Zealand", currency: "NZD", region: "Asia-Pacific" },
  { code: "JP", name: "Japan", currency: "JPY", region: "Asia-Pacific" },
  { code: "KR", name: "South Korea", currency: "KRW", region: "Asia-Pacific" },
  { code: "IN", name: "India", currency: "INR", region: "Asia-Pacific" },
  { code: "HK", name: "Hong Kong", currency: "HKD", region: "Asia-Pacific" },
  { code: "PH", name: "Philippines", currency: "PHP", region: "Asia-Pacific" },
  { code: "ID", name: "Indonesia", currency: "IDR", region: "Asia-Pacific" },
  { code: "VN", name: "Vietnam", currency: "VND", region: "Asia-Pacific" },
  { code: "TW", name: "Taiwan", currency: "TWD", region: "Asia-Pacific" },
  { code: "CN", name: "China", currency: "CNY", region: "Asia-Pacific" },
  { code: "PK", name: "Pakistan", currency: "PKR", region: "Asia-Pacific" },
  { code: "BD", name: "Bangladesh", currency: "BDT", region: "Asia-Pacific" },
  { code: "LK", name: "Sri Lanka", currency: "LKR", region: "Asia-Pacific" },
  { code: "NP", name: "Nepal", currency: "NPR", region: "Asia-Pacific" },
  { code: "KH", name: "Cambodia", currency: "KHR", region: "Asia-Pacific" },
  { code: "GB", name: "United Kingdom", currency: "GBP", region: "Europe" },
  { code: "DE", name: "Germany", currency: "EUR", region: "Europe" },
  { code: "FR", name: "France", currency: "EUR", region: "Europe" },
  { code: "GR", name: "Greece", currency: "EUR", region: "Europe" },
  { code: "PL", name: "Poland", currency: "PLN", region: "Europe" },
  { code: "CZ", name: "Czech Republic", currency: "CZK", region: "Europe" },
  { code: "ES", name: "Spain", currency: "EUR", region: "Europe" },
  { code: "IT", name: "Italy", currency: "EUR", region: "Europe" },
  { code: "NL", name: "Netherlands", currency: "EUR", region: "Europe" },
  { code: "SE", name: "Sweden", currency: "SEK", region: "Europe" },
  { code: "NO", name: "Norway", currency: "NOK", region: "Europe" },
  { code: "DK", name: "Denmark", currency: "DKK", region: "Europe" },
  { code: "FI", name: "Finland", currency: "EUR", region: "Europe" },
  { code: "IE", name: "Ireland", currency: "EUR", region: "Europe" },
  { code: "PT", name: "Portugal", currency: "EUR", region: "Europe" },
  { code: "AT", name: "Austria", currency: "EUR", region: "Europe" },
  { code: "BE", name: "Belgium", currency: "EUR", region: "Europe" },
  { code: "CH", name: "Switzerland", currency: "CHF", region: "Europe" },
  { code: "RO", name: "Romania", currency: "RON", region: "Europe" },
  { code: "HU", name: "Hungary", currency: "HUF", region: "Europe" },
  { code: "TR", name: "Turkey", currency: "TRY", region: "Europe" },
  { code: "UA", name: "Ukraine", currency: "UAH", region: "Europe" },
  { code: "RS", name: "Serbia", currency: "RSD", region: "Europe" },
  { code: "BG", name: "Bulgaria", currency: "EUR", region: "Europe" },
  { code: "HR", name: "Croatia", currency: "EUR", region: "Europe" },
  { code: "SK", name: "Slovakia", currency: "EUR", region: "Europe" },
  { code: "SI", name: "Slovenia", currency: "EUR", region: "Europe" },
  { code: "LT", name: "Lithuania", currency: "EUR", region: "Europe" },
  { code: "LV", name: "Latvia", currency: "EUR", region: "Europe" },
  { code: "EE", name: "Estonia", currency: "EUR", region: "Europe" },
  { code: "US", name: "United States", currency: "USD", region: "North America" },
  { code: "CA", name: "Canada", currency: "CAD", region: "North America" },
  { code: "MX", name: "Mexico", currency: "MXN", region: "North America" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", region: "Middle East" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", region: "Middle East" },
  { code: "IL", name: "Israel", currency: "ILS", region: "Middle East" },
  { code: "QA", name: "Qatar", currency: "QAR", region: "Middle East" },
  { code: "KW", name: "Kuwait", currency: "KWD", region: "Middle East" },
  { code: "ZA", name: "South Africa", currency: "ZAR", region: "Africa" },
  { code: "EG", name: "Egypt", currency: "EGP", region: "Africa" },
  { code: "KE", name: "Kenya", currency: "KES", region: "Africa" },
  { code: "NG", name: "Nigeria", currency: "NGN", region: "Africa" },
];

export function getCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function searchCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
  );
}
