import femaleSnapshot from "../../data/kfu-144820-06-12.json";
import { DataImportSchema, type DataImport } from "@/lib/schema";

export const femaleOfferings: DataImport = DataImportSchema.parse(femaleSnapshot);
