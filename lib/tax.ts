const COUNTRY_TAX_RATES: Record<string, number> = {
  Australia: 0.1,
  Canada: 0.13,
  "Czech Republic": 0.21,
  "European Union": 0.2,
  Germany: 0.19,
  Greece: 0.24,
  Malaysia: 0,
  "New Zealand": 0.15,
  Poland: 0.23,
  "South Africa": 0.15,
  UAE: 0,
  "United Kingdom": 0.2,
  "United States": 0,
};

export function getTaxRate(country: string): number {
  // Own-property check: `COUNTRY_TAX_RATES["toString"]` returns an inherited
  // function, which would make the tax amount NaN.
  return Object.prototype.hasOwnProperty.call(COUNTRY_TAX_RATES, country)
    ? COUNTRY_TAX_RATES[country]!
    : 0;
}
