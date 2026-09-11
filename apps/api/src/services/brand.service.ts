import * as brandRepository from "../repositories/brand.repository.js";

export function listBrands(workspaceId: string) {
  return brandRepository.findAllByWorkspace(workspaceId);
}
