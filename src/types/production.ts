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
  exportCapacity: number;
  styleChangedAt?: string;
}

export interface ProductLine {
  id: number;
  name: string;
  status: LineStatus;
  currentStyle: string;
  dailyCapacity: number;
  exportCapacity: number;
  note?: string;
  styleChangedAt?: string;
  subLines?: SubLine[];
}
