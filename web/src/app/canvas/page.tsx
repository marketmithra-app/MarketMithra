import { redirect } from "next/navigation";

export default async function CanvasIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  redirect(upgrade === "1" ? "/canvas/RELIANCE.NS?upgrade=1" : "/canvas/RELIANCE.NS");
}
