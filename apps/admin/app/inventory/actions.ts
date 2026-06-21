"use server";

import { revalidatePath } from "next/cache";
import { syncMachineFinderInventory, type MachineFinderSyncResult } from "../../lib/machinefinder-sync";
import { createClient } from "../../lib/supabase/server";

export async function syncMachineFinder(): Promise<MachineFinderSyncResult> {
  const supabase = await createClient();
  const result = await syncMachineFinderInventory(supabase);
  revalidatePath("/inventory");
  return result;
}
