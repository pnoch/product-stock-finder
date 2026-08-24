// Price alerts may be scoped to a single distributor; evaluation must only
// consider that distributor's listings.
export function listingsForAlert<
  T extends { distributorId: string },
>(listings: T[], distributorId?: string): T[] {
  if (!distributorId) return listings;
  return listings.filter((l) => l.distributorId === distributorId);
}
