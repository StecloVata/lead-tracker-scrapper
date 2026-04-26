"use client";

import { useState, useEffect, useCallback } from "react";
import type { Lead, Contact, LeadStatus, LeadVertical } from "@/types/lead";
import { createClient } from "@/lib/supabase/client";
import SignalPanel from "./SignalPanel";

const STATUSES: LeadStatus[] = ["Not contacted", "Researching", "Contacted", "Meeting booked", "Qualified", "Closed", "Not a fit"];
const VERTICALS: LeadVertical[] = ["BPO", "Insurance & Finance", "Debt Collection", "Telecoms & Utilities", "Solar & Energy", "Recruitment & Staffing", "SaaS / Tech Sales"];

interface Props {
  lead: Lead;
  onClose: () => void;
  onSave: (patch: Partial<Lead>) => Promise<Lead | undefined>;
  onDelete?: () => void;
  onAIScore?: () => void;
}

export default function LeadModal({ lead, onClose, onSave, onDelete, onAIScore }: Props) {
  const isNew = !lead.id;
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"details" | "signals">("details");
  const [signalUnread, setSignalUnread] = useState(0);
  const [signalMaxUrgency, setSignalMaxUrgency] = useState<1 | 2 | 3 | null>(null);

  const handleUnreadChange = useCallback((count: number, maxUrgency: 1 | 2 | 3 | null) => {
    setSignalUnread(count);
    setSignalMaxUrgency(maxUrgency);
  }, []);

  const [form, setForm] = useState<Partial<Lead>>({
    company: lead.company ?? "",
    country: lead.country ?? "",
    city: lead.city ?? "",
    vertical: lead.vertical ?? "BPO",
    tier: lead.tier ?? 2,
    size: lead.size ?? "",
    website: lead.website ?? "",
    persona: lead.persona ?? "",
    trigger: lead.trigger ?? "",
    notes: lead.notes ?? "",
    status: lead.status ?? "Not contacted",
    is_priority: lead.is_priority ?? false,
    next_action: lead.next_action ?? "",
    next_action_date: lead.next_action_date ?? "",
  });

  const [contacts, setContacts] = useState<Contact[]>([{ name: "", role: "", phone: "", email: "", linkedin: "" }]);
  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    if (lead.contacts && lead.contacts.length > 0) {
      setContacts(lead.contacts);
    }
  }, [lead.contacts]);

  async function handleSave() {
    setSaving(true);
    const saved = await onSave(form);
    const leadId = saved?.id ?? lead.id;

    if (leadId) {
      // Upsert contacts
      const existing = contacts.filter(c => c.id);
      const newContacts = contacts.filter(c => !c.id && (c.name || c.email || c.phone));

      for (const c of existing) {
        await supabase.from("contacts").update({ name: c.name, role: c.role, phone: c.phone, email: c.email, linkedin: c.linkedin }).eq("id", c.id!);
      }
      if (newContacts.length) {
        await supabase.from("contacts").insert(newContacts.map(c => ({ ...c, lead_id: leadId })));
      }
    }

    setSaving(false);
    if (isNew) onClose();
  }

  async function handleAIScore() {
    if (!onAIScore) return;
    setScoring(true);
    await onAIScore();
    setScoring(false);
  }

  function addContact() {
    setContacts(prev => [...prev, { name: "", role: "", phone: "", email: "", linkedin: "" }]);
  }

  function removeContact(idx: number) {
    setContacts(prev => prev.filter((_, i) => i !== idx));
  }

  function updateContact(idx: number, field: keyof Contact, val: string) {
    setContacts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  }

  const inputStyle = "w-full text-sm px-3 py-2 rounded-lg outline-none";
  const inputCss = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
  const labelStyle = "block text-xs font-medium mb-1";
  const labelCss = { color: "var(--text-sub)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl scrollbar-thin" style={{ background: "#fff" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b sticky top-0 z-10" style={{ borderColor: "var(--border)", background: "#fff" }}>
          <div className="flex-1">
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{isNew ? "Add new lead" : form.company}</h2>
            {!isNew && <p className="text-xs" style={{ color: "var(--muted)" }}>{lead.country} · {lead.vertical}</p>}
          </div>
          {lead.ai_score ? (
            <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "#f0fdf4", color: "#166534" }}>
              AI fit: {lead.ai_score}/100
            </span>
          ) : null}
          <button onClick={onClose} className="text-lg leading-none hover-text" style={{ color: "var(--muted)" }}>✕</button>
        </div>

        {/* Tabs — only shown for existing leads */}
        {!isNew && (
          <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
            {(["details", "signals"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative px-5 py-2.5 text-xs font-semibold capitalize transition-colors"
                style={{
                  color: activeTab === tab ? "var(--navy)" : "var(--muted)",
                  borderBottom: activeTab === tab ? "2px solid var(--orange)" : "2px solid transparent",
                }}
              >
                {tab === "signals" ? (
                  <span className="flex items-center gap-1.5">
                    Signals
                    {signalUnread > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: signalMaxUrgency === 3 ? "#ef4444" : "#f59e0b", color: "#fff" }}>
                        {signalUnread}
                      </span>
                    )}
                  </span>
                ) : "Details"}
              </button>
            ))}
          </div>
        )}

        {/* AI reasoning (Details tab only) */}
        {activeTab === "details" && lead.ai_reasoning && (
          <div className="mx-6 mt-4 p-3 rounded-lg text-xs" style={{ background: "#f0fdf4", color: "#166534" }}>
            <strong>AI Assessment:</strong> {lead.ai_reasoning}
          </div>
        )}

        {/* Signals tab */}
        {!isNew && activeTab === "signals" && (
          <div className="px-6 py-4">
            <SignalPanel leadId={lead.id} onUnreadChange={handleUnreadChange} />
          </div>
        )}

        <div className="px-6 py-4 space-y-5" style={{ display: isNew || activeTab === "details" ? undefined : "none" }}>
          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelCss} className={labelStyle}>Company *</label>
              <input style={inputCss} className={inputStyle} value={form.company ?? ""} onChange={e => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label style={labelCss} className={labelStyle}>Website</label>
              <input style={inputCss} className={inputStyle} value={form.website ?? ""} onChange={e => setForm({ ...form, website: e.target.value })} />
            </div>
            <div>
              <label style={labelCss} className={labelStyle}>Country</label>
              <input style={inputCss} className={inputStyle} value={form.country ?? ""} onChange={e => setForm({ ...form, country: e.target.value })} />
            </div>
            <div>
              <label style={labelCss} className={labelStyle}>City</label>
              <input style={inputCss} className={inputStyle} value={form.city ?? ""} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label style={labelCss} className={labelStyle}>Vertical</label>
              <select style={{ ...inputCss, cursor: "pointer" }} className={inputStyle} value={form.vertical ?? ""} onChange={e => setForm({ ...form, vertical: e.target.value as LeadVertical })}>
                {VERTICALS.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelCss} className={labelStyle}>Tier</label>
              <select style={{ ...inputCss, cursor: "pointer" }} className={inputStyle} value={form.tier ?? 2} onChange={e => setForm({ ...form, tier: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>Tier 1 — High priority</option>
                <option value={2}>Tier 2 — Medium priority</option>
                <option value={3}>Tier 3 — Lower priority</option>
              </select>
            </div>
            <div>
              <label style={labelCss} className={labelStyle}>Company size</label>
              <input style={inputCss} className={inputStyle} value={form.size ?? ""} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="e.g. 50–200" />
            </div>
            <div>
              <label style={labelCss} className={labelStyle}>Status</label>
              <select style={{ ...inputCss, cursor: "pointer" }} className={inputStyle} value={form.status ?? "Not contacted"} onChange={e => setForm({ ...form, status: e.target.value as LeadStatus })}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelCss} className={labelStyle}>Key persona</label>
            <input style={inputCss} className={inputStyle} value={form.persona ?? ""} onChange={e => setForm({ ...form, persona: e.target.value })} placeholder="e.g. Head of Operations" />
          </div>

          <div>
            <label style={labelCss} className={labelStyle}>Sales trigger</label>
            <input style={inputCss} className={inputStyle} value={form.trigger ?? ""} onChange={e => setForm({ ...form, trigger: e.target.value })} />
          </div>

          <div>
            <label style={labelCss} className={labelStyle}>Notes</label>
            <textarea
              style={inputCss}
              className={`${inputStyle} resize-none`}
              rows={3}
              value={form.notes ?? ""}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* Next action */}
          <div data-tutorial="next-action-section" className="rounded-xl p-4 space-y-3" style={{ background: "#f8f9ff", border: "1px solid #e0e4ff" }}>
            <h3 className="text-xs font-semibold" style={{ color: "var(--navy)" }}>📋 Next action</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={labelCss} className={labelStyle}>What to do</label>
                <input
                  style={inputCss}
                  className={inputStyle}
                  value={form.next_action ?? ""}
                  onChange={e => setForm({ ...form, next_action: e.target.value })}
                  placeholder="e.g. Follow up call, Send email, Connect on LinkedIn"
                />
              </div>
              <div>
                <label style={labelCss} className={labelStyle}>Due date</label>
                <input
                  type="date"
                  style={inputCss}
                  className={inputStyle}
                  value={form.next_action_date ?? ""}
                  onChange={e => setForm({ ...form, next_action_date: e.target.value })}
                />
              </div>
              {form.next_action_date && (
                <div className="flex items-end pb-1">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, next_action_date: "" })}
                    className="text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    Clear date
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="priority" checked={form.is_priority ?? false} onChange={e => setForm({ ...form, is_priority: e.target.checked })} />
            <label htmlFor="priority" className="text-sm cursor-pointer" style={{ color: "var(--text-sub)" }}>Mark as priority ⭐</label>
          </div>

          {/* Contacts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Contacts</h3>
              <button onClick={addContact} className="text-xs px-2 py-1 rounded-lg hover-btn" style={{ background: "var(--surface)", color: "var(--navy)", border: "1px solid var(--border)" }}>
                + Add contact
              </button>
            </div>
            <div className="space-y-3">
              {contacts.map((c, idx) => (
                <div key={idx} className="p-3 rounded-xl space-y-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Contact {idx + 1}</span>
                    {contacts.length > 1 && (
                      <button onClick={() => removeContact(idx)} className="text-xs" style={{ color: "#dc2626" }}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["name", "role", "phone", "email", "linkedin"] as (keyof Contact)[]).map(field => (
                      <input
                        key={field}
                        style={{ ...inputCss, background: "#fff" }}
                        className={`${inputStyle} ${field === "linkedin" ? "col-span-2" : ""}`}
                        placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                        value={c[field] as string ?? ""}
                        onChange={e => updateContact(idx, field, e.target.value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer — hidden on Signals tab */}
        <div className="flex items-center gap-3 px-6 py-4 border-t sticky bottom-0" style={{ borderColor: "var(--border)", background: "#fff", display: !isNew && activeTab === "signals" ? "none" : undefined }}>
          {onDelete && (
            <button onClick={onDelete} className="text-xs px-3 py-2 rounded-lg hover-btn-destructive" style={{ color: "#dc2626", background: "#fee2e2" }}>
              Delete lead
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg border hover-btn" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-50 hover-btn" style={{ background: "var(--orange)", color: "#fff" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
