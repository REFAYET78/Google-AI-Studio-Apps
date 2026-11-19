import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Scale,
} from 'lucide-react';
import type { AgendaDocument, WorkspaceTab } from '../types/agenda';
import {
  formatAgendaMarkdown,
  scaleSectionsProportionally,
} from '../utils/agendaHelpers';
import { exportAgendaToPdf } from '../utils/exportAgendaPdf';
import { ActionMatrix } from './ActionMatrix';
import { AgendaOverview } from './AgendaOverview';
import { StakeholdersView } from './StakeholdersView';
import { TimeRunbook } from './TimeRunbook';

interface AgendaStudioProps {
  agenda: AgendaDocument;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onUpdateAgenda: (updater: (prev: AgendaDocument) => AgendaDocument) => void;
  onRetimeWithAI: (targetMinutes: number) => Promise<void>;
  isRetiming: boolean;
  retimeError: string | null;
  savedAgendas: AgendaDocument[];
  onOpenSavedAgenda: (agenda: AgendaDocument) => void;
}

const QUICK_MINUTES = [30, 45, 60, 90];

export const AgendaStudio: React.FC<AgendaStudioProps> = ({
  agenda,
  activeTab,
  onSelectTab,
  onUpdateAgenda,
  onRetimeWithAI,
  isRetiming,
  retimeError,
  savedAgendas,
  onOpenSavedAgenda,
}) => {
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [exportedPdf, setExportedPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const allocatedSum = agenda.sections.reduce(
    (acc, sec) => acc + sec.allocatedMinutes,
    0
  );
  const delta = allocatedSum - agenda.totalMinutes;
  const isBalanced = delta === 0;

  const handleTargetMinutesChange = (newTarget: number) => {
    const clamped = Math.min(480, Math.max(5, Math.round(newTarget)));
    onUpdateAgenda((prev) => ({
      ...prev,
      totalMinutes: clamped,
    }));
  };

  const handleScaleProportionally = () => {
    onUpdateAgenda((prev) => ({
      ...prev,
      sections: scaleSectionsProportionally(prev.sections, prev.totalMinutes),
    }));
  };

  const handleCopyMarkdown = async () => {
    const md = formatAgendaMarkdown(agenda);
    await navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = formatAgendaMarkdown(agenda);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const slug = agenda.meetingTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'meeting-agenda'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    setPdfError(null);
    try {
      exportAgendaToPdf(agenda);
      setExportedPdf(true);
      setTimeout(() => setExportedPdf(false), 2500);
    } catch (err: unknown) {
      setPdfError(
        err instanceof Error ? err.message : 'Unable to generate PDF file.'
      );
    }
  };

  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'overview', label: 'Agenda' },
    { id: 'runbook', label: 'Runbook' },
    { id: 'actions', label: 'Actions' },
    { id: 'stakeholders', label: 'Stakeholders' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 items-start">
      {/* Mobile View Switcher */}
      <div className="no-print md:hidden w-full flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTab(t.id)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === t.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Left Workspace Sidebar (280px on desktop) */}
      <aside className="no-print w-full lg:w-[280px] shrink-0 space-y-6">
        {/* Time Budget Control Panel */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Time budget & pacing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust total meeting length or start time.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="studio-total-minutes" className="font-medium text-slate-700">
                Target total minutes
              </label>
              <span className="font-mono tabular-nums text-slate-500">
                {agenda.totalMinutes}m
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleTargetMinutesChange(m)}
                  className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded-md border transition-colors cursor-pointer ${
                    agenda.totalMinutes === m
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="studio-total-minutes"
                type="number"
                min={5}
                max={480}
                value={agenda.totalMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!Number.isNaN(val)) handleTargetMinutesChange(val);
                }}
                className="w-24 px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <span className="text-xs text-slate-500">minutes</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="studio-start-time"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Meeting start time
            </label>
            <input
              id="studio-start-time"
              type="time"
              value={agenda.startTime}
              onChange={(e) =>
                onUpdateAgenda((prev) => ({ ...prev, startTime: e.target.value }))
              }
              className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Budget Allocation Status */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Allocated across topics</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {allocatedSum}m / {agenda.totalMinutes}m
              </span>
            </div>

            <div
              className={`flex items-center gap-2 text-xs font-medium ${
                isBalanced
                  ? 'text-emerald-700'
                  : delta > 0
                  ? 'text-red-700'
                  : 'text-amber-700'
              }`}
            >
              {isBalanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Schedule matches target duration</span>
                </>
              ) : delta > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Over budget by {delta} min</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{Math.abs(delta)} min unallocated</span>
                </>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleScaleProportionally}
                disabled={isBalanced}
                className="w-full py-2 px-3 text-xs font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-45 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Scale sections to {agenda.totalMinutes}m</span>
              </button>

              <button
                type="button"
                onClick={() => onRetimeWithAI(agenda.totalMinutes)}
                disabled={isRetiming}
                className="w-full py-2 px-3 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-55 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isRetiming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Re-balancing with AI...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-balance pacing with AI</span>
                  </>
                )}
              </button>

              {retimeError && (
                <p className="text-xs text-red-700 leading-snug">{retimeError}</p>
              )}
            </div>
          </div>
        </section>

        {/* Export Panel */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Export agenda
          </h2>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {exportedPdf ? (
                <Check className="w-3.5 h-3.5 text-white shrink-0" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white shrink-0" />
              )}
              <span>{exportedPdf ? 'PDF downloaded' : 'Export as PDF (.pdf)'}</span>
            </button>

            {pdfError && (
              <p className="text-xs text-red-700 leading-snug">{pdfError}</p>
            )}

            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {copiedMarkdown ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              <span>{copiedMarkdown ? 'Copied to clipboard' : 'Copy as Markdown'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Download .md file</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Print view</span>
            </button>
          </div>
        </section>

        {/* Source File Info */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Source document</span>
          </div>
          <p className="text-xs font-medium text-slate-900 break-all">
            {agenda.sourceFileName}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {agenda.sourceFileType}
            {agenda.sourceWordCount > 0
              ? ` · ${agenda.sourceWordCount.toLocaleString()} words`
              : ''}
          </p>
        </section>

        {/* Saved Agendas Switcher */}
        {savedAgendas.length > 1 && (
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Recent agendas
            </h2>
            <ul className="divide-y divide-slate-100">
              {savedAgendas.slice(0, 5).map((item) => (
                <li key={item.id} className="py-2 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => onOpenSavedAgenda(item)}
                    className={`w-full text-left text-xs transition-colors cursor-pointer ${
                      item.id === agenda.id
                        ? 'font-semibold text-blue-700'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="truncate">{item.meetingTitle}</div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                      {item.totalMinutes}m · {item.sections.length} topics
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="print-full flex-1 min-w-0 w-full">
        {activeTab === 'overview' && (
          <AgendaOverview agenda={agenda} onUpdateAgenda={onUpdateAgenda} />
        )}
        {activeTab === 'runbook' && <TimeRunbook agenda={agenda} />}
        {activeTab === 'actions' && (
          <ActionMatrix agenda={agenda} onUpdateAgenda={onUpdateAgenda} />
        )}
        {activeTab === 'stakeholders' && <StakeholdersView agenda={agenda} />}
      </main>
    </div>
  );
};
