export type ActionPriority = 'High' | 'Medium' | 'Low';

export type MeetingFormat =
  | 'Decision & Alignment'
  | 'Project Kickoff'
  | 'Weekly Review'
  | 'Executive Briefing'
  | 'Working Session';

export type WorkspaceTab = 'overview' | 'runbook' | 'actions' | 'stakeholders';

export interface SectionStakeholder {
  id: string;
  name: string;
  role: string;
  responsibility: string;
}

export interface ActionItem {
  id: string;
  task: string;
  owner: string;
  dueWindow: string;
  priority: ActionPriority;
  completed: boolean;
}

export interface AgendaSection {
  id: string;
  order: number;
  title: string;
  category: string;
  allocatedMinutes: number;
  locked?: boolean;
  summary: string;
  keyTalkingPoints: string[];
  timingRationale: string;
  stakeholders: SectionStakeholder[];
  actionItems: ActionItem[];
}

export interface UnassignedStakeholder {
  name: string;
  role: string;
  context: string;
}

export interface AgendaDocument {
  id: string;
  createdAt: string;
  sourceFileName: string;
  sourceFileType: string;
  sourceWordCount: number;
  meetingTitle: string;
  executiveSummary: string;
  recommendedFormat: string;
  totalMinutes: number;
  startTime: string;
  preReadNotes: string[];
  sections: AgendaSection[];
  unassignedStakeholders: UnassignedStakeholder[];
}

export interface CraftAgendaRequest {
  fileName: string;
  fileType: string;
  rawText?: string;
  contentBase64?: string;
  totalMinutes: number;
  startTime: string;
  meetingFormat: MeetingFormat;
  facilitatorNotes?: string;
}

export interface RetimeAgendaRequest {
  meetingTitle: string;
  targetMinutes: number;
  sections: AgendaSection[];
}
