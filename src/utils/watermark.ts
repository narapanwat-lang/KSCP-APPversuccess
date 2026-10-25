/**
 * Utility for stamping official Security Patrol Checkpoint inspection watermarks
 * directly into image canvas pixels.
 * 
 * Ensures non-repudiation and clear visual auditing for security guard patrol reports:
 * - Current Thailand Date and Time (Asia/Bangkok UTC+07:00)
 * - Location / Checkpoint Name & Address
 * - GPS Coordinates (Latitude, Longitude, Accuracy)
 * - Security Guard (รปภ.) Name and Inspection Status
 */

export interface WatermarkData {
  employeeName?: string;
  checkpointName?: string;
  locationDetails?: string;
  shift?: string;
  buildingName?: string;
  pointName?: string;
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
  serverOffsetMs?: number;
  situation?: 'normal' | 'abnormal' | 'emergency' | string | null;
  companyName?: string;
}

/**
 * Returns Thailand (Asia/Bangkok) time formatted strings
 */
export function getThailandTimeStrings(serverOffsetMs: number = 0) {
  const adjusted = new Date(Date.now() + serverOffsetMs);

  // Format in Asia/Bangkok
  const bkk = new Date(adjusted.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

  const day = String(bkk.getDate()).padStart(2, '0');
  const month = String(bkk.getMonth() + 1).padStart(2, '0');
  const year = bkk.getFullYear();
  const dateFormatted = `${day}/${month}/${year}`;

  const hours = String(bkk.getHours()).padStart(2, '0');
  const minutes = String(bkk.getMinutes()).padStart(2, '0');
  const seconds = String(bkk.getSeconds()).padStart(2, '0');
  const timeFormatted = `${hours}:${minutes}:${seconds}`;

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const thaiMonthsFull = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const thaiDateShort = `${bkk.getDate()} ${thaiMonths[bkk.getMonth()]} ${year + 543}`;
  const thaiDateFull = `${bkk.getDate()} ${thaiMonthsFull[bkk.getMonth()]} พ.ศ. ${year + 543}`;

  return {
    dateFormatted,
    timeFormatted,
    thaiDateShort,
    thaiDateFull,
    timestampString: `${dateFormatted} ${timeFormatted} น. (เวลาประเทศไทย UTC+07:00)`,
    fullThaiBadge: `${thaiDateShort} เวลา ${timeFormatted} น. (Asia/Bangkok)`,
  };
}

/**
 * Stamps security audit watermark directly onto a canvas element
 */
export function stampSecurityWatermark(
  canvas: HTMLCanvasElement,
  data: WatermarkData
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Compute responsive scale factor based on image dimensions
  // Standard reference width = 900px
  const scale = Math.max(0.7, Math.min(width / 900, 2.0));

  const timeInfo = getThailandTimeStrings(data.serverOffsetMs || 0);

  // Shift badge prefix
  let shiftPrefix = '';
  if (data.shift === 'day' || data.shift === 'ผลัดกลางวัน') {
    shiftPrefix = '[ผลัดกลางวัน] ';
  } else if (data.shift === 'night' || data.shift === 'ผลัดกลางคืน') {
    shiftPrefix = '[ผลัดกลางคืน] ';
  }

  // Location string
  const locationText = data.checkpointName
    ? `${shiftPrefix}${data.checkpointName}`
    : `${shiftPrefix}จุดตรวจรักษาความปลอดภัย`;

  // GPS Coordinates string
  let gpsText = 'พิกัด GPS: ไม่ได้ระบุตำแหน่ง';
  let gpsAccuracyText = '';
  if (data.gps && typeof data.gps.lat === 'number' && typeof data.gps.lng === 'number') {
    const latStr = data.gps.lat.toFixed(6);
    const lngStr = data.gps.lng.toFixed(6);
    gpsText = `พิกัด GPS: ${latStr}, ${lngStr}`;
    if (data.gps.accuracy) {
      gpsAccuracyText = ` (ความแม่นยำ ±${Math.round(data.gps.accuracy)} ม.)`;
    }
  }

  // Guard Name string
  const guardName = data.employeeName?.trim() || 'เจ้าหน้าที่ประจำจุด';

  // Situation status label & color
  let situationLabel = 'สถานการณ์: ปกติ (NORMAL)';
  let situationColor = '#34D399'; // Emerald
  if (data.situation === 'abnormal') {
    situationLabel = 'สถานการณ์: ไม่ปกติ (ABNORMAL)';
    situationColor = '#FBBF24'; // Amber
  } else if (data.situation === 'emergency') {
    situationLabel = 'สถานการณ์: ฉุกเฉิน (EMERGENCY)';
    situationColor = '#EF4444'; // Red
  }

  // Calculate layout sizes
  const paddingX = Math.round(20 * scale);
  const paddingY = Math.round(16 * scale);
  const bannerMargin = Math.round(14 * scale);
  const lineHeight = Math.round(22 * scale);
  const rowCount = 5; // header, time, location, gps, guard/status
  const bannerContentHeight = Math.round(rowCount * lineHeight + 34 * scale);
  const bannerWidth = width - bannerMargin * 2;
  const bannerY = height - bannerContentHeight - bannerMargin;
  const bannerX = bannerMargin;
  const borderRadius = Math.round(12 * scale);

  ctx.save();

  // 1. Draw banner background (translucent dark slate with gradient for maximum readability)
  const bgGradient = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerContentHeight);
  bgGradient.addColorStop(0, 'rgba(10, 15, 29, 0.92)');
  bgGradient.addColorStop(1, 'rgba(3, 7, 18, 0.96)');

  // Rounded rectangle path
  ctx.beginPath();
  ctx.moveTo(bannerX + borderRadius, bannerY);
  ctx.lineTo(bannerX + bannerWidth - borderRadius, bannerY);
  ctx.quadraticCurveTo(bannerX + bannerWidth, bannerY, bannerX + bannerWidth, bannerY + borderRadius);
  ctx.lineTo(bannerX + bannerWidth, bannerY + bannerContentHeight - borderRadius);
  ctx.quadraticCurveTo(bannerX + bannerWidth, bannerY + bannerContentHeight, bannerX + bannerWidth - borderRadius, bannerY + bannerContentHeight);
  ctx.lineTo(bannerX + borderRadius, bannerY + bannerContentHeight);
  ctx.quadraticCurveTo(bannerX, bannerY + bannerContentHeight, bannerX, bannerY + bannerContentHeight - borderRadius);
  ctx.lineTo(bannerX, bannerY + borderRadius);
  ctx.quadraticCurveTo(bannerX, bannerY, bannerX + borderRadius, bannerY);
  ctx.closePath();

  // Subtle outer glow/shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 12 * scale;
  ctx.fillStyle = bgGradient;
  ctx.fill();

  // Border outline
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.stroke();

  // Reset shadow for inner elements
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Left decorative accent bar (Amber/Gold security color)
  const accentBarWidth = Math.round(6 * scale);
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(bannerX + borderRadius, bannerY);
  ctx.lineTo(bannerX + borderRadius + accentBarWidth, bannerY);
  ctx.lineTo(bannerX + borderRadius + accentBarWidth, bannerY + bannerContentHeight);
  ctx.lineTo(bannerX + borderRadius, bannerY + bannerContentHeight);
  ctx.quadraticCurveTo(bannerX, bannerY + bannerContentHeight, bannerX, bannerY + bannerContentHeight - borderRadius);
  ctx.lineTo(bannerX, bannerY + borderRadius);
  ctx.quadraticCurveTo(bannerX, bannerY, bannerX + borderRadius, bannerY);
  ctx.closePath();
  ctx.fill();

  // Content start coordinates
  const contentLeft = bannerX + paddingX + accentBarWidth + Math.round(8 * scale);
  const maxContentWidth = bannerWidth - (paddingX * 2 + accentBarWidth + Math.round(16 * scale));
  let currentY = bannerY + paddingY + Math.round(12 * scale);

  // Set font base
  const fontSans = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Thai", "Sarabun", Tahoma, sans-serif';
  const fontMono = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

  // Helper to draw text with shadow
  const drawTextWithShadow = (
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = 'left'
  ) => {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4 * scale;
    ctx.shadowOffsetX = 1 * scale;
    ctx.shadowOffsetY = 1 * scale;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // Helper to truncate text to fit width
  const fitText = (text: string, font: string, maxWidth: number): string => {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 3 && ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  // ROW 1: HEADER & BADGE
  const headerFont = `bold ${Math.round(13 * scale)}px ${fontSans}`;
  const headerText = '🛡️ บันทึกภาพตรวจจุด รปภ. — KSCP SECURITY PATROL';
  drawTextWithShadow(headerText, contentLeft, currentY, headerFont, '#FBBF24');

  // Right top pill badge: TIMEZONE
  const timezoneBadge = 'เวลาประเทศไทย (Asia/Bangkok)';
  const badgeFont = `600 ${Math.round(10.5 * scale)}px ${fontSans}`;
  drawTextWithShadow(
    timezoneBadge,
    bannerX + bannerWidth - paddingX,
    currentY,
    badgeFont,
    '#93C5FD',
    'right'
  );

  currentY += Math.round(20 * scale);

  // Separator line
  ctx.beginPath();
  ctx.moveTo(contentLeft, currentY - Math.round(9 * scale));
  ctx.lineTo(bannerX + bannerWidth - paddingX, currentY - Math.round(9 * scale));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = Math.max(1, 1 * scale);
  ctx.stroke();

  // ROW 2: THAILAND DATE & TIME (Most Important)
  const timeLabelFont = `bold ${Math.round(13 * scale)}px ${fontSans}`;
  const timeValueFont = `bold ${Math.round(15 * scale)}px ${fontMono}`;
  
  drawTextWithShadow('🕒 วัน-เวลา (ไทย):', contentLeft, currentY, timeLabelFont, '#E2E8F0');
  
  const timeLabelWidth = ctx.measureText('🕒 วัน-เวลา (ไทย): ').width;
  const timeDisplay = `${timeInfo.dateFormatted}  ${timeInfo.timeFormatted} น.`;
  drawTextWithShadow(timeDisplay, contentLeft + timeLabelWidth, currentY, timeValueFont, '#FFFFFF');

  // Additional Thai Date note on the right
  const thaiDateNote = `(${timeInfo.thaiDateShort})`;
  const thaiDateNoteFont = `500 ${Math.round(11 * scale)}px ${fontSans}`;
  drawTextWithShadow(
    thaiDateNote,
    bannerX + bannerWidth - paddingX,
    currentY,
    thaiDateNoteFont,
    '#CBD5E1',
    'right'
  );

  currentY += lineHeight;

  // ROW 3: LOCATION / CHECKPOINT
  const locLabelFont = `bold ${Math.round(13 * scale)}px ${fontSans}`;
  const locValueFont = `600 ${Math.round(13.5 * scale)}px ${fontSans}`;
  
  drawTextWithShadow('📍 สถานที่/จุดตรวจ:', contentLeft, currentY, locLabelFont, '#E2E8F0');
  
  const locLabelWidth = ctx.measureText('📍 สถานที่/จุดตรวจ: ').width;
  const fittedLocation = fitText(
    locationText + (data.locationDetails ? ` (${data.locationDetails})` : ''),
    locValueFont,
    maxContentWidth - locLabelWidth
  );
  drawTextWithShadow(fittedLocation, contentLeft + locLabelWidth, currentY, locValueFont, '#6EE7B7');

  currentY += lineHeight;

  // ROW 4: GPS COORDINATES
  const gpsLabelFont = `bold ${Math.round(13 * scale)}px ${fontSans}`;
  const gpsValueFont = `600 ${Math.round(12.5 * scale)}px ${fontMono}`;

  drawTextWithShadow('🌐 พิกัดที่ถ่าย:', contentLeft, currentY, gpsLabelFont, '#E2E8F0');
  
  const gpsLabelWidth = ctx.measureText('🌐 พิกัดที่ถ่าย: ').width;
  const fullGpsString = gpsText + gpsAccuracyText;
  const fittedGps = fitText(fullGpsString, gpsValueFont, maxContentWidth - gpsLabelWidth);
  const gpsColor = data.gps ? '#38BDF8' : '#FCD34D';
  drawTextWithShadow(fittedGps, contentLeft + gpsLabelWidth, currentY, gpsValueFont, gpsColor);

  currentY += lineHeight;

  // ROW 5: GUARD NAME & SITUATION
  const guardLabelFont = `bold ${Math.round(12 * scale)}px ${fontSans}`;
  const guardValueFont = `600 ${Math.round(12.5 * scale)}px ${fontSans}`;

  drawTextWithShadow('👤 จนท. รปภ.:', contentLeft, currentY, guardLabelFont, '#E2E8F0');
  
  const guardLabelWidth = ctx.measureText('👤 จนท. รปภ.: ').width;
  const fittedGuard = fitText(guardName, guardValueFont, (maxContentWidth - guardLabelWidth) * 0.55);
  drawTextWithShadow(fittedGuard, contentLeft + guardLabelWidth, currentY, guardValueFont, '#FFFFFF');

  // Situation badge on the right
  const sitFont = `bold ${Math.round(11 * scale)}px ${fontSans}`;
  drawTextWithShadow(
    situationLabel,
    bannerX + bannerWidth - paddingX,
    currentY,
    sitFont,
    situationColor,
    'right'
  );

  // TOP-RIGHT CORNER SUBTLE WATERMARK SEAL
  // Stamped watermark stamp seal in upper right corner of the photo for anti-tamper authenticity
  const sealX = width - Math.round(20 * scale);
  const sealY = Math.round(24 * scale);
  const sealFont = `700 ${Math.round(10 * scale)}px ${fontSans}`;
  drawTextWithShadow(
    'KSCP VERIFIED INSPECTION PHOTO',
    sealX,
    sealY,
    sealFont,
    'rgba(255, 255, 255, 0.75)',
    'right'
  );
  drawTextWithShadow(
    `${timeInfo.dateFormatted} • ${timeInfo.timeFormatted}`,
    sealX,
    sealY + Math.round(14 * scale),
    `600 ${Math.round(9 * scale)}px ${fontMono}`,
    'rgba(251, 191, 36, 0.85)',
    'right'
  );

  ctx.restore();
}
