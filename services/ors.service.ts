export interface RouteResponse {
  distanceKm: number;
  durationMins: number;
  polyline: any;
}

export const getRoute = async (
  startCoords: [number, number], // [lng, lat]
  endCoords: [number, number]    // [lng, lat]
): Promise<RouteResponse> => {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    throw new Error('ORS_API_KEY is not defined in environment variables');
  }

  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startCoords[0]},${startCoords[1]}&end=${endCoords[0]},${endCoords[1]}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ORS API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const feature = data.features[0];
    const properties = feature.properties;
    
    // Convert meters to kilometers
    const distanceKm = properties.segments[0].distance / 1000;
    
    // Convert seconds to minutes
    const durationMins = properties.segments[0].duration / 60;
    
    // The geometry is the encoded polyline (or GeoJSON depending on the endpoint)
    // By default GET /v2/directions/driving-car returns GeoJSON
    const polyline = feature.geometry;

    return {
      distanceKm,
      durationMins,
      polyline,
    };
  } catch (error: any) {
    console.error('Error fetching route from ORS:', error.message);
    throw new Error('Failed to calculate route');
  }
};
