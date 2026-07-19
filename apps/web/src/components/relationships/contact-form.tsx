"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CONTACT_NAME_MAX_LEN, CONTACT_NOTES_MAX_LEN, RELATIONSHIP_TYPES } from "@secondbrain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Contact } from "@secondbrain/types";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(CONTACT_NAME_MAX_LEN),
  relationshipType: z.string().min(1).max(50),
  notes: z.string().max(CONTACT_NOTES_MAX_LEN).optional(),
  lastInteractionAt: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ContactFormProps {
  onSuccess: () => void;
  contact?: Contact;
  trigger?: React.ReactNode;
}

function toDateInput(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function ContactForm({ onSuccess, contact, trigger }: ContactFormProps) {
  const [open, setOpen] = useState(false);
  const isEdit = !!contact;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          name: contact.name,
          relationshipType: contact.relationshipType,
          notes: contact.notes ?? "",
          lastInteractionAt: toDateInput(contact.lastInteractionAt),
        }
      : { relationshipType: "friend" },
  });

  async function onSubmit(data: FormValues) {
    const url = isEdit ? `/api/contacts/${contact.id}` : "/api/contacts";
    const method = isEdit ? "PATCH" : "POST";

    const payload: Record<string, unknown> = {
      name: data.name,
      relationshipType: data.relationshipType,
      notes: data.notes,
    };
    if (isEdit && data.lastInteractionAt) {
      payload.lastInteractionAt = new Date(data.lastInteractionAt).toISOString();
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      toast.error(isEdit ? "Failed to update contact" : "Failed to add contact");
      return;
    }

    toast.success(isEdit ? "Contact updated!" : "Contact added!");
    reset();
    setOpen(false);
    onSuccess();
  }

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="w-4 h-4" />
      Add contact
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Alex Rivera" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Relationship</Label>
            <Select
              defaultValue={isEdit ? contact.relationshipType : "friend"}
              onValueChange={(v) => setValue("relationshipType", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.relationshipType && (
              <p className="text-xs text-destructive">{errors.relationshipType.message}</p>
            )}
          </div>

          {isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="lastInteractionAt">Last interaction</Label>
              <Input id="lastInteractionAt" type="date" {...register("lastInteractionAt")} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="How you know them, what to remember..."
              rows={3}
              maxLength={CONTACT_NOTES_MAX_LEN}
              {...register("notes")}
            />
            {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Contact"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
