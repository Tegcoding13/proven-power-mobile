import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadEquipmentPhoto } from "./equipment-photos";

const OUTBOX_KEY = "proven-power:photo-outbox";

export interface PendingPhoto {
  id: string;
  businessAccountId: string;
  equipmentId: string;
  localUri: string;
  uploadedByProfileId: string;
  caption?: string;
  createdAt: number;
}

async function readOutbox(): Promise<PendingPhoto[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  return raw ? (JSON.parse(raw) as PendingPhoto[]) : [];
}

async function writeOutbox(items: PendingPhoto[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

/** Called when an immediate upload attempt fails (e.g. no connectivity). */
export async function enqueuePendingPhoto(photo: Omit<PendingPhoto, "id" | "createdAt">): Promise<void> {
  const items = await readOutbox();
  items.push({ ...photo, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: Date.now() });
  await writeOutbox(items);
}

export async function getPendingPhotosForEquipment(equipmentId: string): Promise<PendingPhoto[]> {
  const items = await readOutbox();
  return items.filter((item) => item.equipmentId === equipmentId);
}

/** Retries every queued photo upload; call on reconnect or screen focus. */
export async function flushPendingPhotos(): Promise<void> {
  const items = await readOutbox();
  if (items.length === 0) return;

  const stillPending: PendingPhoto[] = [];

  for (const item of items) {
    try {
      await uploadEquipmentPhoto({
        businessAccountId: item.businessAccountId,
        equipmentId: item.equipmentId,
        localUri: item.localUri,
        uploadedByProfileId: item.uploadedByProfileId,
        caption: item.caption,
      });
    } catch {
      stillPending.push(item);
    }
  }

  await writeOutbox(stillPending);
}
