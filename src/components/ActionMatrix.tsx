import React, { useMemo, useState } from 'react';
import { Check, Copy, Search } from 'lucide-react';
import type { ActionPriority, AgendaDocument } from '../types/agenda';

interface ActionMatrixProps {
  agenda: AgendaDocument;
  onUpdateAgenda: (updater: (prev: AgendaDocument) => AgendaDocument) => void;
}

export const ActionMatrix: React.FC<ActionMatrixProps> = ({
  agenda,
  onUpdateAgenda,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'done'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | ActionPriority>('all');
  const [copied, setCopied] = useState(false);

  const flatActions = useMemo(() => {
    return agenda.sections.flatMap((sec, sIdx) =>
      sec.actionItems.map((item) => ({
        ...item,
        sectionId: sec.id,
        sectionIndex: sIdx + 1,
        sectionTitle: sec.title,
      }))
    );
  }, [agenda.sections]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flatActions.filter((item) => {
      if (statusFilter === 'open' && item.completed) return false;
      if (statusFilter === 'done' && !item.completed) return false;
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      if (
        q &&
        !item.task.toLowerCase().includes(q) &&
        !item.owner.toLowerCase().includes(q) &&
        !item.sectionTitle.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [flatActions, search, statusFilter, priorityFilter]);

  const completedCount = flatActions.filter((a) => a.completed).length;

  const toggleItem = (sectionId: string, actionId: string) => {
    onUpdateAgenda((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) =>
        sec.id === sectionId
          ? {
              ...sec,
              actionItems: sec.actionItems.map((a) =>
                a.id === actionId ? { ...a, completed: !a.completed } : a
              ),
            }
          : sec
      ),
    }));
  };

  const handleCopyChecklist = async () => {
    const lines = filtered.map(
      (a) =>
        `- [${a.completed ? 'x' : ' '}] ${a.task} — *${a.owner}* (${a.dueWindow}, ${a.priority})`
    );
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-6 border-b border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">
              Action Item Register
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {flatActions.length} total · {flatActions.length - completedCount} open ·{' '}
              {completedCount} completed
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyChecklist}
            disabled={filtered.length === 0}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied checklist' : 'Copy Markdown checklist'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by task, owner, or topic..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'open', 'done'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'High', 'Medium', 'Low'] as const).map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => setPriorityFilter(pr)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  priorityFilter === pr
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pr === 'all' ? 'All priorities' : pr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500">
          No action items match your current filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-6 w-10">Done</th>
                <th className="py-3 px-4">Action Item</th>
                <th className="py-3 px-4 whitespace-nowrap">Owner</th>
                <th className="py-3 px-4">Source Topic</th>
                <th className="py-3 px-4 whitespace-nowrap">Due Window</th>
                <th className="py-3 px-6 whitespace-nowrap text-right">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-6">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.sectionId, item.id)}
                      aria-label={`Toggle ${item.task}`}
                      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                        item.completed
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 bg-white hover:border-blue-500'
                      }`}
                    >
                      {item.completed && <Check className="w-3 h-3" />}
                    </button>
                  </td>
                  <td
                    className={`py-3.5 px-4 ${
                      item.completed ? 'line-through text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    {item.task}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap font-medium">
                    {item.owner}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">
                    {String(item.sectionIndex).padStart(2, '0')}. {item.sectionTitle}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {item.dueWindow}
                  </td>
                  <td className="py-3.5 px-6 text-xs text-right whitespace-nowrap font-medium">
                    <span
                      className={
                        item.priority === 'High'
                          ? 'text-red-700'
                          : item.priority === 'Medium'
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }
                    >
                      {item.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
