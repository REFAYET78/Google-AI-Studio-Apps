import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import type { AgendaDocument } from '../types/agenda';
import { calculateScheduleTimes } from '../utils/agendaHelpers';

interface TimeRunbookProps {
  agenda: AgendaDocument;
}

function formatSeconds(sec: number): string {
  const abs = Math.abs(sec);
  const mins = Math.floor(abs / 60);
  const rem = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const TimeRunbook: React.FC<TimeRunbookProps> = ({ agenda }) => {
  const schedule = calculateScheduleTimes(agenda.sections, agenda.startTime);

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(
    (agenda.sections[0]?.allocatedMinutes || 5) * 60
  );

  // Sync timer when sections change or active index changes while paused
  useEffect(() => {
    if (!isRunning) {
      const targetSec = (agenda.sections[activeIndex]?.allocatedMinutes || 5) * 60;
      setSecondsLeft(targetSec);
    }
  }, [activeIndex, agenda.sections, isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const activeSection = agenda.sections[activeIndex];
  const isOvertime = secondsLeft < 0;

  const handleSelectSection = (idx: number) => {
    setIsRunning(false);
    setActiveIndex(idx);
    setSecondsLeft((agenda.sections[idx]?.allocatedMinutes || 5) * 60);
  };

  const handleNextSection = () => {
    if (activeIndex < agenda.sections.length - 1) {
      const nextIdx = activeIndex + 1;
      setActiveIndex(nextIdx);
      setSecondsLeft((agenda.sections[nextIdx]?.allocatedMinutes || 5) * 60);
    } else {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft((agenda.sections[activeIndex]?.allocatedMinutes || 5) * 60);
  };

  return (
    <div className="space-y-8">
      {/* Live Facilitator Timer */}
      {activeSection && (
        <section className="no-print bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Topic {activeIndex + 1} of {agenda.sections.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {schedule[activeSection.id]?.startClock} –{' '}
                {schedule[activeSection.id]?.endClock}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeSection.allocatedMinutes} min budget</span>
            </div>
            <h2 className="font-display text-xl font-semibold text-slate-900 truncate">
              {activeSection.title}
            </h2>
            {activeSection.timingRationale && (
              <p className="text-sm text-slate-600">
                Pacing guide: {activeSection.timingRationale}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="text-right">
              <div
                className={`font-mono text-3xl font-semibold tabular-nums tracking-tight ${
                  isOvertime ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {formatSeconds(secondsLeft)}
              </div>
              <p className="text-xs text-slate-500">
                {isOvertime ? 'Overtime on topic' : 'Remaining in section'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRunning((r) => !r)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Start Timer</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNextSection}
                disabled={activeIndex >= agenda.sections.length - 1}
                className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
                <span>Next Topic</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset current section timer"
                className="p-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* High-Density Runbook Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Minute-by-Minute Facilitator Runbook
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any row to load that topic into the live meeting timer.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Total:{' '}
            {agenda.sections.reduce((acc, s) => acc + s.allocatedMinutes, 0)}m
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-6 whitespace-nowrap">Clock</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Duration</th>
                <th className="py-3 px-4">Topic & Category</th>
                <th className="py-3 px-4">Lead / Owner</th>
                <th className="py-3 px-6">How to Time This Section</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {agenda.sections.map((sec, idx) => {
                const slot = schedule[sec.id];
                const lead =
                  sec.stakeholders.find((s) =>
                    s.responsibility.toLowerCase().includes('lead')
                  ) || sec.stakeholders[0];
                const isSelected = idx === activeIndex;

                return (
                  <tr
                    key={sec.id}
                    onClick={() => handleSelectSection(idx)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3.5 px-6 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                      {slot.startClock} – {slot.endClock}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs tabular-nums font-semibold text-slate-900 text-right whitespace-nowrap">
                      {sec.allocatedMinutes}m
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">
                        {String(idx + 1).padStart(2, '0')}. {sec.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {sec.category} · {sec.actionItems.length} action items
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {lead ? `${lead.name} (${lead.role})` : 'Facilitator'}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 text-xs leading-relaxed">
                      {sec.timingRationale || 'Open discussion and alignment'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
