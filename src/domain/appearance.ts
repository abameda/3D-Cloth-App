import { z } from 'zod';

export const appearanceSchema = z.object({
  skin: z.enum(['light', 'warm', 'deep','porcelain','sand','tan','rich']),
  hair: z.enum(['black', 'brown', 'blonde', 'grey']),
  hairstyle: z.enum(['short', 'long', 'none']),
  build: z.enum(['slim', 'regular', 'broad']),
  faceShape:z.enum(['oval','round','square']).default('oval'),
  nose:z.enum(['small','medium','strong']).default('medium'),
  eyes:z.enum(['natural','wide']).default('natural'),
  brows:z.enum(['soft','bold']).default('soft'),
  mouth:z.enum(['natural','smile']).default('natural'),
  height:z.enum(['short','average','tall']).default('average'),
}).strict();
export type AvatarAppearance = z.infer<typeof appearanceSchema>;
export const defaultAppearance: AvatarAppearance = appearanceSchema.parse({ skin: 'warm', hair: 'black', hairstyle: 'short', build: 'regular' });
