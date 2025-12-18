export interface Customer {
  id: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStats {
  customerId: number;
  customerName: string;
  orderCount: number;
  totalTons: number;
  totalContainers: number;
  firstOrderDate: string;
  lastOrderDate: string;
  topStyles: { styleNo: string; tons: number }[];
}
