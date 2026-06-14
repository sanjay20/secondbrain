import { Header } from "@/components/layout/header";
import { WorkoutLog } from "@/components/health/workout-log";

export default function HealthPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Health"
        subtitle="Track your workouts and fitness"
      />

      <div className="flex-1 p-6">
        <WorkoutLog />
      </div>
    </div>
  );
}
