"use server";

import { revalidatePath } from "next/cache";
import { syncMachineFinderInventory, type MachineFinderSyncResult } from "../../lib/machinefinder-sync";

export async function syncMachineFinder(): Promise<MachineFinderSyncResult> {
  const result = await syncMachineFinderInventory();
  revalidatePath("/inventory");
  return result;
}
