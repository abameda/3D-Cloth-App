import { z } from 'zod';
import { categories } from './types';

/**
 * Studio: the Windows asset factory builds a personal body from measurements and drapes owned garments
 * on it. The phone sends measurements/specs and downloads finished, skinned GLBs.
 */
export const bodyProfileSchema = z.object({
  sex: z.enum(['male', 'female']),
  age: z.number().int().min(16).max(90),
  height_cm: z.number().min(130).max(220),
  weight_kg: z.number().min(35).max(200).optional(),
  chest_cm: z.number().min(60).max(160).optional(),
  waist_cm: z.number().min(50).max(160).optional(),
  hips_cm: z.number().min(60).max(170).optional(),
  skin_rgb: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
}).strict();
export type BodyProfile = z.infer<typeof bodyProfileSchema>;

export const garmentPresets = ['tshirt', 'longsleeve', 'overshirt', 'trousers', 'shorts', 'skirt'] as const;
/** Draping-capable wardrobe categories and their default pattern presets. */
export const presetForCategory: Partial<Record<typeof categories[number], typeof garmentPresets[number]>> = {
  top: 'tshirt', bottom: 'trousers', outerwear: 'overshirt',
};
export const garmentSpecSchema = z.object({
  preset: z.enum(garmentPresets),
  // Dotted GarmentCode parameters; ranges are re-validated by the factory against GarmentCode's schema.
  params: z.record(z.string().regex(/^[a-z_-]+(\.[a-z_-]+){1,2}$/), z.union([z.number().finite(), z.boolean(), z.string().max(40), z.null()])).optional(),
}).strict();
export type GarmentSpec = z.infer<typeof garmentSpecSchema>;

export const garmentRequestSchema = z.object({
  garmentId: z.string().min(1).max(200),
  category: z.enum(categories),
  spec: garmentSpecSchema.optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict().refine(value => !!value.spec || !!presetForCategory[value.category], { message: 'This category cannot be draped yet.' });
export type GarmentRequest = z.infer<typeof garmentRequestSchema>;

const assetSchema = z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/), bytes: z.number().int().positive() });
export const studioJobSchema = z.object({
  id: z.string().uuid(), kind: z.enum(['body', 'garment']), garmentId: z.string().optional(),
  status: z.enum(['queued', 'running', 'done', 'failed']), stage: z.string(), error: z.string().nullable(), updated: z.number(),
});
export type StudioJob = z.infer<typeof studioJobSchema>;
/** Accessories produced with the body: hair and colour-matched shoe stand-ins. */
export const accessoryNameSchema = z.string().regex(/^(hair|shoes_shoes0[1-6])$/);
export const kitManifestSchema = z.object({
  body: assetSchema.extend({ profile: bodyProfileSchema }).nullable(),
  accessories: z.array(assetSchema.extend({ name: accessoryNameSchema, category: z.enum(['hair', 'shoes']), colors: z.array(z.string()).max(13) })).default([]),
  garments: z.array(assetSchema.extend({ garmentId: z.string(), category: z.enum(categories), bodySha256: z.string() })),
  jobs: z.array(studioJobSchema),
});
export type KitManifest = z.infer<typeof kitManifestSchema>;

export const studioStages = {
  queued: 'Waiting for your computer', fitting_body: 'Fitting your body to your measurements',
  sewing: 'Sewing the pattern', draping: 'Draping on your body', rigging: 'Preparing it for your phone',
  done: 'Ready', failed: 'Stopped',
} as const;

/**
 * What a vision model can reliably read from a garment photo. A deterministic mapping turns it into
 * GarmentCode parameters, so model output can never request out-of-range or unsupported geometry.
 */
export const garmentShapeSchema = z.object({
  silhouette: z.enum(garmentPresets),
  sleeve: z.enum(['none', 'short', 'elbow', 'long']).optional(),
  length: z.enum(['cropped', 'waist', 'hip', 'thigh', 'above_knee', 'knee', 'calf', 'ankle']).optional(),
  fit: z.enum(['slim', 'regular', 'loose']).optional(),
  neckline: z.enum(['crew', 'v', 'square', 'scoop']).optional(),
}).strict();
export type GarmentShape = z.infer<typeof garmentShapeSchema>;

const upperLength: Partial<Record<NonNullable<GarmentShape['length']>, number>> = { cropped: 1.0, waist: 1.2, hip: 1.5, thigh: 1.9 };
const pantsLength: Partial<Record<NonNullable<GarmentShape['length']>, number>> = { thigh: 0.25, above_knee: 0.35, knee: 0.5, calf: 0.72, ankle: 0.88 };
const skirtLength: Partial<Record<NonNullable<GarmentShape['length']>, number>> = { thigh: 0.3, above_knee: 0.4, knee: 0.55, calf: 0.75, ankle: 0.95 };
const sleeveLength = { short: 0.3, elbow: 0.55, long: 0.95 } as const;
const neck = { crew: 'CircleNeckHalf', v: 'VNeckHalf', square: 'SquareNeckHalf', scoop: 'CurvyNeckHalf' } as const;
const width = { slim: 1.0, regular: 1.05, loose: 1.2 } as const;

export function specFromShape(shape: GarmentShape): GarmentSpec {
  const params: Record<string, number | boolean | string> = {};
  const upper = ['tshirt', 'longsleeve', 'overshirt'].includes(shape.silhouette);
  if (upper) {
    if (shape.length && upperLength[shape.length]) params['shirt.length'] = upperLength[shape.length]!;
    if (shape.fit) params['shirt.width'] = width[shape.fit];
    if (shape.sleeve === 'none') params['sleeve.sleeveless'] = true;
    else if (shape.sleeve) { params['sleeve.sleeveless'] = false; params['sleeve.length'] = sleeveLength[shape.sleeve]; }
    if (shape.neckline) params['collar.f_collar'] = neck[shape.neckline];
  } else if (shape.silhouette === 'skirt') {
    if (shape.length && skirtLength[shape.length]) params['pencil-skirt.length'] = skirtLength[shape.length]!;
    if (shape.fit) params['pencil-skirt.flare'] = { slim: 0.9, regular: 1.0, loose: 1.3 }[shape.fit];
  } else {
    if (shape.length && pantsLength[shape.length]) params['pants.length'] = pantsLength[shape.length]!;
    if (shape.fit) { params['pants.width'] = { slim: 1.0, regular: 1.1, loose: 1.3 }[shape.fit]; params['pants.flare'] = { slim: 0.85, regular: 1.0, loose: 1.0 }[shape.fit]; }
  }
  return { preset: shape.silhouette, params };
}
