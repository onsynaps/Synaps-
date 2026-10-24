import { getModels } from "@/lib/models";

export const revalidate = 600;

export async function GET() {
  const models = await getModels().catch(() => []);
  return Response.json({
    object: "list",
    data: models.map((m) => ({
      id: m.id,
      object: "model",
      owned_by: m.maker,
      name: m.name,
      context_length: m.context,
      privacy_lane: m.lane,
      input_modalities: m.inputs,
      output_modalities: m.outputs,
      pricing: {
        prompt_per_million_usd: +(m.promptPrice * 1e6).toFixed(4),
        completion_per_million_usd: +(m.completionPrice * 1e6).toFixed(4),
      },
    })),
  });
}
