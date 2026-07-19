"use client";

import { Users } from "lucide-react";
import { ContactCard } from "./contact-card";
import type { Contact } from "@secondbrain/types";

interface ContactListProps {
  contacts: Contact[];
  loading: boolean;
  onUpdate: () => void;
}

export function ContactList({ contacts, loading, onUpdate }: ContactListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />)}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-teal-400/10 flex items-center justify-center">
          <Users className="w-8 h-8 text-teal-400" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold">No contacts yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add the people who matter — the ones you&apos;ve drifted from surface here first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
