import type { AgendaDocument, AgendaSection } from '../types/agenda';

export interface ScheduledSlot {
  sectionId: string;
  startClock: string;
  endClock: string;
  startOffsetMin: number;
  endOffsetMin: number;
}

export function parseClockToMinutes(clock: string): number {
  const [hStr, mStr] = (clock || '09:00').split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 9 * 60;
  return h * 60 + m;
}

export function formatMinutesToClock(totalMins: number): string {
  const normalized = ((totalMins % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function calculateScheduleTimes(
  sections: AgendaSection[],
  startTime: string
): Record<string, ScheduledSlot> {
  const baseMins = parseClockToMinutes(startTime);
  let cursor = 0;
  const map: Record<string, ScheduledSlot> = {};

  for (const sec of sections) {
    const dur = Math.max(1, Math.round(sec.allocatedMinutes));
    map[sec.id] = {
      sectionId: sec.id,
      startClock: formatMinutesToClock(baseMins + cursor),
      endClock: formatMinutesToClock(baseMins + cursor + dur),
      startOffsetMin: cursor,
      endOffsetMin: cursor + dur,
    };
    cursor += dur;
  }

  return map;
}

export function scaleSectionsProportionally(
  sections: AgendaSection[],
  targetMinutes: number
): AgendaSection[] {
  if (sections.length === 0) return sections;
  const safeTarget = Math.max(sections.length, Math.round(targetMinutes));

  const lockedSum = sections
    .filter((s) => s.locked)
    .reduce((acc, s) => acc + Math.max(1, Math.round(s.allocatedMinutes)), 0);

  const unlocked = sections.filter((s) => !s.locked);
  if (unlocked.length === 0) return sections;

  const remainingBudget = Math.max(unlocked.length, safeTarget - lockedSum);
  const currentUnlockedSum = unlocked.reduce(
    (acc, s) => acc + Math.max(1, s.allocatedMinutes),
    0
  );

  const raw = unlocked.map((s) => {
    const exact = (Math.max(1, s.allocatedMinutes) / currentUnlockedSum) * remainingBudget;
    const floored = Math.max(1, Math.floor(exact));
    return {
      id: s.id,
      floored,
      remainder: exact - floored,
    };
  });

  const allocated = raw.reduce((acc, item) => acc + item.floored, 0);
  const diff = remainingBudget - allocated;

  if (diff > 0) {
    const sorted = [...raw].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < diff; i++) {
      sorted[i % sorted.length].floored += 1;
    }
  } else if (diff < 0) {
    const sorted = [...raw].sort((a, b) => a.remainder - b.remainder);
    let toRemove = Math.abs(diff);
    let guard = 0;
    while (toRemove > 0 && guard < sorted.length * 10) {
      const target = sorted[guard % sorted.length];
      if (target.floored > 1) {
        target.floored -= 1;
        toRemove -= 1;
      }
      guard += 1;
    }
  }

  const lookup = new Map(raw.map((r) => [r.id, r.floored]));
  return sections.map((s, idx) => ({
    ...s,
    order: idx + 1,
    allocatedMinutes: s.locked ? s.allocatedMinutes : lookup.get(s.id) ?? s.allocatedMinutes,
  }));
}

export function formatAgendaMarkdown(agenda: AgendaDocument): string {
  const schedule = calculateScheduleTimes(agenda.sections, agenda.startTime);
  const totalAllocated = agenda.sections.reduce((sum, s) => sum + s.allocatedMinutes, 0);
  const endClock = formatMinutesToClock(
    parseClockToMinutes(agenda.startTime) + totalAllocated
  );

  const lines: string[] = [];
  lines.push(`# ${agenda.meetingTitle}`);
  lines.push('');
  lines.push(
    `**Format:** ${agenda.recommendedFormat} | **Duration:** ${totalAllocated} min (${agenda.startTime} – ${endClock}) | **Source:** ${agenda.sourceFileName}`
  );
  lines.push('');
  if (agenda.executiveSummary) {
    lines.push('## Purpose');
    lines.push(agenda.executiveSummary);
    lines.push('');
  }

  if (agenda.preReadNotes.length > 0) {
    lines.push('## Pre-Read & Preparation');
    for (const note of agenda.preReadNotes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  lines.push('## Time Allocation Schedule');
  lines.push('| Time | Duration | Topic | Lead |');
  lines.push('| --- | --- | --- | --- |');
  agenda.sections.forEach((sec, idx) => {
    const slot = schedule[sec.id];
    const lead =
      sec.stakeholders.find((s) => s.responsibility.toLowerCase().includes('lead'))?.name ||
      sec.stakeholders[0]?.name ||
      'Facilitator';
    lines.push(
      `| ${slot.startClock} – ${slot.endClock} | ${sec.allocatedMinutes}m | ${idx + 1}. ${sec.title} | ${lead} |`
    );
  });
  lines.push('');

  lines.push('## Agenda Details');
  agenda.sections.forEach((sec, idx) => {
    const slot = schedule[sec.id];
    lines.push('');
    lines.push(
      `### ${idx + 1}. ${sec.title} (${slot.startClock} – ${slot.endClock} · ${sec.allocatedMinutes} min)`
    );
    if (sec.timingRationale) {
      lines.push(`**Pacing:** ${sec.timingRationale}`);
    }
    if (sec.stakeholders.length > 0) {
      const people = sec.stakeholders
        .map((st) => `${st.name} (${st.role} — ${st.responsibility})`)
        .join(', ');
      lines.push(`**Stakeholders:** ${people}`);
    }
    lines.push('');
    lines.push(sec.summary);
    if (sec.keyTalkingPoints.length > 0) {
      lines.push('');
      lines.push('**Key Talking Points:**');
      for (const pt of sec.keyTalkingPoints) {
        lines.push(`- ${pt}`);
      }
    }
    if (sec.actionItems.length > 0) {
      lines.push('');
      lines.push('**Action Items:**');
      for (const item of sec.actionItems) {
        const mark = item.completed ? 'x' : ' ';
        lines.push(
          `- [${mark}] ${item.task} — *${item.owner}* (${item.dueWindow}, ${item.priority} priority)`
        );
      }
    }
  });

  if (agenda.unassignedStakeholders.length > 0) {
    lines.push('');
    lines.push('## Additional Stakeholders to Inform');
    for (const st of agenda.unassignedStakeholders) {
      lines.push(`- **${st.name}** (${st.role}): ${st.context}`);
    }
  }

  return lines.join('\n');
}

export const SAMPLE_BRIEF_FILENAME = 'q4-checkout-modernization-brief.md';

export const SAMPLE_BRIEF_TEXT = `# Q4 Checkout Modernization & Billing Migration Readiness

**Prepared by:** Maya Lin (Principal Product Manager)  
**Target Launch Window:** November 30  
**Audience:** Product, Platform Engineering, Finance Operations, Legal, Customer Support

## 1. Executive Context & Migration Metrics
Our current checkout flow relies on a legacy monolithic payment gateway that adds an average of 1.8 seconds of latency and fails to support regional SEPA Direct Debit and Apple Pay recurring subscriptions. Over the past 60 days, mobile cart abandonment rose from 14.2% to 17.9%, costing roughly $180K in monthly recurring revenue.

Engineering Lead David Park and Payments Architect Priya Nair completed shadow-traffic testing on the new Stripe PaymentIntents pipeline across 12% of staging volume. P99 latency dropped to 410ms with zero duplicate-charge anomalies.

## 2. Cutover Architecture & Rollback Guardrails
David Park proposes a phased 3-wave rollout starting November 18:
- Wave 1 (10% new signups): US & Canada card transactions only.
- Wave 2 (50% traffic): Enable Apple Pay, Google Pay, and SEPA Direct Debit for EU accounts.
- Wave 3 (100% traffic): Migrate existing annual renewal webhooks and sunset legacy gateway tokens.

Open risk: Legacy enterprise invoicing customers (approx. 140 accounts managed by Elena Rostova in Account Management) still depend on custom PDF invoice numbering. Elena needs engineering confirmation that invoice IDs will remain backward-compatible before Wave 2 begins.

## 3. Compliance, Tax & Legal Sign-Off
Legal Counsel Marcus Vance flagged two mandatory prerequisites before Wave 2:
1. Updated GDPR sub-processor disclosures must be published on the trust portal at least 7 days prior to EU SEPA activation.
2. Finance Controller Hannah Kim must reconcile automated tax-code mapping for 14 EU VAT jurisdictions in the staging ledger and sign off on refund webhook accounting.

## 4. Customer Support & Incident Readiness
Support Operations Lead Jordan Alvarez needs updated refund-lookup macros in Zendesk and a 30-minute training walkthrough for Tier 2 agents by November 22. We also need a clear P1 escalation rotation between David Park's on-call payments team and Support during the first 72 hours of Wave 1.

## 5. Key Decisions Needed in This Meeting
- Approve the Wave 1 go-live date of November 18 or defer to November 25 if VAT reconciliation lags.
- Confirm whether enterprise custom-invoicing accounts stay on the legacy bridge until Q1.
- Lock owners and hard deadlines for GDPR trust portal updates and Zendesk support playbooks.
`;
