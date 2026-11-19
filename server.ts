import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ActionItem,
  AgendaDocument,
  AgendaSection,
  CraftAgendaRequest,
  RetimeAgendaRequest,
  SectionStakeholder,
  UnassignedStakeholder,
} from './src/types/agenda.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: number }).status)
          : 0;
      const isTransient = status === 429 || status >= 500 || status === 0;
      if (!isTransient || attempt === maxRetries) {
        break;
      }
      const delayMs = 700 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: number }).status)
      : 500;

  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return { status: 500, message: rawMessage };
  }
  if (status === 403 || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message:
        'Gemini API key was rejected or lacks permission. Please verify your key in Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Gemini API rate limit or quota reached. Please wait a moment and try again.',
    };
  }
  if (status === 404 || rawMessage.includes('NOT_FOUND')) {
    return {
      status: 502,
      message: `Configured Gemini model (${MODEL_NAME}) was not found or is unavailable.`,
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage || 'Failed to generate meeting agenda.',
  };
}

function normalizeSectionDurations(
  sections: AgendaSection[],
  targetMinutes: number
): AgendaSection[] {
  if (sections.length === 0) return sections;

  const safeTarget = Math.max(sections.length, Math.round(targetMinutes));
  const lockedSum = sections
    .filter((s) => s.locked)
    .reduce((acc, s) => acc + Math.max(1, Math.round(s.allocatedMinutes)), 0);

  const unlocked = sections.filter((s) => !s.locked);
  if (unlocked.length === 0) {
    return sections.map((s) => ({
      ...s,
      allocatedMinutes: Math.max(1, Math.round(s.allocatedMinutes)),
    }));
  }

  const remainingBudget = Math.max(unlocked.length, safeTarget - lockedSum);
  const currentUnlockedSum = unlocked.reduce(
    (acc, s) => acc + Math.max(1, s.allocatedMinutes),
    0
  );

  if (currentUnlockedSum === remainingBudget) {
    return sections.map((s) => ({
      ...s,
      allocatedMinutes: Math.max(1, Math.round(s.allocatedMinutes)),
    }));
  }

  const rawAllocations = unlocked.map((s) => {
    const exact = (Math.max(1, s.allocatedMinutes) / currentUnlockedSum) * remainingBudget;
    const floored = Math.max(1, Math.floor(exact));
    return {
      id: s.id,
      floored,
      remainder: exact - floored,
    };
  });

  let allocatedSum = rawAllocations.reduce((acc, item) => acc + item.floored, 0);
  const diff = remainingBudget - allocatedSum;

  if (diff > 0) {
    const sorted = [...rawAllocations].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < diff; i++) {
      sorted[i % sorted.length].floored += 1;
    }
  } else if (diff < 0) {
    const sorted = [...rawAllocations].sort((a, b) => a.remainder - b.remainder);
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

  const allocationMap = new Map(rawAllocations.map((r) => [r.id, r.floored]));
  return sections.map((s, index) => ({
    ...s,
    order: index + 1,
    allocatedMinutes: s.locked
      ? Math.max(1, Math.round(s.allocatedMinutes))
      : allocationMap.get(s.id) ?? Math.max(1, Math.round(s.allocatedMinutes)),
  }));
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const agendaResponseSchema = {
  type: Type.OBJECT,
  properties: {
    meetingTitle: {
      type: Type.STRING,
      description: 'Clear, executive meeting title derived from the uploaded document.',
    },
    executiveSummary: {
      type: Type.STRING,
      description:
        'A concise 2-3 sentence overview stating the meeting purpose, core decisions needed, and expected outcome.',
    },
    recommendedFormat: {
      type: Type.STRING,
      description: 'Meeting style such as Decision & Alignment, Project Kickoff, or Weekly Review.',
    },
    preReadNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-4 specific things attendees should review or prepare before the meeting.',
    },
    sections: {
      type: Type.ARRAY,
      description:
        'Ordered list of agenda topics. Their allocatedMinutes MUST sum exactly to the requested total meeting minutes.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Focused agenda topic title.' },
          category: {
            type: Type.STRING,
            description: 'One of: Opening, Context, Discussion, Decision, Alignment, Wrap-up.',
          },
          allocatedMinutes: {
            type: Type.INTEGER,
            description: 'Whole number of minutes assigned to this section.',
          },
          summary: {
            type: Type.STRING,
            description:
              '2-4 sentence factual summary of what the source document says on this topic and what needs to be covered.',
          },
          keyTalkingPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2-5 concrete discussion prompts or key points from the document.',
          },
          timingRationale: {
            type: Type.STRING,
            description:
              'Explicit pacing breakdown explaining how to spend the allocated minutes (e.g., "3m context recap, 7m risk trade-offs, 2m decision sign-off").',
          },
          stakeholders: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  description:
                    'Person or team name from the document (or clear role placeholder if unnamed, e.g., "Engineering Lead").',
                },
                role: {
                  type: Type.STRING,
                  description: 'Department, title, or functional role.',
                },
                responsibility: {
                  type: Type.STRING,
                  description:
                    'Role in this topic: Lead, Presenter, Decision Maker, Contributor, or Consulted.',
                },
              },
              required: ['name', 'role', 'responsibility'],
            },
          },
          actionItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                task: {
                  type: Type.STRING,
                  description: 'Specific, actionable next step extracted or implied by this topic.',
                },
                owner: {
                  type: Type.STRING,
                  description: 'Named person or role responsible for completing this action.',
                },
                dueWindow: {
                  type: Type.STRING,
                  description: 'Suggested timeframe such as "Before next sync", "Within 48h", or date from doc.',
                },
                priority: {
                  type: Type.STRING,
                  description: 'Must be exactly High, Medium, or Low.',
                },
              },
              required: ['task', 'owner', 'dueWindow', 'priority'],
            },
          },
        },
        required: [
          'title',
          'category',
          'allocatedMinutes',
          'summary',
          'keyTalkingPoints',
          'timingRationale',
          'stakeholders',
          'actionItems',
        ],
      },
    },
    unassignedStakeholders: {
      type: Type.ARRAY,
      description: 'Additional stakeholders mentioned in the document who should be informed or optional.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          context: { type: Type.STRING },
        },
        required: ['name', 'role', 'context'],
      },
    },
  },
  required: [
    'meetingTitle',
    'executiveSummary',
    'recommendedFormat',
    'preReadNotes',
    'sections',
    'unassignedStakeholders',
  ],
};

const retimeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          allocatedMinutes: { type: Type.INTEGER },
          timingRationale: {
            type: Type.STRING,
            description:
              'Updated pacing breakdown matching the new allocatedMinutes for this topic.',
          },
        },
        required: ['id', 'allocatedMinutes', 'timingRationale'],
      },
    },
  },
  required: ['sections'],
};

interface RawCraftResponse {
  meetingTitle?: string;
  executiveSummary?: string;
  recommendedFormat?: string;
  preReadNotes?: string[];
  sections?: Array<{
    title: string;
    category: string;
    allocatedMinutes: number;
    summary: string;
    keyTalkingPoints: string[];
    timingRationale: string;
    stakeholders: Array<{ name: string; role: string; responsibility: string }>;
    actionItems: Array<{
      task: string;
      owner: string;
      dueWindow: string;
      priority: string;
    }>;
  }>;
  unassignedStakeholders?: UnassignedStakeholder[];
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/agenda/craft', async (req: Request, res: Response) => {
    try {
      const body = req.body as CraftAgendaRequest;
      const fileName = (body.fileName || 'uploaded-document.md').trim();
      const ext = path.extname(fileName).toLowerCase();
      const totalMinutes = Math.min(480, Math.max(5, Math.round(Number(body.totalMinutes) || 45)));
      const startTime = body.startTime || '09:00';
      const meetingFormat = body.meetingFormat || 'Decision & Alignment';
      const facilitatorNotes = (body.facilitatorNotes || '').trim();

      if (ext === '.doc') {
        res.status(400).json({
          error:
            'Legacy binary .doc files are not supported. Please save the Word document as .docx, .md, .txt, or .pdf and upload again.',
        });
        return;
      }

      let extractedText = (body.rawText || '').trim();
      let pdfBase64: string | null = null;
      let wordCount = 0;

      if (ext === '.docx') {
        if (!body.contentBase64) {
          res.status(400).json({ error: 'Missing .docx file contents.' });
          return;
        }
        const buffer = Buffer.from(body.contentBase64, 'base64');
        const result = await mammoth.extractRawText({ buffer });
        extractedText = (result.value || '').trim();
        if (!extractedText) {
          res.status(400).json({
            error: 'The uploaded Word (.docx) document appears to contain no readable text.',
          });
          return;
        }
        wordCount = countWords(extractedText);
      } else if (ext === '.pdf') {
        if (!body.contentBase64) {
          res.status(400).json({ error: 'Missing .pdf file contents.' });
          return;
        }
        pdfBase64 = body.contentBase64;
        wordCount = 0;
      } else {
        if (!extractedText && body.contentBase64) {
          extractedText = Buffer.from(body.contentBase64, 'base64').toString('utf-8').trim();
        }
        if (!extractedText) {
          res.status(400).json({
            error: 'The uploaded document is empty. Please upload a non-empty file or paste text.',
          });
          return;
        }
        wordCount = countWords(extractedText);
      }

      const ai = getGeminiClient();

      const systemInstruction = `You are an expert executive chief of staff and meeting facilitator.
Your task is to analyze the provided source document and craft a crisp, practical, time-boxed meeting agenda.

Rules:
1. Extract every substantive topic from the document and organize them into a logical meeting flow (usually 4 to 8 sections depending on total duration, including a brief Opening/Context and Wrap-up/Next Steps when appropriate).
2. For EACH section, provide:
   - A factual, clear summary grounded strictly in the uploaded document.
   - Concrete key talking points / questions to resolve.
   - Explicit timingRationale describing how to pace those exact minutes (e.g., "2m framing, 6m options review, 2m decision lock").
   - Stakeholders involved in that section (extract real names and roles from the document wherever present; if a topic has no named person in the document, specify the functional role needed such as "Product Lead" or "Engineering Owner").
   - Specific action items with owners, due windows, and priority (High, Medium, Low).
3. Time math MUST be exact: the sum of allocatedMinutes across all sections MUST equal ${totalMinutes} minutes. Every section must have at least 1 minute.
4. Respect the requested meeting format (${meetingFormat}) and any facilitator notes.`;

      const userPrompt = `Source file: ${fileName}
Target total meeting duration: ${totalMinutes} minutes
Requested meeting format: ${meetingFormat}
${facilitatorNotes ? `Facilitator notes: ${facilitatorNotes}\n` : ''}
${
  pdfBase64
    ? 'Analyze the attached PDF document and generate the complete structured JSON meeting agenda.'
    : `Document content:\n---\n${extractedText.slice(0, 120000)}\n---`
}`;

      const contents = pdfBase64
        ? {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdfBase64,
                },
              },
              { text: userPrompt },
            ],
          }
        : userPrompt;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: agendaResponseSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        })
      );

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as RawCraftResponse;

      const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
      if (rawSections.length === 0) {
        res.status(502).json({
          error: 'Could not extract structured agenda topics from this document. Try adding more detail or checking the file.',
        });
        return;
      }

      const mappedSections: AgendaSection[] = rawSections.map((sec, idx) => {
        const stakeholders: SectionStakeholder[] = (sec.stakeholders || []).map((st, sIdx) => ({
          id: `st-${idx}-${sIdx}-${Date.now()}`,
          name: st.name || 'TBD',
          role: st.role || 'Contributor',
          responsibility: st.responsibility || 'Contributor',
        }));

        const actionItems: ActionItem[] = (sec.actionItems || []).map((aiItem, aIdx) => {
          const normPriority =
            aiItem.priority === 'High' || aiItem.priority === 'Low' ? aiItem.priority : 'Medium';
          return {
            id: `act-${idx}-${aIdx}-${Date.now()}`,
            task: aiItem.task || '',
            owner: aiItem.owner || 'Unassigned',
            dueWindow: aiItem.dueWindow || 'Next sync',
            priority: normPriority,
            completed: false,
          };
        });

        return {
          id: `sec-${idx}-${Date.now()}`,
          order: idx + 1,
          title: sec.title || `Topic ${idx + 1}`,
          category: sec.category || 'Discussion',
          allocatedMinutes: Math.max(1, Math.round(Number(sec.allocatedMinutes) || 5)),
          locked: false,
          summary: sec.summary || '',
          keyTalkingPoints: Array.isArray(sec.keyTalkingPoints) ? sec.keyTalkingPoints : [],
          timingRationale: sec.timingRationale || '',
          stakeholders,
          actionItems,
        };
      });

      const normalizedSections = normalizeSectionDurations(mappedSections, totalMinutes);

      const agendaDoc: AgendaDocument = {
        id: `agenda-${Date.now()}`,
        createdAt: new Date().toISOString(),
        sourceFileName: fileName,
        sourceFileType: ext ? ext.replace('.', '').toUpperCase() : 'TEXT',
        sourceWordCount: wordCount,
        meetingTitle: parsed.meetingTitle || fileName.replace(/\.[^.]+$/, ''),
        executiveSummary: parsed.executiveSummary || '',
        recommendedFormat: parsed.recommendedFormat || meetingFormat,
        totalMinutes,
        startTime,
        preReadNotes: Array.isArray(parsed.preReadNotes) ? parsed.preReadNotes : [],
        sections: normalizedSections,
        unassignedStakeholders: Array.isArray(parsed.unassignedStakeholders)
          ? parsed.unassignedStakeholders
          : [],
      };

      res.json(agendaDoc);
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/agenda/retime', async (req: Request, res: Response) => {
    try {
      const body = req.body as RetimeAgendaRequest;
      const targetMinutes = Math.min(480, Math.max(5, Math.round(Number(body.targetMinutes) || 45)));
      const sections = Array.isArray(body.sections) ? body.sections : [];

      if (sections.length === 0) {
        res.status(400).json({ error: 'No agenda sections provided to retime.' });
        return;
      }

      const ai = getGeminiClient();

      const sectionDigest = sections.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        currentMinutes: s.allocatedMinutes,
        locked: Boolean(s.locked),
        summary: s.summary,
        actionItemCount: s.actionItems.length,
      }));

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Meeting: ${body.meetingTitle}
New total target meeting duration: ${targetMinutes} minutes

Current sections:
${JSON.stringify(sectionDigest, null, 2)}

Re-allocate minutes across unlocked sections based on topic complexity, decision weight, and action item density so that ALL sections sum to exactly ${targetMinutes} minutes. Keep any locked section at its currentMinutes. Update each section's timingRationale to reflect its new minute allocation (e.g., "2m recap, 5m decision, 1m next steps").`,
          config: {
            systemInstruction:
              'You are an expert meeting facilitator optimizing section timeboxes. Return exact integer minutes per section ID and concise pacing breakdowns.',
            responseMimeType: 'application/json',
            responseSchema: retimeResponseSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as {
        sections?: Array<{ id: string; allocatedMinutes: number; timingRationale: string }>;
      };

      const updates = new Map(
        (parsed.sections || []).map((item) => [item.id, item])
      );

      const updated = sections.map((sec) => {
        const u = updates.get(sec.id);
        if (!u) return sec;
        return {
          ...sec,
          allocatedMinutes: sec.locked
            ? sec.allocatedMinutes
            : Math.max(1, Math.round(Number(u.allocatedMinutes) || sec.allocatedMinutes)),
          timingRationale: u.timingRationale || sec.timingRationale,
        };
      });

      const normalized = normalizeSectionDurations(updated, targetMinutes);
      res.json({ sections: normalized, totalMinutes: targetMinutes });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cadence server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
