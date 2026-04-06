import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ShoppingItem, Discount } from "../../shared/schema"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Calculate the total cost for an item considering discount
export function calculateItemTotal(item: ShoppingItem): number {
  if (!item.discount || !item.discountApplied) {
    return item.price * item.quantity;
  }

  const { type, quantity: discountQty, value } = item.discount;

  if (item.quantity < discountQty) {
    // Not enough quantity for discount, use regular price
    return item.price * item.quantity;
  }

  const regularTotal = item.price * item.quantity;

  if (type === "bulk_price") {
    // Type 1: "3 for €10" - calculate how many complete sets + remainder
    const completeSets = Math.floor(item.quantity / discountQty);
    const remainder = item.quantity % discountQty;
    const discountedTotal = (completeSets * value) + (remainder * item.price);
    return Math.min(discountedTotal, regularTotal);
  }

  if (type === "buy_x_get_y") {
    // Type 2: "3 for 2" - pay for fewer items than you get
    const completeSets = Math.floor(item.quantity / discountQty);
    const remainder = item.quantity % discountQty;
    const discountedTotal = (completeSets * value * item.price) + (remainder * item.price);
    return Math.min(discountedTotal, regularTotal);
  }

  // Fallback to regular calculation
  return item.price * item.quantity;
}

// Check if an item qualifies for discount based on quantity
export function canApplyDiscount(item: ShoppingItem): boolean {
  return !!(item.discount && item.quantity >= item.discount.quantity);
}

// Apply or remove discount from an item
export function toggleDiscount(item: ShoppingItem): ShoppingItem {
  if (!item.discount) return item;

  const discountApplied = canApplyDiscount(item) ? !item.discountApplied : false;
  const total = discountApplied ?
    calculateItemTotal({ ...item, discountApplied: true }) :
    item.price * item.quantity;

  return {
    ...item,
    discountApplied,
    total
  };
}
