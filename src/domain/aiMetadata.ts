import { z } from 'zod';
import { categories, colors, occasions, styles } from './types';

const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const contextSchema = z.object({ occasion: z.enum(occasions), weather: z.enum(['Warm', 'Mild', 'Cold']), formality: level, includeLayer: z.boolean(), includeAccessory: z.boolean(), prompt: z.string().max(1000) }).strict();
export const itemSchema = z.object({ name: z.string().min(1).max(80), category: z.enum(categories), color: z.enum(colors), fit: z.enum(['Regular', 'Relaxed', 'Slim']), formality: level, warmth: level, styles: z.array(z.enum(styles)).max(6) }).strict();
