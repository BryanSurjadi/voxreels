import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const storageDirectory = fileURLToPath(new URL("../../storage/", import.meta.url));

export async function storeMedia(data: Buffer, extension: string) {
  const storageKey = `${randomUUID()}.${extension}`;
  await mkdir(storageDirectory, { recursive: true });
  await writeFile(join(storageDirectory, storageKey), data);
  return storageKey;
}

export function readMedia(storageKey: string) {
  if (basename(storageKey) !== storageKey || dirname(storageKey) !== ".") {
    throw new Error("Invalid media storage key");
  }
  return readFile(join(storageDirectory, storageKey));
}
