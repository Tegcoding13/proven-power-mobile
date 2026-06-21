import { XMLParser } from "fast-xml-parser";
import type { EquipmentCategory, InventoryStatus } from "@proven-power/shared-types";
import { supabaseAdmin } from "./supabase-admin.js";

const FEED_URL = "https://provenpower.com/wp-json/mfp/v1/feed";
const EXTERNAL_SOURCE = "machinefinder";

const CATEGORY_MAP: Record<string, EquipmentCategory> = {
  "compact utility tractors": "tractor",
  "utility tractors": "tractor",
  "tractors": "tractor",
  "riding lawn equipment": "mower",
  "riding lawnmowers": "mower",
  "zero-turn mowers": "mower",
  "commercial mowing": "mower",
  "mowers": "mower",
  "gators": "utility_vehicle",
  "gator utility vehicles": "utility_vehicle",
  "utility vehicles": "utility_vehicle",
  "attachments": "attachment",
  "implements": "attachment",
};

function mapCategory(rawCategory: string | undefined): EquipmentCategory {
  if (!rawCategory) return "other";
  return CATEGORY_MAP[rawCategory.trim().toLowerCase()] ?? "other";
}

function mapStatus(statusKey: string | undefined): InventoryStatus {
  const key = (statusKey ?? "").toLowerCase();
  if (key.includes("sold")) return "sold";
  if (key.includes("pending") || key.includes("hold")) return "pending";
  return "available";
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

interface RawMachineImage {
  filePointerLarge?: string;
  filePointer?: string;
}

interface RawMachine {
  id: string | number;
  description?: string;
  advertised_price?: { amount?: string | number };
  dealerId?: string | number;
  category?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  modelYear?: string | number;
  isNew?: boolean | string;
  stockNumber?: string;
  status?: { key?: string };
  images?: { image?: RawMachineImage | RawMachineImage[] };
}

export interface MachineFinderSyncResult {
  fetched: number;
  upserted: number;
  errors: string[];
}

export async function syncMachineFinderInventory(): Promise<MachineFinderSyncResult> {
  const response = await fetch(FEED_URL, { headers: { Accept: "application/xml" } });
  if (!response.ok) {
    throw new Error(`MachineFinder feed request failed: ${response.status} ${response.statusText}`);
  }
  const xml = await response.text();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const machines = asArray<RawMachine>(parsed?.machines?.machine);

  const { data: locations } = await supabaseAdmin
    .from("dealership_locations")
    .select("id, machinefinder_dealer_id");
  const locationByDealerId = new Map(
    (locations ?? [])
      .filter((loc) => loc.machinefinder_dealer_id)
      .map((loc) => [loc.machinefinder_dealer_id as string, loc.id])
  );

  const errors: string[] = [];
  let upserted = 0;

  for (const machine of machines) {
    try {
      const externalId = String(machine.id);
      const make = machine.manufacturer?.trim() || "John Deere";
      const model = machine.model?.trim() || "Equipment";
      const modelYear = machine.modelYear ? Number(machine.modelYear) : null;
      const title = [modelYear, make, model].filter(Boolean).join(" ");

      const { data: listing, error: listingError } = await supabaseAdmin
        .from("inventory_listings")
        .upsert(
          {
            external_source: EXTERNAL_SOURCE,
            external_id: externalId,
            dealership_location_id: machine.dealerId
              ? (locationByDealerId.get(String(machine.dealerId)) ?? null)
              : null,
            category: mapCategory(machine.category),
            make,
            model,
            model_year: modelYear,
            title,
            description: machine.description?.trim() || null,
            price: machine.advertised_price?.amount ? Number(machine.advertised_price.amount) : null,
            condition: "used",
            status: mapStatus(machine.status?.key),
            stock_number: machine.stockNumber?.trim() || null,
          },
          { onConflict: "external_source,external_id" }
        )
        .select("id")
        .single();

      if (listingError || !listing) {
        errors.push(`Machine ${externalId}: ${listingError?.message ?? "no listing returned"}`);
        continue;
      }

      const photoUrls = asArray<RawMachineImage>(machine.images?.image)
        .map((img) => textOf(img.filePointerLarge) ?? textOf(img.filePointer))
        .filter((url): url is string => Boolean(url));

      await supabaseAdmin.from("inventory_listing_photos").delete().eq("listing_id", listing.id);
      if (photoUrls.length > 0) {
        await supabaseAdmin.from("inventory_listing_photos").insert(
          photoUrls.map((external_url) => ({ listing_id: listing.id, external_url }))
        );
      }

      upserted += 1;
    } catch (err) {
      errors.push(`Machine ${machine.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { fetched: machines.length, upserted, errors };
}
