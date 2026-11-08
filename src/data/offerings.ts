import { maleOfferings, offerings } from "./male-offerings";
import { femaleOfferings } from "./female-offerings";
import type { DataImport } from "@/lib/schema";

export { maleOfferings, femaleOfferings, offerings };

export const allOfferings: Record<"11" | "12", DataImport> = {
  "11": maleOfferings,
  "12": femaleOfferings,
};

export function getOfferingsForCategory(categoryCode: "11" | "12"): DataImport {
  return allOfferings[categoryCode] ?? maleOfferings;
}
