import { Router } from "express";
import { requireManager, type AuthedRequest } from "../middleware/require-manager.js";
import { syncMachineFinderInventory } from "../lib/machinefinder-sync.js";

export const inventoryRouter = Router();

// Pulls Proven Power's real used-equipment listings from John Deere's
// MachineFinder feed (provenpower.com/wp-json/mfp/v1/feed) and upserts them
// into inventory_listings, keyed by (external_source, external_id).
inventoryRouter.post("/sync-machinefinder", requireManager, async (_req: AuthedRequest, res) => {
  try {
    const result = await syncMachineFinderInventory();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Sync failed." });
  }
});
