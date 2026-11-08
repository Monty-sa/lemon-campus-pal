import { Planner } from "@/components/planner";
import { offerings } from "@/data/male-offerings";

export default function Home() {
  return <Planner data={offerings} />;
}
