"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SKILL_CATEGORIES, SKILL_LEVELS } from "@secondbrain/types";

const categoryLabels: Record<string, string> = {
  technical: "Technical",
  soft: "Soft",
  language: "Language",
  tool: "Tool",
  domain: "Domain",
};

interface SkillFormProps {
  onSuccess: () => void;
}

export function SkillForm({ onSuccess }: SkillFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("technical");
  const [level, setLevel] = useState("1");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category, level: parseInt(level), area: "career" }),
      });
      if (!res.ok) throw new Error();
      setName("");
      setCategory("technical");
      setLevel("1");
      toast.success("Skill added!");
      onSuccess();
    } catch {
      toast.error("Failed to add skill");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        placeholder="Add a skill (e.g. TypeScript)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        className="flex-1 min-w-40"
      />
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {SKILL_CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>{categoryLabels[cat]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={level} onValueChange={setLevel}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Level" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SKILL_LEVELS).map(([val, label]) => (
            <SelectItem key={val} value={val}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleAdd} disabled={adding || !name.trim()} size="sm">
        <Plus className="w-4 h-4" />
        Add
      </Button>
    </div>
  );
}
