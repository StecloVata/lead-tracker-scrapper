export type LeadStatus =
  | "Not contacted"
  | "Researching"
  | "Contacted"
  | "Meeting booked"
  | "Qualified"
  | "Closed"
  | "Not a fit";

export type LeadVertical =
  | "BPO"
  | "Insurance & Finance"
  | "Debt Collection"
  | "Telecoms & Utilities"
  | "Solar & Energy"
  | "Recruitment & Staffing"
  | "SaaS / Tech Sales";

export interface Contact {
  id?: string;
  lead_id?: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  linkedin: string;
}

export interface Lead {
  id: string;
  user_id: string;
  company: string;
  country: string;
  city: string;
  vertical: LeadVertical;
  tier: 1 | 2 | 3;
  size: string;
  website: string;
  linkedin?: string;
  persona: string;
  trigger: string;
  notes: string;
  status: LeadStatus;
  is_priority: boolean;
  is_archived?: boolean;
  next_action?: string;
  next_action_date?: string;
  ai_score: number | null;
  ai_reasoning: string | null;
  created_at: string;
  updated_at: string;
  contacts?: Contact[];
}

export interface LeadFilters {
  vertical: string;
  country: string;
  tier: string;
  search: string;
  status: string;
}

export type SignalType =
  | "funding"
  | "hiring"
  | "leadership_change"
  | "expansion"
  | "pain_point"
  | "tech_change"
  | "event"
  | "press";

export interface Signal {
  id: string;
  lead_id: string;
  signal_type: SignalType;
  title: string;
  description: string;
  source_url: string;
  urgency: 1 | 2 | 3;
  detected_at: string;
  is_read: boolean;
}
