import { Planner } from "@/components/planner";
import { offerings } from "@/data/offerings";

export default function Home() {
  return <Planner data={offerings} />;
}
