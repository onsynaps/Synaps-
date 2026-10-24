import { getModels } from "@/lib/models";

export const revalidate = 600;

export async function GET() {
  try {
    return Response.json({ models: await getModels() });
  } catch (e: any) {
    return Response.json({ models: [], error: { message: e?.message || "Could not load models." } }, { status: 502 });
  }
}
