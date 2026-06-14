import { Sparkles } from "lucide-react";
import Link from "next/link";

interface Props {
  affirmation: { id: string; text: string } | null;
}

export function DailyAffirmation({ affirmation }: Props) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <h3 className="font-semibold text-sm">Daily Affirmation</h3>
      </div>
      {affirmation ? (
        <p className="text-sm text-muted-foreground italic">&ldquo;{affirmation.text}&rdquo;</p>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          No affirmations yet.{" "}
          <Link href="/mindset" className="underline">
            Add one
          </Link>
        </p>
      )}
    </div>
  );
}
