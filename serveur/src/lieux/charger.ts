import { readFile } from "node:fs/promises";
import { z } from "zod";
import { IndexLieux } from "./categories.js";

const schemaLieux = z.array(
  z.object({
    n: z.string().min(1),
    k: z.string().min(1),
    c: z.array(z.string()).optional(),
    v: z.string().optional(),
    la: z.number().min(-90).max(90),
    lo: z.number().min(-180).max(180),
  }),
);

/** Charge `lieux.json` (D61), validé par Zod (invariant 9). */
export async function chargerLieux(chemin: string): Promise<IndexLieux> {
  return new IndexLieux(schemaLieux.parse(JSON.parse(await readFile(chemin, "utf8"))));
}
