import { badRequest } from '../utils/errors.js';

const ORDER_TRANSITIONS = {
  PLACED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: [],
  CANCELLED: [],
};

export const ORDER_STATUSES = ['PLACED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];

export function assertValidStatusTransition(currentStatus, nextStatus) {
  if (!ORDER_STATUSES.includes(nextStatus)) {
    throw badRequest('Unknown order status.');
  }
  if (currentStatus === nextStatus) {
    throw badRequest(`Order is already ${nextStatus.toLowerCase()}.`);
  }
  if (!ORDER_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    throw badRequest(`Cannot move an order from ${currentStatus} to ${nextStatus}.`);
  }
}

export function nextStatusFor(currentStatus) {
  if (currentStatus === 'PLACED') return 'PREPARING';
  if (currentStatus === 'PREPARING') return 'READY';
  if (currentStatus === 'READY') return 'SERVED';
  return null;
}
