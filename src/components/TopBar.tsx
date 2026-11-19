import React from 'react';
import type { WorkspaceTab } from '../types/agenda';

interface TopBarProps {
  hasAgenda: boolean;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onNewAgenda: () => void;
  onJumpToSection: (anchorId: string) => void;
  onTriggerFilePicker?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  hasAgenda,
  activeTab,
  onSelectTab,
  onNewAgenda,
  onJumpToSection,
  onTriggerFilePicker,
}) => {
  const workspaceLinks: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'overview', label: 'Agenda' },
    { id: 'runbook', label: 'Time Runbook' },
    { id: 'actions', label: 'Action Items' },
    { id: 'stakeholders', label: 'Stakeholders' },
  ];

  return (
    <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={onNewAgenda}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
        >
          Cadence
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {hasAgenda ? (
            workspaceLinks.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onSelectTab(link.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isActive
                      ? 'border-blue-600 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {link.label}
                </button>
              );
            })
          ) : (
            <>
              <button
                type="button"
                onClick={() => onJumpToSection('intake-panel')}
                className="py-1.5 text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Upload Document
              </button>
              <button
                type="button"
                onClick={() => onJumpToSection('timing-panel')}
                className="py-1.5 text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Meeting Timing
              </button>
              <button
                type="button"
                onClick={() => onJumpToSection('recent-agendas')}
                className="py-1.5 text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Saved Agendas
              </button>
              <button
                type="button"
                onClick={() => onJumpToSection('supported-formats')}
                className="py-1.5 text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Supported Formats
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="shrink-0">
          {hasAgenda ? (
            <button
              type="button"
              onClick={onNewAgenda}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              New Agenda
            </button>
          ) : (
            <button
              type="button"
              onClick={onTriggerFilePicker}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Upload File
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
