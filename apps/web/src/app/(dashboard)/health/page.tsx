import { Header } from "@/components/layout/header";
import { WorkoutLog } from "@/components/health/workout-log";
import { SleepLog } from "@/components/health/sleep-log";

export default function HealthPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Health"
        subtitle="Track your workouts and sleep"
      />

      <div className="flex-1 p-6 space-y-10">
        <WorkoutLog />
        <div className="border-t border-border pt-10">
          <SleepLog />
        </div>
      </div>
    </div>
  );
}
