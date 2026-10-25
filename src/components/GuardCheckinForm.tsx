import React, { useState, useEffect } from 'react';
import {
  Camera,
  MapPin,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  RotateCcw,
  ShieldCheck,
  Send,
  User,
  Info,
  Check,
  Navigation,
  Sun,
  Moon,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { Checkpoint, SituationType, Report } from '../types.ts';
import { CameraModal } from './CameraModal.tsx';
import { fetchJson } from '../services/apiClient.ts';
import {
  OFFICIAL_GUARDS,
  BUILDINGS_LIST,
  SHIFT_CHECKPOINTS_CONFIG,
  ALL_CHECKPOINTS,
} from '../data/checkpointsData.ts';

interface GuardCheckinFormProps {
  onSuccess: (report: Report) => void;
  onRefreshReports: () => void;
  serverOffsetMs?: number;
}

export const GuardCheckinForm: React.FC<GuardCheckinFormProps> = ({
  onSuccess,
  onRefreshReports,
  serverOffsetMs = 0,
}) => {
  // Guard Selection State (10 official guards)
  const [employeeInput, setEmployeeInput] = useState<string>(() => {
    return localStorage.getItem('kscp_last_employee') || OFFICIAL_GUARDS[0].name;
  });

  // Checkpoint & Shift State
  // Determine default shift based on current Bangkok hour (06:00 - 18:00 is Day, else Night)
  const [selectedShift, setSelectedShift] = useState<'day' | 'night'>(() => {
    try {
      const now = new Date(Date.now() + serverOffsetMs);
      const bkkHour = parseInt(
        now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', hour12: false })
      );
      return bkkHour >= 6 && bkkHour < 18 ? 'day' : 'night';
    } catch {
      return 'day';
    }
  });

  const [selectedBuilding, setSelectedBuilding] = useState<string>(BUILDINGS_LIST[0].name);
  const [selectedPoint, setSelectedPoint] = useState<string>(() => {
    return SHIFT_CHECKPOINTS_CONFIG.day[0].points[0];
  });

  // Situation State
  const [situation, setSituation] = useState<SituationType | null>('normal');
  const [incidentDescription, setIncidentDescription] = useState('');

  // Photo State
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // GPS State
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(ALL_CHECKPOINTS);
  const [gpsRequired, setGpsRequired] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReport, setSuccessReport] = useState<Report | null>(null);

  // Fetch checkpoints from backend (merges with our master data)
  useEffect(() => {
    fetchCheckpoints();
  }, []);

  const fetchCheckpoints = async () => {
    try {
      const data = await fetchJson<{ checkpoints: Checkpoint[]; gpsRequired: boolean }>('/api/checkpoints');
      if (data.checkpoints && data.checkpoints.length > 0) {
        setCheckpoints(data.checkpoints);
      }
      setGpsRequired(Boolean(data.gpsRequired));
    } catch (e) {
      console.warn('Using local fallback checkpoints', e);
    }
  };

  // When shift or building changes, ensure valid point is selected
  useEffect(() => {
    const currentShiftPoints = SHIFT_CHECKPOINTS_CONFIG[selectedShift];
    const bldConfig = currentShiftPoints.find((b) => b.building === selectedBuilding);
    if (bldConfig && !bldConfig.points.includes(selectedPoint)) {
      setSelectedPoint(bldConfig.points[0] || '');
    }
  }, [selectedShift, selectedBuilding]);

  // Find matching Checkpoint ID if available
  const currentCheckpointName = `${selectedBuilding} — ${selectedPoint}`;
  const matchedCheckpoint = checkpoints.find(
    (c) =>
      c.building === selectedBuilding &&
      c.point === selectedPoint &&
      (c.shift === selectedShift || !c.shift)
  ) || checkpoints.find((c) => c.name.includes(selectedBuilding) && c.name.includes(selectedPoint));

  const requestGpsLocation = () => {
    setIsGettingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('อุปกรณ์นี้ไม่รองรับการระบุพิกัด GPS');
      setIsGettingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setIsGettingGps(false);
      },
      (err) => {
        let msg = 'ไม่สามารถดึงตำแหน่งพิกัด GPS ได้';
        if (err.code === 1) {
          msg = 'ระบบไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง GPS (โปรดเปิดการระบุตำแหน่งในเบราว์เซอร์)';
        } else if (err.code === 2) {
          msg = 'สัญญาณ GPS ไม่พร้อมใช้งานในขณะนี้';
        } else if (err.code === 3) {
          msg = 'หมดเวลารอดึงพิกัด GPS';
        }
        setGpsError(msg);
        setIsGettingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation: Guard
    const cleanName = employeeInput.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      setErrorMessage('กรุณาเลือกชื่อพนักงาน รปภ.');
      return;
    }

    // 2. Validation: Checkpoint
    if (!selectedBuilding || !selectedPoint) {
      setErrorMessage('กรุณาเลือกอาคารและจุดตรวจที่ปฏิบัติหน้าที่');
      return;
    }

    // 3. Validation: Photo
    if (!photoBase64) {
      setErrorMessage('กรุณากดถ่ายรูปรายงานตัวตรวจจุดก่อนบันทึก');
      return;
    }

    // 4. Validation: Situation
    if (!situation) {
      setErrorMessage('กรุณาเลือกสถานการณ์ (ปกติ / ไม่ปกติ / ฉุกเฉิน)');
      return;
    }

    // 5. Validation: Incident description if abnormal or emergency
    if (situation !== 'normal' && !incidentDescription.trim()) {
      const label = situation === 'emergency' ? 'รายละเอียดเหตุฉุกเฉิน' : 'รายละเอียดเหตุการณ์';
      setErrorMessage(`กรุณาระบุ${label}ก่อนบันทึก`);
      return;
    }

    // 6. Validation: GPS if strictly required
    if (gpsRequired && !gpsLocation) {
      setErrorMessage('ระบบเปิดใช้งานการตรวจสอบสถานที่จริง โปรดกดระบุตำแหน่ง GPS ก่อนบันทึก');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        employee_name: cleanName,
        situation,
        incident_description: situation !== 'normal' ? incidentDescription.trim() : '',
        photo_base64: photoBase64,
        latitude: gpsLocation?.lat ?? null,
        longitude: gpsLocation?.lng ?? null,
        gps_accuracy_m: gpsLocation?.accuracy ?? null,
        checkpoint_id: matchedCheckpoint?.id || null,
        checkpoint_name: currentCheckpointName,
        shift: selectedShift,
        building_name: selectedBuilding,
        point_name: selectedPoint,
      };

      const data = await fetchJson<{ success: boolean; report: Report }>('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Save guard name for convenient reuse
      localStorage.setItem('kscp_last_employee', cleanName);

      // Successfully saved
      setSuccessReport(data.report);
      onSuccess(data.report);
      onRefreshReports();

      // Reset photo & situation description
      setPhotoBase64(null);
      setSituation('normal');
      setIncidentDescription('');
    } catch (err: any) {
      setErrorMessage(err.message || 'ไม่สามารถบันทึกรายงานได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get points list for currently selected building & shift
  const currentBuildingPoints =
    SHIFT_CHECKPOINTS_CONFIG[selectedShift].find((b) => b.building === selectedBuilding)?.points ||
    [];

  return (
    <div className="space-y-4">
      {/* Success Confirmation Banner */}
      {successReport && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base sm:text-lg font-bold text-emerald-950">
                  บันทึกเวลาตรวจจุดสำเร็จ!
                </h3>
                <span className="text-xs font-mono text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  {successReport.id}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-800 mt-1">
                บันทึกเข้าตารางรายงานตัวเรียบร้อยแล้ว — พนักงาน:{' '}
                <strong className="font-semibold text-emerald-950">
                  {successReport.employee_name_snapshot}
                </strong>
              </p>
              <div className="mt-2 text-xs text-emerald-900 bg-white/80 p-2.5 rounded-xl border border-emerald-200 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block">จุดตรวจ / อาคาร:</span>
                  <span className="font-semibold text-emerald-900">
                    {successReport.checkpoint_name || currentCheckpointName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">ผลัดที่ตรวจ:</span>
                  <span className="font-semibold">
                    {successReport.shift === 'night' ? 'ผลัดกลางคืน' : 'ผลัดกลางวัน'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">วัน-เวลา (ไทย):</span>
                  <span className="font-mono font-medium">
                    {successReport.report_date_th} {successReport.report_time_th} น.
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">สถานการณ์:</span>
                  <span className="font-medium">
                    {successReport.situation === 'normal'
                      ? 'ปกติ'
                      : successReport.situation === 'abnormal'
                      ? 'ไม่ปกติ'
                      : 'ฉุกเฉิน'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuccessReport(null)}
                className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
              >
                ปิดข้อความแจ้งเตือนนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs sm:text-sm flex items-start gap-2 animate-in fade-in">
            <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. SECURITY GUARD SELECTION (10 OFFICIAL GUARDS)          */}
        {/* ======================================================== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-800" />
              <span>1. เลือกชื่อพนักงาน รปภ. (เจ้าหน้าที่ 10 คน)</span>
              <span className="text-red-500">*</span>
            </label>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              เลือกแล้ว: {employeeInput}
            </span>
          </div>

          {/* Quick Clickable Grid of the 10 Guards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1">
            {OFFICIAL_GUARDS.map((guard, idx) => {
              const isSelected = employeeInput === guard.name;
              return (
                <button
                  key={guard.id}
                  type="button"
                  onClick={() => setEmployeeInput(guard.name)}
                  className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm ring-2 ring-emerald-600/40'
                      : 'bg-slate-50/80 text-slate-800 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate">{guard.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>

          {/* Optional Dropdown Selector for Compact Display */}
          <div className="pt-1">
            <div className="relative">
              <select
                value={employeeInput}
                onChange={(e) => setEmployeeInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 appearance-none pr-9 cursor-pointer"
              >
                {OFFICIAL_GUARDS.map((g, idx) => (
                  <option key={g.id} value={g.name}>
                    {idx + 1}. {g.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. CHECKPOINT SELECTION (DAY & NIGHT SHIFTS / 5 BUILDINGS)*/}
        {/* ======================================================== */}
        <div className="space-y-3 bg-slate-50/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-800" />
              <span>2. เลือกจุดตรวจการถ่ายรูปรายงาน</span>
              <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-slate-500">
              บันทึกระบุในตารางและภาพถ่าย
            </span>
          </div>

          {/* Step 2A: Shift Selector (ผลัดกลางวัน / ผลัดกลางคืน) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedShift('day')}
              className={`p-3 rounded-xl border-2 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedShift === 'day'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-400/50'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sun className={`w-4 h-4 ${selectedShift === 'day' ? 'text-white' : 'text-amber-500'}`} />
              <span>ผลัดกลางวัน (15 จุดตรวจ)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedShift('night')}
              className={`p-3 rounded-xl border-2 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedShift === 'night'
                  ? 'bg-indigo-900 text-white border-indigo-950 shadow-sm ring-2 ring-indigo-500/50'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Moon className={`w-4 h-4 ${selectedShift === 'night' ? 'text-white' : 'text-indigo-600'}`} />
              <span>ผลัดกลางคืน (31 จุดตรวจ)</span>
            </button>
          </div>

          {/* Step 2B: Building Tabs (5 Buildings) */}
          <div>
            <span className="text-xs font-semibold text-slate-700 block mb-1.5">
              เลือกอาคาร (5 อาคาร):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
              {BUILDINGS_LIST.map((bld, idx) => {
                const isSelected = selectedBuilding === bld.name;
                const pointCount =
                  SHIFT_CHECKPOINTS_CONFIG[selectedShift].find((b) => b.building === bld.name)
                    ?.points.length || 0;

                return (
                  <button
                    key={bld.id}
                    type="button"
                    onClick={() => setSelectedBuilding(bld.name)}
                    className={`p-2 rounded-xl border text-center text-xs font-medium transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className={`w-4 h-4 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`} />
                    <span className="leading-tight truncate w-full">{bld.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {pointCount} จุด
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2C: Point Chips for Selected Building */}
          <div className="pt-1">
            <span className="text-xs font-semibold text-slate-700 block mb-1.5">
              เลือกจุดตรวจใน <strong className="text-emerald-900">{selectedBuilding}</strong>:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {currentBuildingPoints.map((pt, idx) => {
                const isSelected = selectedPoint === pt;
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setSelectedPoint(pt)}
                    className={`px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-1 ring-emerald-500'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <span>{pt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick All-in-one Dropdown Selector */}
          <div className="pt-2 border-t border-slate-200">
            <label className="text-[11px] font-medium text-slate-500 block mb-1">
              หรือเลือกจากรายการจุดตรวจทั้งหมดในระบบ (All Checkpoints):
            </label>
            <div className="relative">
              <select
                value={`${selectedShift}|${selectedBuilding}|${selectedPoint}`}
                onChange={(e) => {
                  const parts = e.target.value.split('|');
                  if (parts.length === 3) {
                    setSelectedShift(parts[0] as 'day' | 'night');
                    setSelectedBuilding(parts[1]);
                    setSelectedPoint(parts[2]);
                  }
                }}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 appearance-none pr-8 cursor-pointer"
              >
                <optgroup label="☀️ จุดตรวจผลัดกลางวัน (Day Shift)">
                  {SHIFT_CHECKPOINTS_CONFIG.day.flatMap((bld) =>
                    bld.points.map((pt) => (
                      <option key={`day-${bld.building}-${pt}`} value={`day|${bld.building}|${pt}`}>
                        {bld.building} — {pt}
                      </option>
                    ))
                  )}
                </optgroup>
                <optgroup label="🌙 จุดตรวจผลัดกลางคืน (Night Shift)">
                  {SHIFT_CHECKPOINTS_CONFIG.night.flatMap((bld) =>
                    bld.points.map((pt) => (
                      <option key={`night-${bld.building}-${pt}`} value={`night|${bld.building}|${pt}`}>
                        {bld.building} — {pt}
                      </option>
                    ))
                  )}
                </optgroup>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Selected Checkpoint Summary Badge */}
          <div className="bg-emerald-950 text-white p-3 rounded-xl flex items-center justify-between text-xs shadow-xs">
            <div className="flex items-center gap-2 truncate">
              <div className="w-6 h-6 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div className="truncate">
                <span className="text-[10px] text-emerald-300 block">
                  จุดตรวจที่เลือกสำหรับรายงาน:
                </span>
                <span className="font-bold text-white text-xs sm:text-sm truncate">
                  {selectedBuilding} — {selectedPoint}
                </span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                selectedShift === 'day'
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-indigo-400 text-indigo-950'
              }`}
            >
              {selectedShift === 'day' ? 'ผลัดกลางวัน' : 'ผลัดกลางคืน'}
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. PHOTO ATTACHMENT WITH WATERMARK                      */}
        {/* ======================================================== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-800" />
              <span>3. ถ่ายรูปรายงานตัว (กล้องตรวจจุด รปภ.)</span>
              <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ประทับตราเวลาไทย, จุดตรวจ & GPS
            </span>
          </div>

          {photoBase64 ? (
            <div className="space-y-2">
              <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-950 p-1 flex items-center justify-center max-h-96 shadow-md">
                <img
                  src={photoBase64}
                  alt="ภาพถ่ายรายงานตัวตรวจจุด"
                  className="max-h-88 w-auto max-w-full rounded-xl object-contain"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-black/75 hover:bg-black/90 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md border border-white/20 transition-colors shadow-lg cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ถ่ายใหม่</span>
                  </button>
                </div>
                <div className="absolute bottom-3 left-3 bg-emerald-950/90 text-emerald-300 text-xs px-3 py-1 rounded-lg border border-emerald-500/50 backdrop-blur-md flex items-center gap-1.5 shadow-md">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium">
                    ประทับตรา: {currentCheckpointName} ({selectedShift === 'day' ? 'ผลัดกลางวัน' : 'ผลัดกลางคืน'})
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>ตราประทับตรวจจุดถูกบันทึกลงในไฟล์ภาพถ่ายโดยตรง เพื่อใช้เป็นหลักฐานการปฏิบัติหน้าที่</span>
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-emerald-700/50 bg-emerald-50/50 hover:bg-emerald-50/90 hover:border-emerald-700 text-emerald-950 flex flex-col items-center justify-center gap-2.5 transition-all group shadow-2xs cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                <Camera className="w-7 h-7" />
              </div>
              <div className="text-center">
                <span className="text-sm sm:text-base font-bold text-emerald-950 block">
                  กดถ่ายรูปรายงานตรวจจุด: {currentCheckpointName}
                </span>
                <span className="text-xs text-slate-600 mt-1 block">
                  ระบบจะประทับตรา <strong>วัน-เวลาไทย, จุดตรวจ ({selectedShift === 'day' ? 'ผลัดกลางวัน' : 'ผลัดกลางคืน'}), และชื่อ รปภ.</strong> ลงในรูปทันที
                </span>
              </div>
            </button>
          )}
        </div>

        {/* ======================================================== */}
        {/* 4. GPS LOCATION VERIFICATION                            */}
        {/* ======================================================== */}
        <div className="space-y-2 bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-emerald-800" />
              <span>พิกัดสถานที่จริง (GPS Verification)</span>
            </span>
            <button
              type="button"
              onClick={requestGpsLocation}
              disabled={isGettingGps}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-medium flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors cursor-pointer"
            >
              <Navigation className={`w-3.5 h-3.5 ${isGettingGps ? 'animate-spin' : ''}`} />
              <span>{isGettingGps ? 'กำลังดึงพิกัด...' : 'ระบุพิกัด GPS'}</span>
            </button>
          </div>

          {gpsLocation ? (
            <div className="text-xs text-emerald-800 bg-emerald-100/60 p-2.5 rounded-xl border border-emerald-300 flex items-center justify-between">
              <div>
                <div className="font-semibold flex items-center gap-1 text-emerald-950">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ระบุพิกัด GPS สำเร็จ</span>
                </div>
                <div className="text-[11px] text-emerald-800 mt-0.5 font-mono">
                  ละติจูด: {gpsLocation.lat.toFixed(5)}, ลองจิจูด: {gpsLocation.lng.toFixed(5)} (ความแม่นยำ ±{gpsLocation.accuracy} ม.)
                </div>
              </div>
            </div>
          ) : gpsError ? (
            <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              {gpsError}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">
              {gpsRequired
                ? '⚠️ ระบบตั้งค่าให้ต้องยืนยันพิกัด GPS โปรดกดปุ่ม "ระบุพิกัด GPS" เพื่อความถูกต้อง'
                : 'สามารถกดปุ่ม "ระบุพิกัด GPS" เพื่อแนบตำแหน่งจริงยืนยันในรายงานได้'}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 5. SITUATION SELECTION (NORMAL / ABNORMAL / EMERGENCY)   */}
        {/* ======================================================== */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-800" />
            <span>4. สถานการณ์</span>
            <span className="text-red-500">*</span>
          </label>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Normal */}
            <button
              type="button"
              onClick={() => setSituation('normal')}
              className={`py-3 sm:py-3.5 px-2 rounded-xl border-2 font-medium text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                situation === 'normal'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CheckCircle
                className={`w-5 h-5 ${
                  situation === 'normal' ? 'text-emerald-600' : 'text-slate-400'
                }`}
              />
              <span className="font-semibold">1. ปกติ</span>
            </button>

            {/* Abnormal */}
            <button
              type="button"
              onClick={() => setSituation('abnormal')}
              className={`py-3 sm:py-3.5 px-2 rounded-xl border-2 font-medium text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                situation === 'abnormal'
                  ? 'bg-amber-50 border-amber-600 text-amber-950 shadow-sm ring-1 ring-amber-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 ${
                  situation === 'abnormal' ? 'text-amber-600' : 'text-slate-400'
                }`}
              />
              <span className="font-semibold">2. ไม่ปกติ</span>
            </button>

            {/* Emergency */}
            <button
              type="button"
              onClick={() => setSituation('emergency')}
              className={`py-3 sm:py-3.5 px-2 rounded-xl border-2 font-medium text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                situation === 'emergency'
                  ? 'bg-red-50 border-red-600 text-red-950 shadow-sm ring-1 ring-red-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <AlertOctagon
                className={`w-5 h-5 ${
                  situation === 'emergency' ? 'text-red-600' : 'text-slate-400'
                }`}
              />
              <span className="font-semibold">3. ฉุกเฉิน</span>
            </button>
          </div>

          {/* Conditional Incident Description Textarea */}
          {situation && situation !== 'normal' && (
            <div className="pt-2 animate-in fade-in space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span>
                  {situation === 'emergency' ? 'รายละเอียดเหตุฉุกเฉิน' : 'รายละเอียดเหตุการณ์ผิดปกติ'}
                  <span className="text-red-500 ml-1">*</span>
                </span>
                <span className="text-[11px] text-slate-400">กรุณาระบุให้ชัดเจน</span>
              </label>
              <textarea
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                rows={3}
                placeholder={
                  situation === 'emergency'
                    ? 'เช่น พบเหตุเพลิงไหม้, บุคคลบุกรุก, ประตูห้องถูกงัดแงะ...'
                    : 'เช่น พบไฟส่องสว่างดับ, ประตูไม่ได้ล็อค, มีเสียงดังผิดปกติ...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-600 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-2xs"
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>กำลังบันทึกข้อมูลเข้าตารางเวลา...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5 text-amber-400" />
                <span>บันทึกเวลาตรวจจุด ({currentCheckpointName})</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Camera Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(photo) => {
          setPhotoBase64(photo);
        }}
        currentPhoto={photoBase64}
        employeeName={employeeInput}
        checkpointName={currentCheckpointName}
        shift={selectedShift}
        buildingName={selectedBuilding}
        pointName={selectedPoint}
        locationDetails={matchedCheckpoint ? `รัศมี ${matchedCheckpoint.allowed_radius_m} ม.` : ''}
        gpsLocation={gpsLocation}
        onUpdateGpsLocation={(coords) => setGpsLocation(coords)}
        serverOffsetMs={serverOffsetMs}
        situation={situation}
      />
    </div>
  );
};
