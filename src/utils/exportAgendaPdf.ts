import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AgendaDocument } from '../types/agenda';
import {
  calculateScheduleTimes,
  formatMinutesToClock,
  parseClockToMinutes,
} from './agendaHelpers';

interface JsPdfWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

function sanitizePdfText(input: string): string {
  return (input || '')
    .replace(/[\u2022\u25CF\u25AA]/g, '-')
    .replace(/[\u2192]/g, '->')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
    .trim();
}

export function exportAgendaToPdf(agenda: AgendaDocument): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  }) as JsPdfWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const marginTop = 46;
  const marginBottom = 48;
  const contentWidth = pageWidth - marginX * 2;

  const schedule = calculateScheduleTimes(agenda.sections, agenda.startTime);
  const totalAllocated = agenda.sections.reduce(
    (sum, s) => sum + s.allocatedMinutes,
    0
  );
  const endClock = formatMinutesToClock(
    parseClockToMinutes(agenda.startTime) + totalAllocated
  );

  let y = marginTop;

  const ensureSpace = (neededPt: number) => {
    if (y + neededPt > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  // --- 1. Header Metadata ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const metaLine = sanitizePdfText(
    `${agenda.recommendedFormat}  ·  ${totalAllocated} min (${agenda.startTime} - ${endClock})  ·  ${agenda.sections.length} topics  ·  Source: ${agenda.sourceFileName}`
  );
  const metaLines = doc.splitTextToSize(metaLine, contentWidth) as string[];
  doc.text(metaLines, marginX, y);
  y += metaLines.length * 11 + 6;

  // --- 2. Meeting Title ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(
    sanitizePdfText(agenda.meetingTitle || 'Meeting Agenda'),
    contentWidth
  ) as string[];
  doc.text(titleLines, marginX, y);
  y += titleLines.length * 22 + 4;

  // --- 3. Executive Summary ---
  if (agenda.executiveSummary.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const summaryLines = doc.splitTextToSize(
      sanitizePdfText(agenda.executiveSummary),
      contentWidth
    ) as string[];
    doc.text(summaryLines, marginX, y);
    y += summaryLines.length * 14 + 10;
  }

  // Hairline rule
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.75);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 16;

  // --- 4. Pre-Read Notes ---
  if (agenda.preReadNotes.length > 0) {
    ensureSpace(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Pre-Read & Preparation', marginX, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    for (const note of agenda.preReadNotes) {
      const wrapped = doc.splitTextToSize(
        sanitizePdfText(note),
        contentWidth - 14
      ) as string[];
      ensureSpace(wrapped.length * 13 + 4);
      doc.text('-', marginX + 2, y);
      doc.text(wrapped, marginX + 14, y);
      y += wrapped.length * 13 + 3;
    }
    y += 10;
  }

  // --- 5. Time Allocation Schedule Table ---
  ensureSpace(90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Time Allocation Schedule', marginX, y);
  y += 8;

  const scheduleRows = agenda.sections.map((sec, idx) => {
    const slot = schedule[sec.id];
    const lead =
      sec.stakeholders.find((s) =>
        s.responsibility.toLowerCase().includes('lead')
      )?.name ||
      sec.stakeholders[0]?.name ||
      'Facilitator';
    return [
      `${slot?.startClock || ''} - ${slot?.endClock || ''}`,
      `${sec.allocatedMinutes}m`,
      sanitizePdfText(`${String(idx + 1).padStart(2, '0')}. ${sec.title}`),
      sanitizePdfText(sec.category),
      sanitizePdfText(lead),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Clock', 'Dur.', 'Topic', 'Category', 'Lead']],
    body: scheduleRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      cellPadding: { top: 6, right: 7, bottom: 6, left: 7 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 78 },
      1: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 68 },
      4: { cellWidth: 96 },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 22;

  // --- 6. Detailed Topic Sections ---
  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Agenda Topics & Action Plan', marginX, y);
  y += 14;

  agenda.sections.forEach((sec, idx) => {
    const slot = schedule[sec.id];
    ensureSpace(120);

    // Section Header Strip
    const headerTitle = sanitizePdfText(
      `${String(idx + 1).padStart(2, '0')}. ${sec.title}`
    );
    const titleWrapped = doc.splitTextToSize(
      headerTitle,
      contentWidth - 135
    ) as string[];
    const boxHeight = Math.max(28, titleWrapped.length * 14 + 14);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.roundedRect(marginX, y, contentWidth, boxHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(titleWrapped, marginX + 10, y + 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(29, 78, 216);
    const timeLabel = `${slot?.startClock || ''} - ${slot?.endClock || ''}  (${sec.allocatedMinutes}m)`;
    doc.text(timeLabel, pageWidth - marginX - 10, y + 17, { align: 'right' });

    y += boxHeight + 10;

    // Category + Timing Plan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const pacingText = sanitizePdfText(
      `${sec.category}  |  Section timing plan: ${
        sec.timingRationale || `${sec.allocatedMinutes} min discussion`
      }`
    );
    const pacingLines = doc.splitTextToSize(pacingText, contentWidth) as string[];
    ensureSpace(pacingLines.length * 12 + 6);
    doc.text(pacingLines, marginX, y);
    y += pacingLines.length * 12 + 6;

    // Summary
    if (sec.summary.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      const sumLines = doc.splitTextToSize(
        sanitizePdfText(sec.summary),
        contentWidth
      ) as string[];
      ensureSpace(sumLines.length * 13 + 6);
      doc.text(sumLines, marginX, y);
      y += sumLines.length * 13 + 6;
    }

    // Key Talking Points
    if (sec.keyTalkingPoints.length > 0) {
      ensureSpace(24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text('Key Talking Points:', marginX, y);
      y += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      for (const pt of sec.keyTalkingPoints) {
        const ptLines = doc.splitTextToSize(
          sanitizePdfText(pt),
          contentWidth - 14
        ) as string[];
        ensureSpace(ptLines.length * 12 + 4);
        doc.text('-', marginX + 2, y);
        doc.text(ptLines, marginX + 12, y);
        y += ptLines.length * 12 + 2;
      }
      y += 4;
    }

    // Stakeholders
    if (sec.stakeholders.length > 0) {
      const peopleText = sec.stakeholders
        .map((st) => `${st.name} (${st.role} - ${st.responsibility})`)
        .join('  /  ');
      const stLines = doc.splitTextToSize(
        sanitizePdfText(`Stakeholders: ${peopleText}`),
        contentWidth
      ) as string[];
      ensureSpace(stLines.length * 12 + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(stLines, marginX, y);
      y += stLines.length * 12 + 6;
    }

    // Section Action Items Table
    if (sec.actionItems.length > 0) {
      ensureSpace(55);
      const actionRows = sec.actionItems.map((item) => [
        item.completed ? '[x]' : '[ ]',
        sanitizePdfText(item.task),
        sanitizePdfText(item.owner),
        sanitizePdfText(item.dueWindow),
        sanitizePdfText(item.priority),
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['Status', 'Action Item', 'Owner', 'Due Window', 'Priority']],
        body: actionRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8.25,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
          cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
          valign: 'top',
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 36, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 92 },
          3: { cellWidth: 74 },
          4: { cellWidth: 48, halign: 'right' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const val = String(data.cell.raw);
            if (val === 'High') {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Medium') {
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      y = (doc.lastAutoTable?.finalY || y) + 16;
    } else {
      y += 8;
    }
  });

  // --- 7. Additional Stakeholders ---
  if (agenda.unassignedStakeholders.length > 0) {
    ensureSpace(70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Additional Stakeholders to Inform', marginX, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Name', 'Role', 'Context']],
      body: agenda.unassignedStakeholders.map((st) => [
        sanitizePdfText(st.name),
        sanitizePdfText(st.role),
        sanitizePdfText(st.context),
      ]),
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        cellPadding: { top: 5, right: 7, bottom: 5, left: 7 },
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 115, fontStyle: 'bold' },
        1: { cellWidth: 120 },
        2: { cellWidth: 'auto' },
      },
    });
  }

  // --- 8. Page Footers ---
  const totalPages = doc.getNumberOfPages();
  const footerTitle = sanitizePdfText(agenda.meetingTitle || 'Cadence Agenda').slice(
    0,
    65
  );
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageHeight - 32, pageWidth - marginX, pageHeight - 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(footerTitle, marginX, pageHeight - 20);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 20,
      { align: 'right' }
    );
  }

  const slug = agenda.meetingTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  doc.save(`${slug || 'meeting-agenda'}.pdf`);
}
