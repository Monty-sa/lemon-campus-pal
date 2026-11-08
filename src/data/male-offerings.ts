import maleSnapshot from "../../data/kfu-144820-06-11.json";
import { DataImportSchema, type DataImport } from "@/lib/schema";

export const maleOfferings: DataImport = DataImportSchema.parse(maleSnapshot);
export const offerings: DataImport = maleOfferings;
