import maleSnapshot from "../../data/kfu-144820-06-11.json";
import femaleSnapshot from "../../data/kfu-144820-06-12.json";
import { DataImportSchema, type DataImport } from "@/lib/schema";

export const maleOfferings: DataImport = DataImportSchema.parse(maleSnapshot);
export const femaleOfferings: DataImport = DataImportSchema.parse(femaleSnapshot);

// Default export preserved for backward compatibility
export const offerings: DataImport = maleOfferings;

export const allOfferings: Record<"11" | "12", DataImport> = {
  "11": maleOfferings,
  "12": femaleOfferings,
};

export function getOfferingsForCategory(categoryCode: "11" | "12"): DataImport {
  return allOfferings[categoryCode] ?? maleOfferings;
}
