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

const INDORE_LAT = 22.7196;
const  INDORE_LNG = 75.8577;
const MAX_DISTANCE_KM = 20;

export async function isWithinIndore(lat: number, lng: number): Promise<boolean> {
  const orsKey = process.env.ORS_API_KEY;

  if (orsKey && orsKey.trim() !== '') {
    try {
      // ORS API uses [longitude, latitude] for coordinates!
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${INDORE_LNG},${INDORE_LAT}&end=${lng},${lat}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.features && data.features.length > 0) {
          const distanceMeters = data.features[0].properties.segments[0].distance;
          const distanceKm = distanceMeters / 1000;
          console.log(`[ORS] Driving distance: ${distanceKm.toFixed(2)} km`);
          // BYPASS FOR TESTING: Always return true so orders can be placed from anywhere in India
          return true;
        }
      } else {
        console.warn(`[ORS] API Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("[ORS] Request failed, falling back to Haversine:", error);
    }
  }

  // Fallback to Haversine distance
  const R = 6371; // earth radius km
  const dLat = (lat - INDORE_LAT) * Math.PI / 180;
  const dLng = (lng - INDORE_LNG) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(INDORE_LAT * Math.PI / 180) *
      Math.cos(lat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  console.log(`[Haversine] Aerial distance: ${distance.toFixed(2)} km`);
  
  // BYPASS FOR TESTING: Always return true so orders can be placed from anywhere in India
  return true;
}


export function getDeliveryDate(slot: string): Date {
  const deliveryDate = new Date();
  if (slot === "evening") {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
  }
  return deliveryDate;
}