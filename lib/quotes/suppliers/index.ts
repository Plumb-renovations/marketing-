import type { SupplierConfig } from "./types";
import { NAGA } from "./naga";

// The supplier registry. Add a new supplier by writing its config (column
// mapping / category rule / pricing rule live inside the config's parse() +
// derivesCostFromRrp) and registering it here — the import flow is unchanged.
//
// Example next supplier (Millennium / tapware): a config with
// derivesCostFromRrp:false whose parse() reads RRP + a cost tier column and
// returns costEx per row, with Tapware/Showers categories.
export const SUPPLIERS: SupplierConfig[] = [NAGA];

export function getSupplier(id: string): SupplierConfig | undefined {
  return SUPPLIERS.find((s) => s.id === id);
}

export * from "./types";
export { parseGrid } from "./csv";
