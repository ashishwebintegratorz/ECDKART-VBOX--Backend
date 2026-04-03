export function calculateDeliveryCharge(amount: number): number {
  if (amount < 100) {
    // minimun order amount is 100
    throw new Error("Minimum order amount is ₹100");
  }
  if (amount >= 300) {
    // free delivery for orders above 300
    return 0;
  }
  // per delivery charge is 30
  return 30;
}

export function getDeliveryDate(slot: string): Date {
  const deliveryDate = new Date();
  if (slot === "evening") {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
  }
  return deliveryDate;
}