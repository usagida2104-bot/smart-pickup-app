export interface DistanceMatrixResult {
  [origin: string]: {
    [destination: string]: {
      durationText: string; // e.g. "15 mins"
      durationValue: number; // e.g. 900 (seconds)
    };
  };
}

export async function fetchDistances(addresses: string[]): Promise<DistanceMatrixResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.warn("GOOGLE_MAPS_API_KEY is not set. Falling back to area-based assignment.");
    return null;
  }

  const uniqueAddresses = Array.from(new Set(addresses.filter((a) => a && a.trim() !== "未設定" && a.trim() !== "")));
  
  if (uniqueAddresses.length < 2) {
    // No need to calculate distances if there's less than 2 distinct locations
    return null;
  }

  const origins = uniqueAddresses.map(encodeURIComponent).join("|");
  const destinations = origins; // N x N matrix

  // Using Basic Elements: No departure_time, no traffic model
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Distance Matrix API HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.status !== "OK") {
      console.warn(`Distance Matrix API returned status: ${data.status}`);
      // Fallback automatically on OVER_QUERY_LIMIT, REQUEST_DENIED, etc.
      return null;
    }

    const matrix: DistanceMatrixResult = {};

    uniqueAddresses.forEach((origin, i) => {
      matrix[origin] = {};
      uniqueAddresses.forEach((destination, j) => {
        const element = data.rows[i].elements[j];
        if (element.status === "OK") {
          matrix[origin][destination] = {
            durationText: element.duration.text,
            durationValue: Math.round(element.duration.value / 60), // minutes
          };
        }
      });
    });

    return matrix;
  } catch (err) {
    console.error("Failed to fetch distance matrix:", err);
    return null;
  }
}
