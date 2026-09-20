// Formas de resposta da API — espelham 1:1 app/schemas.py do backend (mesmos nomes em camelCase).

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'CANCELLED' | 'COMPLETED';
export type TicketStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'CANCELLED';
export type ReservationStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BOLETO' | 'PAYPAL';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
  { value: 'DEBIT_CARD', label: 'Cartão de débito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'PAYPAL', label: 'PayPal' },
];

export interface EventSummary {
  id: number;
  name: string;
  description: string | null;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  totalCapacity: number;
  availableTickets: number;
  price: number;
  status: EventStatus;
}

export interface Seat {
  id: number;
  seatNumber: string;
  section: string | null;
  rowNumber: string | null;
  status: TicketStatus;
}

export interface Reservation {
  reservationToken: string;
  eventId: number;
  eventName: string;
  seatNumber: string;
  userEmail: string | null;
  expiresAt: string;
  status: ReservationStatus;
  timeRemainingSeconds: number;
}

export interface Payment {
  id: number;
  paymentId: string | null;
  idempotencyKey: string;
  reservationId: number;
  ticketId: number;
  amount: number;
  currency: string | null;
  status: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  transactionId: string | null;
  failureReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationInput {
  eventId: number;
  seatNumber: string;
  userEmail?: string;
  userId?: string;
}

export interface PaymentInput {
  reservationToken: string;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
}

export interface ApiErrorBody {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  details?: Record<string, string>;
}
