import { NextResponse } from "next/server";
import { getFallbackRoads } from "@/lib/tw-address";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RoadRow = {
  road_name: string;
};

type RoadQueryResult = {
  data: RoadRow[] | null;
  error: unknown;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city")?.trim();
  const district = searchParams.get("district")?.trim();
  const keyword = searchParams.get("q")?.trim();
  const fallbackRoads = city && district ? getFallbackRoads(city, district, keyword ?? "") : getFallbackRoads("", "", keyword ?? "");

  if (!city || !district) {
    return NextResponse.json({ roads: fallbackRoads, source: "fallback" });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ roads: fallbackRoads, source: "fallback" });
  }

  let query = supabase
    .from("ci_address_roads")
    .select("road_name")
    .eq("city_name", city)
    .eq("district_name", district)
    .order("road_name", { ascending: true })
    .limit(80);

  if (keyword) query = query.ilike("road_name", `%${keyword}%`);

  const { data, error } = await Promise.race<RoadQueryResult>([
    query.then((result) => ({ data: result.data as RoadRow[] | null, error: result.error })),
    new Promise<RoadQueryResult>((resolve) => {
      setTimeout(() => resolve({ data: null, error: new Error("Address road lookup timed out") }), 1800);
    }),
  ]);

  if (error) {
    return NextResponse.json({ roads: fallbackRoads, source: "fallback" });
  }

  const roads = Array.from(new Set(((data ?? []) as RoadRow[]).map((row) => row.road_name).filter(Boolean)));
  return NextResponse.json({ roads: roads.length ? roads : fallbackRoads, source: roads.length ? "database" : "fallback" });
}
