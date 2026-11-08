import type { Course, Day, Section } from "@/lib/schema";
import { formatTime } from "@/lib/schedule";
import { getLocalizedCourseTitle } from "@/lib/i18n/course-titles";

export interface TimetableExportOptions {
  planName: string;
  termLabel: string;
  collegeLabel: string;
  categoryLabel?: string;
  selectedSections: Section[];
  courseMap: Map<string, Course>;
  isDarkTheme?: boolean;
  lang?: "ar" | "en";
}

interface DayMeta {
  id: Day;
  labelEn: string;
  shortEn: string;
  labelAr: string;
  shortAr: string;
}

const DAYS_META: DayMeta[] = [
  { id: "sun", labelEn: "Sunday", shortEn: "Sun", labelAr: "الأحد", shortAr: "أحد" },
  { id: "mon", labelEn: "Monday", shortEn: "Mon", labelAr: "الاثنين", shortAr: "اثنين" },
  { id: "tue", labelEn: "Tuesday", shortEn: "Tue", labelAr: "الثلاثاء", shortAr: "ثلاثاء" },
  { id: "wed", labelEn: "Wednesday", shortEn: "Wed", labelAr: "الأربعاء", shortAr: "أربعاء" },
  { id: "thu", labelEn: "Thursday", shortEn: "Thu", labelAr: "الخميس", shortAr: "خميس" },
];

const PALETTE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  lime: { bg: "#f0f8c8", border: "#b8d424", text: "#1d2b0e", dot: "#8ea312" },
  mint: { bg: "#d2f3e1", border: "#88cfab", text: "#112e1f", dot: "#2e9a68" },
  sky: { bg: "#d9f0f9", border: "#83c7de", text: "#0f2b38", dot: "#298eb4" },
  sand: { bg: "#f7ebd0", border: "#d7b972", text: "#39270a", dot: "#b08730" },
  violet: { bg: "#e9e1fa", border: "#b39ee2", text: "#271744", dot: "#7954b9" },
  coral: { bg: "#fcdad2", border: "#e89988", text: "#3d150e", dot: "#c84e36" },
  amber: { bg: "#feeed0", border: "#eec068", text: "#3d2a08", dot: "#cf8b19" },
  teal: { bg: "#d0f1ee", border: "#74cdc5", text: "#0c302d", dot: "#249b90" },
};

export function generateSafeFilename(planName: string, termId = "144820", ext: "pdf" | "png"): string {
  const cleanName = planName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 35) || "schedule";
  return `lemon-${cleanName}-${termId}.${ext}`;
}

/**
 * Renders high-resolution (2400x1600) printable timetable graphic to an offscreen Canvas.
 * Incorporates full course code, localized course title, instructor, meeting time, section,
 * CRN, adaptive readable time-axis, and a structured course legend table below the timetable.
 */
export function renderTimetableToCanvas(options: TimetableExportOptions): HTMLCanvasElement {
  const width = 2200;
  const height = 1400;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const isAr = options.lang === "ar";
  const isDark = Boolean(options.isDarkTheme);

  // Theme colors
  const bgColor = isDark ? "#121914" : "#ffffff";
  const headerBg = isDark ? "#18231c" : "#f7faf5";
  const textColor = isDark ? "#ecf3ed" : "#142016";
  const mutedColor = isDark ? "#95a598" : "#5d6d60";
  const cardBorderColor = isDark ? "rgba(255, 255, 255, 0.12)" : "#d7dfd5";
  const gridLineColor = isDark ? "rgba(255, 255, 255, 0.07)" : "#e7ece4";

  // 1. Background Fill
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // 2. Header Banner
  ctx.fillStyle = headerBg;
  ctx.fillRect(0, 0, width, 160);
  ctx.strokeStyle = cardBorderColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 160);
  ctx.lineTo(width, 160);
  ctx.stroke();

  // Branding
  ctx.fillStyle = "#8da700";
  ctx.font = "bold 32px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("LE", 60, 60);
  ctx.fillStyle = "#cfed30";
  ctx.fillText("MON", 104, 60);

  ctx.fillStyle = mutedColor;
  ctx.font = "500 20px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(isAr ? "خويّك الجامعي · جدول معتمد" : "Your Campus Pal · Verified Schedule", 200, 60);

  // Plan Title
  ctx.fillStyle = textColor;
  ctx.font = "bold 40px 'Segoe UI', system-ui, sans-serif";
  const displayPlanName = options.planName || (isAr ? "جدولي الدراسي" : "My Schedule Plan");
  ctx.fillText(displayPlanName, 60, 120);

  // Term & College Metadata (Right aligned)
  ctx.textAlign = "right";
  ctx.fillStyle = textColor;
  ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(options.termLabel, width - 60, 60);

  ctx.fillStyle = mutedColor;
  ctx.font = "500 18px 'Segoe UI', system-ui, sans-serif";
  const metaLine = `${options.collegeLabel}${options.categoryLabel ? ` · ${options.categoryLabel}` : ""} · ${options.selectedSections.length} ${isAr ? "شعب مختارة" : "sections"}`;
  ctx.fillText(metaLine, width - 60, 95);
  ctx.fillText(
    `${isAr ? "تاريخ التصدير: " : "Exported on: "}${new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US", { dateStyle: "long" })}`,
    width - 60,
    124,
  );
  ctx.textAlign = "left";

  // 3. Compute dynamic readable time-axis from actual meeting times
  const allMeetings = options.selectedSections.flatMap((s) => s.meetings);
  let startHour = 8;
  let endHour = 17;

  if (allMeetings.length > 0) {
    const minStart = Math.min(...allMeetings.map((m) => m.startMinutes));
    const maxEnd = Math.max(...allMeetings.map((m) => m.endMinutes));
    startHour = Math.max(6, Math.min(8, Math.floor(minStart / 60)));
    endHour = Math.min(22, Math.max(16, Math.ceil(maxEnd / 60)));
  }

  const totalHours = endHour - startHour;

  // Timetable Coordinates
  const gridLeft = 130;
  const gridTop = 215;
  const gridWidth = width - gridLeft - 50;
  const gridHeight = 770;
  const colWidth = gridWidth / DAYS_META.length;
  const hourHeight = gridHeight / totalHours;

  // Day Column Headers
  DAYS_META.forEach((day, index) => {
    const x = gridLeft + index * colWidth;

    ctx.fillStyle = isDark ? "#1b271f" : "#f0f5ec";
    ctx.fillRect(x, gridTop - 42, colWidth - 8, 38);
    ctx.strokeStyle = cardBorderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, gridTop - 42, colWidth - 8, 38);

    ctx.fillStyle = textColor;
    ctx.font = "bold 19px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    const headerTitle = isAr ? `${day.labelAr} (${day.shortAr})` : `${day.labelEn} (${day.shortEn})`;
    ctx.fillText(headerTitle, x + (colWidth - 8) / 2, gridTop - 16);
  });
  ctx.textAlign = "left";

  // Horizontal Hour Guidelines & Labels
  for (let h = startHour; h <= endHour; h += 1) {
    const y = gridTop + (h - startHour) * hourHeight;

    ctx.fillStyle = mutedColor;
    ctx.font = "600 16px 'Segoe UI', monospace";
    ctx.fillText(`${String(h).padStart(2, "0")}:00`, 50, y + 6);

    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gridLeft, y);
    ctx.lineTo(gridLeft + gridWidth, y);
    ctx.stroke();
  }

  // Vertical Column Dividers
  for (let d = 0; d <= DAYS_META.length; d += 1) {
    const x = gridLeft + d * colWidth;
    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, gridTop);
    ctx.lineTo(x, gridTop + gridHeight);
    ctx.stroke();
  }

  // 4. Render Section Meeting Blocks
  const colorKeys = Object.keys(PALETTE_COLORS);

  options.selectedSections.forEach((section, sIdx) => {
    const colorKey = colorKeys[sIdx % colorKeys.length];
    const color = PALETTE_COLORS[colorKey];
    const course = options.courseMap.get(section.courseId);
    const localized = course ? getLocalizedCourseTitle(course, isAr ? "ar" : "en") : null;
    const courseTitle = localized?.title || course?.titleAr || section.sectionCode;
    const courseCode = course?.code || section.sectionCode;
    const instructorName = section.instructor?.name || (isAr ? "المحاضر: غير محدد" : "Unassigned");

    section.meetings.forEach((meeting) => {
      meeting.days.forEach((dayId) => {
        const dayIndex = DAYS_META.findIndex((d) => d.id === dayId);
        if (dayIndex === -1) return;

        const x = gridLeft + dayIndex * colWidth + 4;
        const w = colWidth - 16;
        const topY = gridTop + ((meeting.startMinutes - startHour * 60) / 60) * hourHeight;
        const blockHeight = Math.max(50, ((meeting.endMinutes - meeting.startMinutes) / 60) * hourHeight);

        // Block card fill & border
        ctx.fillStyle = color.bg;
        ctx.beginPath();
        ctx.roundRect(x, topY, w, blockHeight, 6);
        ctx.fill();

        ctx.strokeStyle = color.border;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Left accent stripe
        ctx.fillStyle = color.dot;
        ctx.beginPath();
        ctx.roundRect(x, topY, 6, blockHeight, 3);
        ctx.fill();

        // Text content
        ctx.fillStyle = color.text;

        // Line 1: Course Code & Section
        ctx.font = "bold 16px 'Segoe UI', system-ui, sans-serif";
        const headerText = `${courseCode} (${isAr ? `شعبة ${section.sectionCode}` : `Sec ${section.sectionCode}`})`;
        ctx.fillText(headerText, x + 14, topY + 20);

        // Line 2: Localized Course Name
        ctx.font = "600 14px 'Segoe UI', system-ui, sans-serif";
        const maxTitleWidth = w - 24;
        const shortTitle = courseTitle.length > 25 ? `${courseTitle.slice(0, 24)}…` : courseTitle;
        ctx.fillText(shortTitle, x + 14, topY + 38, maxTitleWidth);

        // Line 3: Time range & CRN (if block height allows)
        if (blockHeight >= 70) {
          ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
          const timeText = `${formatTime(meeting.startMinutes)} – ${formatTime(meeting.endMinutes)}`;
          ctx.fillText(timeText, x + 14, topY + 56);
        }

        // Line 4: Instructor name (if block height is generous)
        if (blockHeight >= 95) {
          ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
          const shortInstructor = instructorName.length > 22 ? `${instructorName.slice(0, 21)}…` : instructorName;
          ctx.fillText(shortInstructor, x + 14, topY + 76);
        }
      });
    });
  });

  // Empty Timetable Message if zero sections
  if (options.selectedSections.length === 0) {
    ctx.fillStyle = mutedColor;
    ctx.font = "bold 28px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      isAr ? "الجدول فارغ! 📅 لم يتم اختيار أي شعب دراسية بعد." : "Your week is wide open! 📅 (No sections selected in this plan)",
      width / 2,
      gridTop + gridHeight / 2,
    );
    ctx.textAlign = "left";
  }

  // 5. Structured Course Legend / Details Table below Timetable
  const legendTop = gridTop + gridHeight + 25;
  ctx.fillStyle = isDark ? "#17221b" : "#f5f8f2";
  ctx.fillRect(gridLeft, legendTop, gridWidth, 200);
  ctx.strokeStyle = cardBorderColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(gridLeft, legendTop, gridWidth, 200);

  // Legend Header
  ctx.fillStyle = textColor;
  ctx.font = "bold 17px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(isAr ? "تفاصيل المقررات والشعب المختارة:" : "Selected Courses & Sections Details:", gridLeft + 20, legendTop + 26);

  // Legend Table Columns
  const rowHeight = 28;
  const maxLegendRows = 5;
  options.selectedSections.slice(0, maxLegendRows).forEach((section, idx) => {
    const y = legendTop + 56 + idx * rowHeight;
    const colorKey = colorKeys[idx % colorKeys.length];
    const color = PALETTE_COLORS[colorKey];
    const course = options.courseMap.get(section.courseId);
    const localized = course ? getLocalizedCourseTitle(course, isAr ? "ar" : "en") : null;
    const courseTitle = localized?.title || course?.titleAr || section.sectionCode;
    const instructorName = section.instructor?.name || (isAr ? "غير محدد" : "Unassigned");

    // Color Swatch
    ctx.fillStyle = color.dot;
    ctx.beginPath();
    ctx.arc(gridLeft + 26, y - 5, 6, 0, Math.PI * 2);
    ctx.fill();

    // Course Code & Name
    ctx.fillStyle = textColor;
    ctx.font = "bold 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`${course?.code || section.sectionCode} - ${courseTitle}`, gridLeft + 42, y, 650);

    // Section & CRN
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = mutedColor;
    const secCrnText = isAr ? `شعبة ${section.sectionCode} · رمز ${section.crn}` : `Sec ${section.sectionCode} · CRN ${section.crn}`;
    ctx.fillText(secCrnText, gridLeft + 720, y);

    // Credits
    const creditsText = isAr ? `${course?.credits || 3} ساعات` : `${course?.credits || 3} credits`;
    ctx.fillText(creditsText, gridLeft + 1000, y);

    // Instructor
    const instText = `${isAr ? "المحاضر: " : "Instructor: "}${instructorName}`;
    ctx.fillText(instText, gridLeft + 1200, y, 360);

    // Meeting Days & Time
    const meetingsSummary = section.meetings
      .map((m) => `${m.days.map((d) => d.toUpperCase()).join("/")} ${formatTime(m.startMinutes)}–${formatTime(m.endMinutes)}`)
      .join(", ");
    ctx.fillText(meetingsSummary, gridLeft + 1600, y, gridWidth - 1620);
  });

  if (options.selectedSections.length > maxLegendRows) {
    ctx.fillStyle = mutedColor;
    ctx.font = "italic 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(
      isAr
        ? `+ ${options.selectedSections.length - maxLegendRows} مقررات إضافية في الخطة.`
        : `+ ${options.selectedSections.length - maxLegendRows} more courses in schedule plan.`,
      gridLeft + 20,
      legendTop + 188,
    );
  }

  // 6. Footer Branding & Timestamp
  ctx.fillStyle = mutedColor;
  ctx.font = "15px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Generated with LEMON · Your Campus Pal · https://yourpallemon.app", 60, height - 35);

  ctx.textAlign = "right";
  ctx.fillText(
    isAr ? "تم الإنشاء بواسطة ليمون — خويّك الجامعي" : "Plan your semester. Your way. 🍋",
    width - 60,
    height - 35,
  );
  ctx.textAlign = "left";

  return canvas;
}

/**
 * Minimal, standard PDF 1.4 compiler that encapsulates high-res canvas image data.
 * Produces valid PDF documents readable by Adobe, Chrome, Edge, Safari, iOS, and Android.
 */
export async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  // Convert canvas to JPEG blob
  const jpegBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95),
  );
  if (!jpegBlob) throw new Error("Could not encode canvas to JPEG");

  const jpegBuffer = new Uint8Array(await jpegBlob.arrayBuffer());
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4 Landscape standard dimensions in points (842 x 595.28)
  const pageWidth = 842;
  const pageHeight = 595;

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;

  const imgHeader = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`;
  const imgFooter = "\nendstream\nendobj\n";

  const contentStream = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im1 Do Q\n`;
  const obj5 = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`;

  const encoder = new TextEncoder();
  const partHeader = encoder.encode(header);
  const partObj1 = encoder.encode(obj1);
  const partObj2 = encoder.encode(obj2);
  const partObj3 = encoder.encode(obj3);
  const partImgHeader = encoder.encode(imgHeader);
  const partImgFooter = encoder.encode(imgFooter);
  const partObj5 = encoder.encode(obj5);

  let offset = partHeader.length;
  const offset1 = offset;
  offset += partObj1.length;
  const offset2 = offset;
  offset += partObj2.length;
  const offset3 = offset;
  offset += partObj3.length;
  const offset4 = offset;
  offset += partImgHeader.length + jpegBuffer.length + partImgFooter.length;
  const offset5 = offset;
  offset += partObj5.length;

  const xref = `xref\n0 6\n0000000000 65535 f \n${String(offset1).padStart(10, "0")} 00000 n \n${String(offset2).padStart(10, "0")} 00000 n \n${String(offset3).padStart(10, "0")} 00000 n \n${String(offset4).padStart(10, "0")} 00000 n \n${String(offset5).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  const partXref = encoder.encode(xref);
  const partTrailer = encoder.encode(trailer);

  const totalLength =
    partHeader.length +
    partObj1.length +
    partObj2.length +
    partObj3.length +
    partImgHeader.length +
    jpegBuffer.length +
    partImgFooter.length +
    partObj5.length +
    partXref.length +
    partTrailer.length;

  const fullPdf = new Uint8Array(totalLength);
  let cur = 0;
  const append = (buf: Uint8Array) => {
    fullPdf.set(buf, cur);
    cur += buf.length;
  };

  append(partHeader);
  append(partObj1);
  append(partObj2);
  append(partObj3);
  append(partImgHeader);
  append(jpegBuffer);
  append(partImgFooter);
  append(partObj5);
  append(partXref);
  append(partTrailer);

  return new Blob([fullPdf], { type: "application/pdf" });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportSchedulePng(options: TimetableExportOptions, termId = "144820"): Promise<void> {
  const canvas = renderTimetableToCanvas(options);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!blob) throw new Error("Could not create PNG export");
  const filename = generateSafeFilename(options.planName, termId, "png");
  triggerDownload(blob, filename);
}

export async function exportSchedulePdf(options: TimetableExportOptions, termId = "144820"): Promise<void> {
  const canvas = renderTimetableToCanvas(options);
  const pdfBlob = await canvasToPdfBlob(canvas);
  const filename = generateSafeFilename(options.planName, termId, "pdf");
  triggerDownload(pdfBlob, filename);
}
