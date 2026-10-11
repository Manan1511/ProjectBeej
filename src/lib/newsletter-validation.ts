import { z } from "zod";

export const newsletterInputSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  consent: z.literal(true),
  company: z.string().max(0).optional(),
});
