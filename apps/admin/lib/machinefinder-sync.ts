import { XMLParser } from "fast-xml-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EquipmentCategory, InventoryStatus } from "@proven-power/shared-types";

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

function mapCategory(rawCategory: string | number | undefined): EquipmentCategory {
  const category = asTrimmedString(rawCategory);
  if (!category) return "other";
  return CATEGORY_MAP[category.toLowerCase()] ?? "other";
}

// The XML parser returns numbers for any element whose text content is purely
// digits (e.g. a stock number like "80370"), so every feed field that's
// nominally text needs this coercion before .trim() is safe to call.
function asTrimmedString(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
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
  description?: string | number;
  advertised_price?: { amount?: string | number };
  dealerId?: string | number;
  category?: string | number;
  manufacturer?: string | number;
  model?: string | number;
  modelYear?: string | number;
  stockNumber?: string | number;
  status?: { key?: string };
  images?: { image?: RawMachineImage | RawMachineImage[] };
}

export interface MachineFinderSyncResult {
  fetched: number;
  upserted: number;
  errors: string[];
  diagnostic?: string;
}

// Attempt to extract a machine array from any common MachineFinder XML root structure.
function extractMachines(parsed: Record<string, unknown>): RawMachine[] {
  // <machines><machine> — original expected format
  const fromMachines = (parsed?.machines as Record<string, unknown>)?.machine;
  if (fromMachines) return asArray<RawMachine>(fromMachines as RawMachine | RawMachine[]);

  // <ListingFeed><Listing> — John Deere MachineFinder standard export
  const fromFeed = (parsed?.ListingFeed as Record<string, unknown>)?.Listing;
  if (fromFeed) return asArray<RawMachine>(fromFeed as RawMachine | RawMachine[]);

  // <inventory><item>
  const fromInventory = (parsed?.inventory as Record<string, unknown>)?.item;
  if (fromInventory) return asArray<RawMachine>(fromInventory as RawMachine | RawMachine[]);

  // <rss><channel><item> — RSS feed format
  const rssItems = ((parsed?.rss as Record<string, unknown>)?.channel as Record<string, unknown>)?.item;
  if (rssItems) return asArray<RawMachine>(rssItems as RawMachine | RawMachine[]);

  return [];
}

export async function syncMachineFinderInventory(
  supabase: SupabaseClient<Database>
): Promise<MachineFinderSyncResult> {
  const response = await fetch(FEED_URL, { headers: { Accept: "application/xml, text/xml, */*" }, cache: "no-store" });
  if (!response.ok) {
    return { fetched: 0, upserted: 0, errors: [], diagnostic: `Feed HTTP ${response.status} ${response.statusText} — check that ${FEED_URL} is accessible` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const xml = await response.text();

  if (!xml.trim().startsWith("<") && !contentType.includes("xml")) {
    return { fetched: 0, upserted: 0, errors: [], diagnostic: `Feed returned non-XML content (${contentType}): ${xml.slice(0, 300)}` };
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const machines = extractMachines(parsed);

  const { data: locations } = await supabase.from("dealership_locations").select("id, machinefinder_dealer_id");
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
      const make = asTrimmedString(machine.manufacturer) ?? "John Deere";
      const model = asTrimmedString(machine.model) ?? "Equipment";
      const modelYear = machine.modelYear ? Number(machine.modelYear) : null;
      const title = [modelYear, make, model].filter(Boolean).join(" ");

      const { data: listing, error: listingError } = await supabase
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
            description: asTrimmedString(machine.description) ?? null,
            price: machine.advertised_price?.amount ? Number(machine.advertised_price.amount) : null,
            condition: "used",
            status: mapStatus(machine.status?.key),
            stock_number: asTrimmedString(machine.stockNumber) ?? null,
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

      await supabase.from("inventory_listing_photos").delete().eq("listing_id", listing.id);
      if (photoUrls.length > 0) {
        const { error: photoError } = await supabase
          .from("inventory_listing_photos")
          .insert(photoUrls.map((external_url) => ({ listing_id: listing.id, external_url })));
        if (photoError) {
          errors.push(`Machine ${externalId} photos: ${photoError.message}`);
        }
      }

      upserted += 1;
    } catch (err) {
      errors.push(`Machine ${machine.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const diagnostic = machines.length === 0
    ? `Feed parsed OK but found 0 machines. Root keys: ${Object.keys(parsed).join(", ")}. First 300 chars: ${xml.slice(0, 300)}`
    : undefined;

  return { fetched: machines.length, upserted, errors, diagnostic };
}
