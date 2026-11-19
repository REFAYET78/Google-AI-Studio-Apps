import React, { useMemo } from 'react';
import type { AgendaDocument } from '../types/agenda';

interface StakeholdersViewProps {
  agenda: AgendaDocument;
}

interface AggregatedStakeholder {
  name: string;
  roles: Set<string>;
  responsibilities: Set<string>;
  topics: Array<{ index: number; title: string; minutes: number }>;
  totalMinutes: number;
  actionItemCount: number;
}

export const StakeholdersView: React.FC<StakeholdersViewProps> = ({ agenda }) => {
  const directory = useMemo(() => {
    const map = new Map<string, AggregatedStakeholder>();

    agenda.sections.forEach((sec, idx) => {
      for (const st of sec.stakeholders) {
        const key = st.name.trim().toLowerCase();
        const existing = map.get(key) || {
          name: st.name.trim(),
          roles: new Set<string>(),
          responsibilities: new Set<string>(),
          topics: [],
          totalMinutes: 0,
          actionItemCount: 0,
        };
        if (st.role) existing.roles.add(st.role);
        if (st.responsibility) existing.responsibilities.add(st.responsibility);
        existing.topics.push({
          index: idx + 1,
          title: sec.title,
          minutes: sec.allocatedMinutes,
        });
        existing.totalMinutes += sec.allocatedMinutes;
        map.set(key, existing);
      }

      for (const act of sec.actionItems) {
        const ownerKey = act.owner.trim().toLowerCase();
        const match = map.get(ownerKey);
        if (match) {
          match.actionItemCount += 1;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [agenda]);

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Active Meeting Stakeholders
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Time commitment and topic ownership extracted from {agenda.sourceFileName}.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {directory.length} participants
          </span>
        </div>

        {directory.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No stakeholders have been assigned to agenda sections yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-6">Stakeholder</th>
                  <th className="py-3 px-4">Role & Function</th>
                  <th className="py-3 px-4">Topics Involved</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Action Items</th>
                  <th className="py-3 px-6 text-right whitespace-nowrap">Allocated Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {directory.map((person) => (
                  <tr key={person.name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-900 whitespace-nowrap">
                      {person.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{Array.from(person.roles).join(', ') || 'Contributor'}</div>
                      <div className="text-xs text-slate-400">
                        {Array.from(person.responsibilities).join(' · ')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <ul className="space-y-1">
                        {person.topics.map((t) => (
                          <li key={`${person.name}-${t.index}`}>
                            <span className="font-mono tabular-nums text-slate-400 mr-1.5">
                              {String(t.index).padStart(2, '0')}
                            </span>
                            <span>{t.title}</span>
                            <span className="font-mono tabular-nums text-slate-400 ml-1.5">
                              ({t.minutes}m)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {person.actionItemCount}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {person.totalMinutes}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {agenda.unassignedStakeholders.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Additional Stakeholders Mentioned (Inform / Optional)
            </h3>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {agenda.unassignedStakeholders.map((st, idx) => (
              <li key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-900">{st.name}</span>
                  <span className="text-slate-500 text-xs ml-2">({st.role})</span>
                </div>
                <p className="text-xs text-slate-600">{st.context}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
