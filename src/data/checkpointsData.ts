export interface CheckpointItem {
  id: string;
  name: string;
  building: string;
  point: string;
  shift: 'day' | 'night';
  shiftLabel: string;
  latitude: number;
  longitude: number;
  allowed_radius_m: number;
  active: boolean;
}

export const OFFICIAL_GUARDS: { id: string; name: string }[] = [
  { id: 'emp_01', name: 'อานนท์ มีทรัพย์' },
  { id: 'emp_02', name: 'อิสมะแอ แวหะมะ' },
  { id: 'emp_03', name: 'เกรียงไกร นวมมณี' },
  { id: 'emp_04', name: 'ทะนงศักดิ์ ชัยมัน' },
  { id: 'emp_05', name: 'มูหามะอับดุลฮาเล็ม ดอรอแม' },
  { id: 'emp_06', name: 'จิรชาย สาระทรัพย์' },
  { id: 'emp_07', name: 'ฮาฟิส ยูโซะ' },
  { id: 'emp_08', name: 'โกวิท ภักดิ์โสภา' },
  { id: 'emp_09', name: 'นายมูฮำมัดอารอฟัต ดอรอแม' },
  { id: 'emp_10', name: 'สุบิน นุจิตร' },
];

export const BUILDINGS_LIST = [
  { id: 'bld_1', name: 'อาคารอำนวยการ' },
  { id: 'bld_2', name: 'อาคารคีตราชนครินทร์' },
  { id: 'bld_3', name: 'อาคารกัลยาณินคีตการ' },
  { id: 'bld_4', name: 'อาคารศูนย์เรียนรู้และสันทนาการ' },
  { id: 'bld_5', name: 'อาคารเก็บเครื่องดนตรี' },
] as const;

// Building-specific inspection points by shift
export const SHIFT_CHECKPOINTS_CONFIG: Record<
  'day' | 'night',
  { building: string; points: string[] }[]
> = {
  day: [
    {
      building: 'อาคารอำนวยการ',
      points: ['ด้านหน้าตึก', 'ด้านข้างตึก', 'ด้านหลังตึก'],
    },
    {
      building: 'อาคารคีตราชนครินทร์',
      points: ['ด้านหน้าตึก', 'ด้านข้างตึก', 'ด้านหลังตึก'],
    },
    {
      building: 'อาคารกัลยาณินคีตการ',
      points: ['ด้านหน้าตึก', 'ด้านข้างตึก', 'ด้านหลังตึก'],
    },
    {
      building: 'อาคารศูนย์เรียนรู้และสันทนาการ',
      points: ['ด้านหน้าตึก', 'ด้านข้างตึก', 'ด้านหลังตึก'],
    },
    {
      building: 'อาคารเก็บเครื่องดนตรี',
      points: ['ด้านหน้าตึก', 'ด้านข้างตึก', 'ด้านหลังตึก'],
    },
  ],
  night: [
    {
      building: 'อาคารอำนวยการ',
      points: [
        'ด้านหน้าตึก',
        'ด้านข้างตึก',
        'ด้านหลังตึก',
        'ด้านหลังฮอล',
        'ห้อง 209',
        'โถงชั้น 2',
      ],
    },
    {
      building: 'อาคารคีตราชนครินทร์',
      points: [
        'ด้านหน้าตึก',
        'ด้านข้างตึก',
        'ด้านหลังตึก',
        'ชั้น 2 ระเบียง',
        'ห้องไฟ',
      ],
    },
    {
      building: 'อาคารกัลยาณินคีตการ',
      points: [
        'ชั้น 1 ด้านหน้าตึก',
        'ชั้น 1 ด้านข้างตึก',
        'ชั้น 1 ด้านหลังตึก',
        'ชั้น 2 หน้าตึก',
        'ชั้น 2 หลังตึก',
        'ชั้น 3 หน้าตึก',
        'ชั้น 3 หลังตึก',
        'ชั้น 4 หน้าตึก',
        'ชั้น 4 หลังตึก',
        'ชั้น 5 หน้าตึก',
        'ชั้น 5 หลังตึก',
      ],
    },
    {
      building: 'อาคารศูนย์เรียนรู้และสันทนาการ',
      points: [
        'ด้านหน้าตึก',
        'ด้านข้างตึก',
        'ด้านหลังตึก',
        'ห้องน้ำ',
        'ข้างหลังโรงอาหาร',
      ],
    },
    {
      building: 'อาคารเก็บเครื่องดนตรี',
      points: [
        'ด้านหน้าตึก',
        'ด้านข้างตึก',
        'ด้านหลังตึก',
        'ชั้น 2',
        'ชั้น 3',
      ],
    },
  ],
};

// Generate complete list of all checkpoints
export function generateAllCheckpoints(): CheckpointItem[] {
  const result: CheckpointItem[] = [];
  let count = 1;

  // Day shift points
  for (const group of SHIFT_CHECKPOINTS_CONFIG.day) {
    for (const pt of group.points) {
      result.push({
        id: `chk_day_${String(count).padStart(2, '0')}`,
        name: `${group.building} — ${pt}`,
        building: group.building,
        point: pt,
        shift: 'day',
        shiftLabel: 'ผลัดกลางวัน',
        latitude: 13.7563,
        longitude: 100.5018,
        allowed_radius_m: 100,
        active: true,
      });
      count++;
    }
  }

  // Night shift points
  let nightCount = 1;
  for (const group of SHIFT_CHECKPOINTS_CONFIG.night) {
    for (const pt of group.points) {
      result.push({
        id: `chk_night_${String(nightCount).padStart(2, '0')}`,
        name: `${group.building} — ${pt}`,
        building: group.building,
        point: pt,
        shift: 'night',
        shiftLabel: 'ผลัดกลางคืน',
        latitude: 13.7563,
        longitude: 100.5018,
        allowed_radius_m: 100,
        active: true,
      });
      nightCount++;
    }
  }

  return result;
}

export const ALL_CHECKPOINTS = generateAllCheckpoints();
