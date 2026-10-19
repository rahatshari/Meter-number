export interface Customer {
  id: string | number;
  name: string;
  father: string;
  mother?: string;
  address: string;
  mobile: string;
  sms: string;
  dueDate: string;
  group?: string;
  lastPaidMonth: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type StatusFilter = 'All' | 'Unpaid' | 'Paid';
export type NavTab = 'home' | 'customers' | 'dues' | 'settings';
export type ThemeMode = 'light' | 'dark';
export type DataHubTab = 'import' | 'export' | 'cloud';
export type AuthTab = 'google' | 'email';
export type EmailAuthMode = 'login' | 'register';
