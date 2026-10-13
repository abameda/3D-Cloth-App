import {z} from 'zod';
export const capturePlanSchema=z.object({decision:z.enum(['proceed','retake']),
  guidance:z.array(z.string().min(1).max(200)).max(4),
  missingAngles:z.array(z.enum(['front','left','right','back','overlapping_views'])).max(5),
  pipeline:z.literal('local_multiview_photogrammetry'),
}).strict();
export type CapturePlan=z.infer<typeof capturePlanSchema>;
