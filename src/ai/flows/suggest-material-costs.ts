// src/ai/flows/suggest-material-costs.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow to suggest a cost range for materials
 * based on their type and pressure rating (PN). This helps users input realistic cost values.
 *
 * @requires genkit
 * @requires z
 *
 * @exports suggestMaterialCosts - A function to trigger the cost suggestion flow.
 * @exports SuggestMaterialCostsInput - The input type for the suggestMaterialCosts function.
 * @exports SuggestMaterialCostsOutput - The output type for the suggestMaterialCosts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestMaterialCostsInputSchema = z.object({
  materialType: z
    .string()
    .describe('The type of material (e.g., Copper, PER, PP-R).'),
  pressureRating: z
    .number()
    .describe('The pressure rating (PN) of the material.'),
});
export type SuggestMaterialCostsInput = z.infer<
  typeof SuggestMaterialCostsInputSchema
>;

const SuggestMaterialCostsOutputSchema = z.object({
  costRange: z
    .string()
    .describe(
      'A suggested cost range for the material, in MAD/m (Moroccan Dirham per meter), formatted as a string (e.g., \'50-100 MAD/m\').'
    ),
});
export type SuggestMaterialCostsOutput = z.infer<
  typeof SuggestMaterialCostsOutputSchema
>;

export async function suggestMaterialCosts(
  input: SuggestMaterialCostsInput
): Promise<SuggestMaterialCostsOutput> {
  return suggestMaterialCostsFlow(input);
}

const suggestMaterialCostsPrompt = ai.definePrompt({
  name: 'suggestMaterialCostsPrompt',
  input: {schema: SuggestMaterialCostsInputSchema},
  output: {schema: SuggestMaterialCostsOutputSchema},
  prompt: `You are a helpful assistant that suggests a cost range (min and max) for a given material type and pressure rating (PN).
  The cost range should be in Moroccan Dirham per meter (MAD/m).

  Material Type: {{{materialType}}}
  Pressure Rating (PN): {{{pressureRating}}}

  Respond with a cost range in the format \"min-max MAD/m\" (e.g., \"50-100 MAD/m\").  Do not add any other text. Just the cost range.
  `,
});

const suggestMaterialCostsFlow = ai.defineFlow(
  {
    name: 'suggestMaterialCostsFlow',
    inputSchema: SuggestMaterialCostsInputSchema,
    outputSchema: SuggestMaterialCostsOutputSchema,
  },
  async input => {
    const {output} = await suggestMaterialCostsPrompt(input);
    return output!;
  }
);
