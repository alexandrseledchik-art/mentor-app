alter table public.entry_sessions
  drop column if exists entry_mode,
  drop column if exists detected_intent,
  drop column if exists tool_confidence,
  drop column if exists conversation_frame,
  drop column if exists active_unknown;

drop table if exists public.tool_demand_signals;
