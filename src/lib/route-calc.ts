const SHOP_LOCATION: [number, number] = [37.3730, 36.0761];

interface RoutePoint {
  id: number;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
}

export function calculateRoute(
  deliveries: RoutePoint[],
  selectedIds: number[]
): number[] {
  const points = deliveries.filter(
    (d) => selectedIds.includes(d.id) && d.deliveryLatitude && d.deliveryLongitude
  );

  if (points.length === 0) return [];

  const result: number[] = [];
  const remaining = [...points];
  let current = SHOP_LOCATION;

  while (remaining.length > 0) {
    let nearest = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = Math.hypot(
        (remaining[i].deliveryLatitude! - current[0]) * 111000,
        (remaining[i].deliveryLongitude! - current[1]) * 85000
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }

    result.push(remaining[nearest].id);
    current = [remaining[nearest].deliveryLatitude!, remaining[nearest].deliveryLongitude!];
    remaining.splice(nearest, 1);
  }

  return result;
}
