const BARANGAY_COORDINATES = {
  Carmen: [124.6454, 8.4832],
  Lapasan: [124.6612, 8.4862],
  Macasandig: [124.6415, 8.4688],
  Balulang: [124.6178, 8.4491],
  Lumbia: [124.6102, 8.4125],
  Bulua: [124.6288, 8.5012],
  Nazareth: [124.6422, 8.4857],
  Kauswagan: [124.6208, 8.4938],
  'Central Depot': [124.6427, 8.4828]
};

const isValidCoordinatePair = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const parseNumericCoordinate = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return NaN;
};

const toGeoJsonPoint = (latitude, longitude) => {
  if (!isValidCoordinatePair(latitude, longitude)) return null;
  return { type: 'Point', coordinates: [longitude, latitude] };
};

const parseCoordinateString = (value) => {
  const match = value.trim().match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[°º]?\s*([NS])?\s*,\s*(-?\d+(?:\.\d+)?)\s*[°º]?\s*([EW])?\s*$/i
  );
  if (!match) return null;

  const parseHemisphere = (coordinate, hemisphere) => {
    const number = Number(coordinate);
    if (hemisphere?.toUpperCase() === 'S' || hemisphere?.toUpperCase() === 'W') return -Math.abs(number);
    if (hemisphere?.toUpperCase() === 'N' || hemisphere?.toUpperCase() === 'E') return Math.abs(number);
    return number;
  };

  return toGeoJsonPoint(parseHemisphere(match[1], match[2]), parseHemisphere(match[3], match[4]));
};

const parseCoordinates = (value, longitude) => {
  if (longitude !== undefined) {
    return toGeoJsonPoint(parseNumericCoordinate(value), parseNumericCoordinate(longitude));
  }

  if (typeof value === 'string') {
    return parseCoordinateString(value);
  }

  if (Array.isArray(value) && value.length === 2) {
    return toGeoJsonPoint(parseNumericCoordinate(value[1]), parseNumericCoordinate(value[0]));
  }

  if (!value || typeof value !== 'object') return null;

  if (value.type === 'Point' && Array.isArray(value.coordinates)) {
    return parseCoordinates(value.coordinates);
  }

  if (Array.isArray(value.coordinates)) {
    return parseCoordinates(value.coordinates);
  }

  const latitude = value.latitude ?? value.lat;
  const longitudeValue = value.longitude ?? value.lng ?? value.lon;
  if (latitude === undefined || longitudeValue === undefined) return null;
  return toGeoJsonPoint(parseNumericCoordinate(latitude), parseNumericCoordinate(longitudeValue));
};

const getBarangayLocation = (barangay) => {
  const coordinates = BARANGAY_COORDINATES[barangay];
  if (!coordinates) return null;
  return { type: 'Point', coordinates: [...coordinates] };
};

const haversineDistanceMeters = (first, second) => {
  const firstLatitude = Number(first.coordinates[1]) * Math.PI / 180;
  const secondLatitude = Number(second.coordinates[1]) * Math.PI / 180;
  const latitudeDelta = secondLatitude - firstLatitude;
  const longitudeDelta = (Number(second.coordinates[0]) - Number(first.coordinates[0])) * Math.PI / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (distanceMeters) =>
  distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m away`
    : `${(distanceMeters / 1000).toFixed(1)} km away`;

module.exports = {
  BARANGAY_COORDINATES,
  formatDistance,
  getBarangayLocation,
  haversineDistanceMeters,
  isValidCoordinatePair,
  parseCoordinates,
  toGeoJsonPoint
};
