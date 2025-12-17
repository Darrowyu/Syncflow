export enum LineStatus {
  RUNNING = 'Running',
  MAINTENANCE = 'Maintenance',
  STOPPED = 'Stopped',
}

export interface SubLine {
  id: string;
  name: string;
  currentStyle: string;
  dailyCapacity: number;
  exportCapacity: number; // 外贸产能（即待入库数量）
  styleChangedAt?: string;
}

export interface ProductLine {
  id: number;
  name: string;
  status: LineStatus;
  currentStyle: string;
  dailyCapacity: number;
  exportCapacity: number; // 外贸产能（即待入库数量）
  note?: string;
  styleChangedAt?: string;
  subLines?: SubLine[];
}
