import { z } from 'zod';

export const captureViewSchema=z.object({label:z.string().min(1).max(80),yaw:z.number().finite().min(-Math.PI).max(Math.PI)}).strict();

export const reconstructionInputSchema=z.object({
  requestId:z.string().uuid(),kind:z.enum(['face','body','garment']),garmentId:z.string().min(1).max(200).optional(),
  consent:z.literal(true),images:z.array(z.string().max(4*1024*1024)).min(8).max(48),
  views:z.array(captureViewSchema).min(8).max(48).optional(),
}).strict().refine(value=>value.kind!=='garment'||!!value.garmentId,{message:'Choose the clothing piece for this capture.'})
 .refine(value=>!value.views||value.views.length===value.images.length,{message:'Each photo needs its own view label.'});
export type ReconstructionInput=z.infer<typeof reconstructionInputSchema>;
export const reconstructionStages={
  queued:'Waiting for your computer',checking_photos:'Checking your photos',aligning_features:'Finding shared details',
  matching_views:'Matching your views',measuring_geometry:'Measuring the 3D shape',checking_coverage:'Checking captured angles',
  preparing_depth:'Preparing depth reconstruction',building_scene:'Building the measured scene',
  reconstructing_surface:'Reconstructing the surface',cleaning_mesh:'Cleaning the geometry',texturing:'Rebuilding real surface colors',
  optimizing_mobile_asset:'Preparing the model for your phone',reconstructed:'Photo-based surface ready',failed:'Processing stopped',cancelled:'Cancelled',
} as const;
export type ReconstructionStage=keyof typeof reconstructionStages;
export const reconstructionJobSchema=z.object({id:z.string().uuid(),kind:z.enum(['face','body','garment']),garmentId:z.string().optional(),
  photoCount:z.number().int().min(0).max(48).optional(),views:z.array(captureViewSchema).max(48).optional(),
  status:z.enum(['queued','processing','reconstructed','failed','cancelled']),stage:z.string(),error:z.string().nullable(),attempt:z.number().int(),
  quality:z.object({triangles:z.number(),textures:z.number(),photos:z.number(),bytes:z.number(),sha256:z.string(),geometry:z.literal('measured_multi_view'),texture:z.literal('photographed_atlas'),identity_verified:z.literal(false),fit_status:z.enum(['not_fitted','not_applicable']),body_reconstructed:z.boolean()}).optional(),
});
export type ReconstructionJob=z.infer<typeof reconstructionJobSchema>;
