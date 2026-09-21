import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const storageDirectory = fileURLToPath(new URL("../../storage/", import.meta.url));

export function mediaPath(storageKey: string) {
  if (basename(storageKey) !== storageKey || dirname(storageKey) !== ".") {
    throw new Error("Invalid media storage key");
  }
  return join(storageDirectory, storageKey);
}

export async function reserveMediaPath(extension: string) {
  const storageKey = `${randomUUID()}.${extension}`;
  await mkdir(storageDirectory, { recursive: true });
  return { storageKey, path: mediaPath(storageKey) };
}

export async function storeMedia(data: Buffer, extension: string) {
  const { storageKey, path } = await reserveMediaPath(extension);
  await writeFile(path, data);
  return storageKey;
}

export function readMedia(storageKey: string) {
  return readFile(mediaPath(storageKey));
}
