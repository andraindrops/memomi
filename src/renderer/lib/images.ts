import { api } from "@/renderer/lib/api";

export async function uploadImage({
  imageFile,
}: {
  imageFile: File | null;
}): Promise<string | undefined> {
  if (imageFile == null) return undefined;

  const buffer = await imageFile.arrayBuffer();
  return api.images.save({
    name: imageFile.name,
    bytes: new Uint8Array(buffer),
  });
}
