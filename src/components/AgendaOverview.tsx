import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Lock,
  Plus,
  Trash2,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  ActionPriority,
  AgendaDocument,
  AgendaSection,
} from '../types/agenda';
import { calculateScheduleTimes } from '../utils/agendaHelpers';

interface AgendaOverviewProps {
  agenda: AgendaDocument;
  onUpdateAgenda: (updater: (prev: AgendaDocument) => AgendaDocument) => void;
}

const SEGMENT_SHADES = [
  'bg-blue-600',
  'bg-slate-700',
  'bg-indigo-500',
  'bg-sky-600',
  'bg-slate-500',
  'bg-blue-400',
  'bg-slate-800',
  'bg-cyan-600',
];

export const AgendaOverview: React.FC<AgendaOverviewProps> = ({
  agenda,
  onUpdateAgenda,
}) => {
  const schedule = calculateScheduleTimes(agenda.sections, agenda.startTime);
  const totalAllocated = agenda.sections.reduce((acc, s) => acc + s.allocatedMinutes, 0);

  const [addingActionFor, setAddingActionFor] = useState<string | null>(null);
  const [newActionTask, setNewActionTask] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [newActionDue, setNewActionDue] = useState('Next sync');
  const [newActionPriority, setNewActionPriority] = useState<ActionPriority>('Medium');

  const [addingStakeholderFor, setAddingStakeholderFor] = useState<string | null>(null);
  const [newStakeholderName, setNewStakeholderName] = useState('');
  const [newStakeholderRole, setNewStakeholderRole] = useState('');
  const [newStakeholderResp, setNewStakeholderResp] = useState('Contributor');

  const updateSection = (
    sectionId: string,
    updater: (sec: AgendaSection) => AgendaSection
  ) => {
    onUpdateAgenda((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? updater(s) : s)),
    }));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= agenda.sections.length) return;
    onUpdateAgenda((prev) => {
      const next = [...prev.sections];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return {
        ...prev,
        sections: next.map((s, idx) => ({ ...s, order: idx + 1 })),
      };
    });
  };

  const removeSection = (sectionId: string) => {
    if (agenda.sections.length <= 1) return;
    onUpdateAgenda((prev) => ({
      ...prev,
      sections: prev.sections
        .filter((s) => s.id !== sectionId)
        .map((s, idx) => ({ ...s, order: idx + 1 })),
    }));
  };

  const addSection = () => {
    const newId = `sec-custom-${Date.now()}`;
    onUpdateAgenda((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: newId,
          order: prev.sections.length + 1,
          title: 'New Discussion Topic',
          category: 'Discussion',
          allocatedMinutes: 5,
          locked: false,
          summary: 'Outline the key context and objective for this agenda segment.',
          keyTalkingPoints: [],
          timingRationale: '2m framing, 3m open discussion',
          stakeholders: [],
          actionItems: [],
        },
      ],
    }));
  };

  const handleAddActionItem = (sectionId: string) => {
    if (!newActionTask.trim()) return;
    updateSection(sectionId, (sec) => ({
      ...sec,
      actionItems: [
        ...sec.actionItems,
        {
          id: `act-${Date.now()}`,
          task: newActionTask.trim(),
          owner: newActionOwner.trim() || 'Unassigned',
          dueWindow: newActionDue.trim() || 'Next sync',
          priority: newActionPriority,
          completed: false,
        },
      ],
    }));
    setNewActionTask('');
    setNewActionOwner('');
    setNewActionDue('Next sync');
    setNewActionPriority('Medium');
    setAddingActionFor(null);
  };

  const handleAddStakeholder = (sectionId: string) => {
    if (!newStakeholderName.trim()) return;
    updateSection(sectionId, (sec) => ({
      ...sec,
      stakeholders: [
        ...sec.stakeholders,
        {
          id: `st-${Date.now()}`,
          name: newStakeholderName.trim(),
          role: newStakeholderRole.trim() || 'Team Member',
          responsibility: newStakeholderResp.trim() || 'Contributor',
        },
      ],
    }));
    setNewStakeholderName('');
    setNewStakeholderRole('');
    setNewStakeholderResp('Contributor');
    setAddingStakeholderFor(null);
  };

  return (
    <div className="space-y-8">
      {/* Meeting Header & Executive Summary */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{agenda.recommendedFormat}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {totalAllocated} min total
            </span>
            <span aria-hidden="true">·</span>
            <span>{agenda.sections.length} sections</span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-xs">{agenda.sourceFileName}</span>
          </div>

          <input
            type="text"
            aria-label="Meeting title"
            value={agenda.meetingTitle}
            onChange={(e) =>
              onUpdateAgenda((prev) => ({ ...prev, meetingTitle: e.target.value }))
            }
            className="w-full font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none py-0.5 transition-colors"
          />

          <textarea
            aria-label="Executive summary"
            rows={2}
            value={agenda.executiveSummary}
            onChange={(e) =>
              onUpdateAgenda((prev) => ({
                ...prev,
                executiveSummary: e.target.value,
              }))
            }
            className="w-full text-sm text-slate-600 leading-relaxed bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none rounded-md px-2 -mx-2 py-1 resize-none transition-colors"
          />
        </div>

        {/* Proportional Time Allocation Bar */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              Time distribution across topics
            </span>
            <span className="font-mono tabular-nums">
              {agenda.startTime} –{' '}
              {schedule[agenda.sections[agenda.sections.length - 1]?.id]?.endClock ||
                agenda.startTime}
            </span>
          </div>

          <div
            className="h-3 w-full rounded-md overflow-hidden flex gap-0.5 bg-slate-100"
            role="navigation"
            aria-label="Agenda time distribution"
          >
            {agenda.sections.map((sec, idx) => {
              const pct =
                totalAllocated > 0
                  ? (sec.allocatedMinutes / totalAllocated) * 100
                  : 100 / agenda.sections.length;
              return (
                <a
                  key={sec.id}
                  href={`#section-${sec.id}`}
                  title={`${idx + 1}. ${sec.title} (${sec.allocatedMinutes}m)`}
                  style={{ width: `${pct}%` }}
                  className={`${SEGMENT_SHADES[idx % SEGMENT_SHADES.length]} hover:opacity-85 transition-opacity`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            {agenda.sections.map((sec, idx) => (
              <a
                key={sec.id}
                href={`#section-${sec.id}`}
                className="hover:text-blue-600 transition-colors truncate max-w-[220px]"
              >
                <span className="font-mono tabular-nums text-slate-400 mr-1">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span>{sec.title}</span>
                <span className="font-mono tabular-nums text-slate-500 ml-1">
                  ({sec.allocatedMinutes}m)
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Pre-Read Notes */}
        {agenda.preReadNotes.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <h2 className="text-xs font-semibold text-slate-700">
              Pre-read & preparation notes
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-slate-600 list-disc pl-5">
              {agenda.preReadNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Agenda Sections */}
      <div className="space-y-6">
        {agenda.sections.map((sec, idx) => {
          const slot = schedule[sec.id];
          return (
            <article
              key={sec.id}
              id={`section-${sec.id}`}
              className="print-break-inside-avoid bg-white border border-slate-200 rounded-xl p-6 space-y-5"
            >
              {/* Section Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono tabular-nums font-semibold text-slate-700">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{sec.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {slot?.startClock} – {slot?.endClock}
                    </span>
                  </div>

                  <input
                    type="text"
                    aria-label={`Topic ${idx + 1} title`}
                    value={sec.title}
                    onChange={(e) =>
                      updateSection(sec.id, (prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="w-full font-display text-lg font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none py-0.5"
                  />
                </div>

                {/* Duration & Section Controls */}
                <div className="no-print flex items-center gap-2 shrink-0">
                  <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                    <button
                      type="button"
                      onClick={() =>
                        updateSection(sec.id, (prev) => ({
                          ...prev,
                          allocatedMinutes: Math.max(1, prev.allocatedMinutes - 1),
                        }))
                      }
                      aria-label={`Decrease duration for ${sec.title}`}
                      className="px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-l-lg cursor-pointer"
                    >
                      −
                    </button>
                    <span className="px-2.5 py-1.5 text-xs font-mono tabular-nums font-semibold text-slate-900 min-w-[46px] text-center">
                      {sec.allocatedMinutes}m
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSection(sec.id, (prev) => ({
                          ...prev,
                          allocatedMinutes: Math.min(240, prev.allocatedMinutes + 1),
                        }))
                      }
                      aria-label={`Increase duration for ${sec.title}`}
                      className="px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-r-lg cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateSection(sec.id, (prev) => ({
                        ...prev,
                        locked: !prev.locked,
                      }))
                    }
                    title={
                      sec.locked
                        ? 'Duration locked during re-scaling'
                        : 'Lock this section duration'
                    }
                    aria-label={sec.locked ? 'Unlock duration' : 'Lock duration'}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      sec.locked
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {sec.locked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => moveSection(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Move section up"
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => moveSection(idx, 1)}
                    disabled={idx === agenda.sections.length - 1}
                    aria-label="Move section down"
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeSection(sec.id)}
                    disabled={agenda.sections.length <= 1}
                    aria-label="Remove section"
                    className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Topic Summary & Talking Points */}
              <div className="space-y-3">
                <textarea
                  rows={2}
                  aria-label={`Topic ${idx + 1} summary`}
                  value={sec.summary}
                  onChange={(e) =>
                    updateSection(sec.id, (prev) => ({
                      ...prev,
                      summary: e.target.value,
                    }))
                  }
                  className="w-full text-sm text-slate-700 leading-relaxed bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none rounded-md px-2 -mx-2 py-1 resize-none"
                />

                {sec.keyTalkingPoints.length > 0 && (
                  <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-5">
                    {sec.keyTalkingPoints.map((point, ptIdx) => (
                      <li key={ptIdx}>{point}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* How to Time This Section */}
              <div className="pt-4 border-t border-slate-100 flex items-start gap-2.5 text-sm">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-800 mr-2">
                    Section timing plan:
                  </span>
                  <span className="text-slate-600">
                    {sec.timingRationale ||
                      `Allocate ${sec.allocatedMinutes} minutes for overview and decision lock.`}
                  </span>
                </div>
              </div>

              {/* Stakeholders (Zero-pill inline typography) */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Stakeholders involved
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setAddingStakeholderFor(
                        addingStakeholderFor === sec.id ? null : sec.id
                      )
                    }
                    className="no-print text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add person</span>
                  </button>
                </div>

                {sec.stakeholders.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No specific stakeholders assigned to this topic yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-700">
                    {sec.stakeholders.map((st, stIdx) => (
                      <span key={st.id} className="inline-flex items-center gap-1.5">
                        <span className="font-medium text-slate-900">{st.name}</span>
                        <span className="text-slate-500 text-xs">
                          ({st.role} · {st.responsibility})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateSection(sec.id, (prev) => ({
                              ...prev,
                              stakeholders: prev.stakeholders.filter(
                                (item) => item.id !== st.id
                              ),
                            }))
                          }
                          aria-label={`Remove ${st.name}`}
                          className="no-print text-slate-300 hover:text-red-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {stIdx < sec.stakeholders.length - 1 && (
                          <span className="text-slate-300 ml-1" aria-hidden="true">
                            /
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {addingStakeholderFor === sec.id && (
                  <div className="no-print pt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={newStakeholderName}
                      onChange={(e) => setNewStakeholderName(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    />
                    <input
                      type="text"
                      placeholder="Role / Team"
                      value={newStakeholderRole}
                      onChange={(e) => setNewStakeholderRole(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    />
                    <select
                      value={newStakeholderResp}
                      onChange={(e) => setNewStakeholderResp(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    >
                      <option value="Lead">Lead</option>
                      <option value="Presenter">Presenter</option>
                      <option value="Decision Maker">Decision Maker</option>
                      <option value="Contributor">Contributor</option>
                      <option value="Consulted">Consulted</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAddStakeholder(sec.id)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Action Items */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Action items ({sec.actionItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setAddingActionFor(addingActionFor === sec.id ? null : sec.id)
                    }
                    className="no-print text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add action item</span>
                  </button>
                </div>

                {sec.actionItems.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No action items logged for this section.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {sec.actionItems.map((item) => (
                      <li
                        key={item.id}
                        className="py-2.5 flex items-start justify-between gap-4 text-sm"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              updateSection(sec.id, (prev) => ({
                                ...prev,
                                actionItems: prev.actionItems.map((a) =>
                                  a.id === item.id
                                    ? { ...a, completed: !a.completed }
                                    : a
                                ),
                              }))
                            }
                            aria-label={`Mark "${item.task}" as ${
                              item.completed ? 'incomplete' : 'complete'
                            }`}
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                              item.completed
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 hover:border-blue-500 bg-white'
                            }`}
                          >
                            {item.completed && <Check className="w-3 h-3" />}
                          </button>
                          <div className="min-w-0">
                            <p
                              className={`text-sm ${
                                item.completed
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800'
                              }`}
                            >
                              {item.task}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              <span>Owner: {item.owner}</span>
                              <span aria-hidden="true"> · </span>
                              <span>Due: {item.dueWindow}</span>
                              <span aria-hidden="true"> · </span>
                              <span
                                className={
                                  item.priority === 'High'
                                    ? 'text-red-700 font-medium'
                                    : item.priority === 'Medium'
                                    ? 'text-amber-700 font-medium'
                                    : 'text-slate-600'
                                }
                              >
                                {item.priority} priority
                              </span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            updateSection(sec.id, (prev) => ({
                              ...prev,
                              actionItems: prev.actionItems.filter(
                                (a) => a.id !== item.id
                              ),
                            }))
                          }
                          aria-label="Delete action item"
                          className="no-print p-1 text-slate-300 hover:text-red-600 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {addingActionFor === sec.id && (
                  <div className="no-print pt-2 grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Action item description..."
                      value={newActionTask}
                      onChange={(e) => setNewActionTask(e.target.value)}
                      className="sm:col-span-5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    />
                    <input
                      type="text"
                      placeholder="Owner"
                      value={newActionOwner}
                      onChange={(e) => setNewActionOwner(e.target.value)}
                      className="sm:col-span-3 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    />
                    <input
                      type="text"
                      placeholder="Due window"
                      value={newActionDue}
                      onChange={(e) => setNewActionDue(e.target.value)}
                      className="sm:col-span-2 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    />
                    <div className="sm:col-span-2 flex items-center gap-1.5">
                      <select
                        value={newActionPriority}
                        onChange={(e) =>
                          setNewActionPriority(e.target.value as ActionPriority)
                        }
                        className="flex-1 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddActionItem(sec.id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Add Section Button */}
      <div className="no-print">
        <button
          type="button"
          onClick={addSection}
          className="w-full py-3 px-4 border border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Agenda Section</span>
        </button>
      </div>
    </div>
  );
};
