"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ContactForm } from "@/components/relationships/contact-form";
import { ContactList } from "@/components/relationships/contact-list";
import type { Contact } from "@secondbrain/types";

const OVERDUE_DAYS = 30;

export default function RelationshipsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      setContacts(await res.json() as Contact[]);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const overdueThreshold = Date.now() - OVERDUE_DAYS * 86_400_000;
  const overdueCount = contacts.filter(
    (c) => new Date(c.lastInteractionAt).getTime() < overdueThreshold
  ).length;

  return (
    <div className="flex flex-col flex-1">
      <Header title="Relationships" subtitle="Stay close to the people who matter" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <StatsCard title="Contacts" value={contacts.length} icon={Users} iconColor="text-teal-400" />
          <StatsCard title={`Overdue (${OVERDUE_DAYS}d+)`} value={overdueCount} icon={Clock} iconColor="text-amber-400" />
        </div>

        <div className="flex justify-end">
          <ContactForm onSuccess={fetchData} />
        </div>

        <ContactList contacts={contacts} loading={loading} onUpdate={fetchData} />
      </div>
    </div>
  );
}
