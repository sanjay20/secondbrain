"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MoodPanel } from "@/components/mindset/mood-panel";
import { GratitudePanel } from "@/components/mindset/gratitude-panel";

export default function MindsetPage() {
  const [tab, setTab] = useState("mood");

  return (
    <div className="flex flex-col flex-1">
      <Header title="Mindset" subtitle="Nurture your inner world" />

      <div className="flex-1 p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <div className="flex justify-end">
            <TabsList>
              <TabsTrigger value="mood">Mood Tracker</TabsTrigger>
              <TabsTrigger value="gratitude">Gratitude</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="mood">
            <MoodPanel />
          </TabsContent>
          <TabsContent value="gratitude">
            <GratitudePanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
