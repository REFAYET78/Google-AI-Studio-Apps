/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { AgendaStudio } from './components/AgendaStudio';
import { TopBar } from './components/TopBar';
import { UploadWorkspace } from './components/UploadWorkspace';
import type {
  AgendaDocument,
  AgendaSection,
  CraftAgendaRequest,
  WorkspaceTab,
} from './types/agenda';

const STORAGE_KEY = 'cadence_saved_agendas_v1';

function loadSavedAgendas(): AgendaDocument[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AgendaDocument[]) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [savedAgendas, setSavedAgendas] = useState<AgendaDocument[]>(() =>
    loadSavedAgendas()
  );
  const [activeAgendaId, setActiveAgendaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  const [isCrafting, setIsCrafting] = useState(false);
  const [craftError, setCraftError] = useState<string | null>(null);

  const [isRetiming, setIsRetiming] = useState(false);
  const [retimeError, setRetimeError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(savedAgendas.slice(0, 12))
      );
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [savedAgendas]);

  const activeAgenda =
    savedAgendas.find((item) => item.id === activeAgendaId) || null;

  const handleCraftAgenda = async (payload: CraftAgendaRequest) => {
    setIsCrafting(true);
    setCraftError(null);
    try {
      const response = await fetch('/api/agenda/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to craft meeting agenda.');
      }

      const crafted = data as AgendaDocument;
      setSavedAgendas((prev) => [crafted, ...prev]);
      setActiveAgendaId(crafted.id);
      setActiveTab('overview');
    } catch (err: unknown) {
      setCraftError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while crafting your agenda.'
      );
    } finally {
      setIsCrafting(false);
    }
  };

  const handleUpdateActiveAgenda = (
    updater: (prev: AgendaDocument) => AgendaDocument
  ) => {
    if (!activeAgendaId) return;
    setSavedAgendas((prev) =>
      prev.map((item) => (item.id === activeAgendaId ? updater(item) : item))
    );
  };

  const handleRetimeWithAI = async (targetMinutes: number) => {
    if (!activeAgenda) return;
    setIsRetiming(true);
    setRetimeError(null);
    try {
      const response = await fetch('/api/agenda/retime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingTitle: activeAgenda.meetingTitle,
          targetMinutes,
          sections: activeAgenda.sections,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to re-balance agenda timing.');
      }

      const retimedSections = data.sections as AgendaSection[];
      handleUpdateActiveAgenda((prev) => ({
        ...prev,
        totalMinutes: targetMinutes,
        sections: retimedSections,
      }));
    } catch (err: unknown) {
      setRetimeError(
        err instanceof Error ? err.message : 'Unable to re-balance timing.'
      );
    } finally {
      setIsRetiming(false);
    }
  };

  const handleDeleteSavedAgenda = (id: string) => {
    setSavedAgendas((prev) => prev.filter((item) => item.id !== id));
    if (activeAgendaId === id) {
      setActiveAgendaId(null);
    }
  };

  const handleJumpToSection = (anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        hasAgenda={Boolean(activeAgenda)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewAgenda={() => {
          setActiveAgendaId(null);
          setCraftError(null);
          setRetimeError(null);
        }}
        onJumpToSection={handleJumpToSection}
        onTriggerFilePicker={() => fileInputRef.current?.click()}
      />

      <div className="flex-1">
        {activeAgenda ? (
          <AgendaStudio
            agenda={activeAgenda}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onUpdateAgenda={handleUpdateActiveAgenda}
            onRetimeWithAI={handleRetimeWithAI}
            isRetiming={isRetiming}
            retimeError={retimeError}
            savedAgendas={savedAgendas}
            onOpenSavedAgenda={(item) => {
              setActiveAgendaId(item.id);
              setActiveTab('overview');
              setRetimeError(null);
            }}
          />
        ) : (
          <UploadWorkspace
            onCraftAgenda={handleCraftAgenda}
            isCrafting={isCrafting}
            errorMessage={craftError}
            savedAgendas={savedAgendas}
            onOpenSavedAgenda={(item) => {
              setActiveAgendaId(item.id);
              setActiveTab('overview');
              setRetimeError(null);
            }}
            onDeleteSavedAgenda={handleDeleteSavedAgenda}
            fileInputRef={fileInputRef}
          />
        )}
      </div>
    </div>
  );
}
