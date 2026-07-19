"use client";

import { useState } from "react";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactForm } from "./contact-form";
import type { Contact } from "@secondbrain/types";

interface ContactCardProps {
  contact: Contact;
  onUpdate: () => void;
}

function relativeTime(value: Date | string): string {
  const then = new Date(value).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function ContactCard({ contact, onUpdate }: ContactCardProps) {
  const [logging, setLogging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function logInteraction() {
    setLogging(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logInteraction: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("Interaction logged!");
      onUpdate();
    } catch {
      toast.error("Failed to log interaction");
    } finally {
      setLogging(false);
    }
  }

  async function deleteContact() {
    if (!confirm(`Delete ${contact.name}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Contact deleted");
      onUpdate();
    } catch {
      toast.error("Failed to delete contact");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="glass rounded-xl p-5 group animate-fade-in border-l-4 border-teal-400">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs capitalize shrink-0">
              {contact.relationshipType}
            </Badge>
          </div>
          <h4 className="font-semibold text-sm leading-snug">{contact.name}</h4>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={logInteraction}
            disabled={logging}
            className="text-muted-foreground hover:text-teal-400"
            aria-label="Log interaction"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </Button>
          <ContactForm
            contact={contact}
            onSuccess={onUpdate}
            trigger={
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={deleteContact}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {contact.notes && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-2">
          {contact.notes}
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        Last interaction: {relativeTime(contact.lastInteractionAt)}
      </p>
    </div>
  );
}
