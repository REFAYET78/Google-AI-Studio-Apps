import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  FileText,
  FolderOpen,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AgendaDocument, MeetingFormat } from '../types/agenda';
import { SAMPLE_BRIEF_FILENAME, SAMPLE_BRIEF_TEXT } from '../utils/agendaHelpers';

interface UploadWorkspaceProps {
  onCraftAgenda: (payload: {
    fileName: string;
    fileType: string;
    rawText?: string;
    contentBase64?: string;
    totalMinutes: number;
    startTime: string;
    meetingFormat: MeetingFormat;
    facilitatorNotes?: string;
  }) => Promise<void>;
  isCrafting: boolean;
  errorMessage: string | null;
  savedAgendas: AgendaDocument[];
  onOpenSavedAgenda: (agenda: AgendaDocument) => void;
  onDeleteSavedAgenda: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
const FORMAT_OPTIONS: MeetingFormat[] = [
  'Decision & Alignment',
  'Project Kickoff',
  'Weekly Review',
  'Executive Briefing',
  'Working Session',
];

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export const UploadWorkspace: React.FC<UploadWorkspaceProps> = ({
  onCraftAgenda,
  isCrafting,
  errorMessage,
  savedAgendas,
  onOpenSavedAgenda,
  onDeleteSavedAgenda,
  fileInputRef,
}) => {
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [dragActive, setDragActive] = useState(false);

  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<number>(0);
  const [fileBase64, setFileBase64] = useState<string | undefined>(undefined);
  const [rawText, setRawText] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  const [totalMinutes, setTotalMinutes] = useState<number>(45);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [meetingFormat, setMeetingFormat] = useState<MeetingFormat>('Decision & Alignment');
  const [facilitatorNotes, setFacilitatorNotes] = useState<string>('');

  const pasteTitleRef = useRef<HTMLInputElement | null>(null);
  const [pastedDocTitle, setPastedDocTitle] = useState<string>('meeting-notes.md');

  const handleFile = async (file: File) => {
    setLocalError(null);
    const lower = file.name.toLowerCase();
    const supported =
      lower.endsWith('.docx') ||
      lower.endsWith('.md') ||
      lower.endsWith('.markdown') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.pdf');

    if (lower.endsWith('.doc')) {
      setLocalError(
        'Legacy .doc binary files cannot be parsed directly. Please save as .docx, .md, .txt, or .pdf.'
      );
      return;
    }

    if (!supported) {
      setLocalError(
        'Unsupported file type. Please upload a Word (.docx), Markdown (.md), Text (.txt), or PDF (.pdf) file.'
      );
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setLocalError('File exceeds the 15 MB limit. Please upload a smaller document.');
      return;
    }

    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);

    if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
      const text = await file.text();
      setRawText(text);
      setFileBase64(undefined);
    } else {
      const buffer = await file.arrayBuffer();
      setFileBase64(arrayBufferToBase64(buffer));
      setRawText('');
    }
    setInputMode('file');
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleLoadSample = () => {
    setLocalError(null);
    setInputMode('paste');
    setPastedDocTitle(SAMPLE_BRIEF_FILENAME);
    setSelectedFileName(SAMPLE_BRIEF_FILENAME);
    setSelectedFileSize(new Blob([SAMPLE_BRIEF_TEXT]).size);
    setRawText(SAMPLE_BRIEF_TEXT);
    setFileBase64(undefined);
    setTotalMinutes(45);
    setMeetingFormat('Decision & Alignment');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (inputMode === 'file') {
      if (!selectedFileName || (!rawText && !fileBase64)) {
        setLocalError('Upload a Word (.docx), Markdown (.md), Text (.txt), or PDF document first.');
        return;
      }
      await onCraftAgenda({
        fileName: selectedFileName,
        fileType: selectedFileName.split('.').pop()?.toUpperCase() || 'DOC',
        rawText: rawText || undefined,
        contentBase64: fileBase64,
        totalMinutes,
        startTime,
        meetingFormat,
        facilitatorNotes,
      });
    } else {
      if (!rawText.trim()) {
        setLocalError('Paste your document or meeting brief text before crafting an agenda.');
        return;
      }
      const cleanName = (pastedDocTitle.trim() || 'pasted-brief.md').replace(/\s+/g, '-');
      await onCraftAgenda({
        fileName: cleanName,
        fileType: cleanName.endsWith('.txt') ? 'TXT' : 'MD',
        rawText,
        totalMinutes,
        startTime,
        meetingFormat,
        facilitatorNotes,
      });
    }
  };

  const displayError = localError || errorMessage;
  const wordPreviewCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;

  return (
    <main className="max-w-[1440px] mx-auto px-6 py-10 space-y-12">
      {/* Intro Heading */}
      <section className="max-w-3xl space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
          Turn any document into a time-boxed meeting agenda
        </h1>
        <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
          Upload a Word (.docx), Markdown (.md), Text, or PDF document and specify your total meeting duration. Cadence extracts topic summaries, assigns stakeholders, lists action items, and allocates exact minutes to every section.
        </p>
      </section>

      {/* Main 2-column Split */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Document Intake (7 cols) */}
        <section
          id="intake-panel"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setInputMode('file')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  inputMode === 'file'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  inputMode === 'paste'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paste Markdown / Text
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadSample}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Load sample product brief
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.md,.markdown,.txt,.pdf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await handleFile(file);
              e.target.value = '';
            }}
          />

          {inputMode === 'file' ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                }`}
              >
                <div className="mx-auto w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center mb-4 text-slate-700">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-base font-medium text-slate-900">
                  Drop your Word or Markdown document here, or click to browse
                </p>
                <p className="mt-1.5 text-sm text-slate-500">
                  Supports .docx, .md, .markdown, .txt, and .pdf up to 15 MB
                </p>
              </div>

              {selectedFileName && (
                <div className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {selectedFileName}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {selectedFileSize > 0
                          ? `${(selectedFileSize / 1024).toFixed(1)} KB`
                          : 'Ready'}
                        {wordPreviewCount > 0 ? ` · ${wordPreviewCount.toLocaleString()} words` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFileName('');
                      setSelectedFileSize(0);
                      setFileBase64(undefined);
                      setRawText('');
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="paste-doc-title"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Document reference name
                </label>
                <input
                  id="paste-doc-title"
                  ref={pasteTitleRef}
                  type="text"
                  value={pastedDocTitle}
                  onChange={(e) => setPastedDocTitle(e.target.value)}
                  placeholder="e.g. q4-roadmap-review.md"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="paste-doc-content"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Document content
                  </label>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {wordPreviewCount.toLocaleString()} words
                  </span>
                </div>
                <textarea
                  id="paste-doc-content"
                  rows={10}
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    setFileBase64(undefined);
                  }}
                  placeholder="Paste Markdown headings, project proposals, PRD sections, or rough notes here..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 leading-relaxed focus:outline-none focus:border-blue-600 font-sans"
                />
              </div>
            </div>
          )}

          {/* Supported Formats Strip */}
          <div
            id="supported-formats"
            className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"
          >
            <span className="font-medium text-slate-700">Accepted inputs:</span>
            <span>Microsoft Word (.docx)</span>
            <span aria-hidden="true">·</span>
            <span>Markdown (.md, .markdown)</span>
            <span aria-hidden="true">·</span>
            <span>Plain Text (.txt)</span>
            <span aria-hidden="true">·</span>
            <span>PDF (.pdf)</span>
          </div>
        </section>

        {/* Right: Meeting Timing & Configuration (5 cols) */}
        <section
          id="timing-panel"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Meeting timing & structure
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Set total duration and start time to allocate exact timeboxes.
            </p>
          </div>

          {/* Total Meeting Time */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="total-minutes-input"
                className="text-sm font-medium text-slate-700"
              >
                Total meeting time (minutes)
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {totalMinutes} min
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTotalMinutes(preset)}
                  className={`py-2 text-xs font-mono tabular-nums font-medium rounded-md border transition-colors cursor-pointer ${
                    totalMinutes === preset
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                id="total-minutes-input"
                type="number"
                min={5}
                max={480}
                value={totalMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!Number.isNaN(val)) {
                    setTotalMinutes(Math.min(480, Math.max(5, val)));
                  }
                }}
                className="w-28 px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <span className="text-sm text-slate-500">minutes total (5–480m)</span>
            </div>
          </div>

          {/* Start Time & Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="start-time-input"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Start time
              </label>
              <input
                id="start-time-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="meeting-format-select"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Meeting format
              </label>
              <select
                id="meeting-format-select"
                value={meetingFormat}
                onChange={(e) => setMeetingFormat(e.target.value as MeetingFormat)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {FORMAT_OPTIONS.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Facilitator Focus Notes */}
          <div>
            <label
              htmlFor="facilitator-notes"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Facilitator instructions (optional)
            </label>
            <textarea
              id="facilitator-notes"
              rows={2}
              value={facilitatorNotes}
              onChange={(e) => setFacilitatorNotes(e.target.value)}
              placeholder="e.g. Prioritize cutover risks and leave 10 minutes for legal sign-off."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          {displayError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isCrafting}
            className="w-full py-3 px-5 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {isCrafting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Crafting {totalMinutes}-minute agenda...</span>
              </>
            ) : (
              <>
                <span>Craft Meeting Agenda</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </section>
      </form>

      {/* Saved Agendas History */}
      <section id="recent-agendas" className="pt-4 border-t border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Recent crafted agendas
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {savedAgendas.length} saved locally
          </span>
        </div>

        {savedAgendas.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <FolderOpen className="w-6 h-6 text-slate-400 mx-auto mb-2.5" />
            <p className="text-sm font-medium text-slate-700">No agendas crafted yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Upload a Word or Markdown document above, or load the sample product brief to generate your first agenda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedAgendas.map((item) => {
              const totalActions = item.sections.reduce(
                (acc, s) => acc + s.actionItems.length,
                0
              );
              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">{item.sourceFileName}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {item.totalMinutes}m
                      </span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-slate-900 line-clamp-2">
                      {item.meetingTitle}
                    </h3>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {item.sections.length} topics · {totalActions} action items ·{' '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onOpenSavedAgenda(item)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Open agenda
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSavedAgenda(item.id)}
                      aria-label={`Delete ${item.meetingTitle}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
