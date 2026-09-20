"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function updatePlaceField(placeId: string, field: string, value: string | number | null) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== ROLES.ADMIN) {
    throw new Error("Unauthorized");
  }

  const existingPlace = await prisma.place.findUnique({ where: { id: placeId } });
  if (!existingPlace) throw new Error("Place not found");

  const allowedFields = ["name", "description", "category", "typicalCostInr", "durationMinutes", "openingTime", "closingTime", "bestSeason", "dataStatus"];
  if (!allowedFields.includes(field)) {
    throw new Error("Field not editable");
  }

  const updateData: Record<string, string | number | null> = { [field]: value };

  // If modifying a factual field and it was AI derived, update provenance
  const isFactual = ["typicalCostInr", "durationMinutes", "openingTime", "closingTime"].includes(field);
  if (isFactual) {
    updateData.sourceType = "MANUALLY_CURATED";
  }

  await prisma.place.update({
    where: { id: placeId },
    data: updateData,
  });

  revalidatePath(`/admin/places/${placeId}`);
  revalidatePath(`/admin/data`);
}
