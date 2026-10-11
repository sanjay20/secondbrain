import { Header } from "@/components/layout/header";
import { SavingsPanel } from "@/components/savings/savings-panel";

export default function SavingsPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Life Savings"
        subtitle="What your discipline is worth — and what it is costing you"
      />

      <div className="flex-1 p-4 md:p-6">
        <SavingsPanel />
      </div>
    </div>
  );
}
