const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalizeBarangayName(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^(?:brgy\.?|barangay)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ensureBarangayForReport(Barangay, value, district) {
  const name = normalizeBarangayName(value);
  if (!name) throw new Error('Barangay name is required.');

  const query = { name: new RegExp(`^${escapeRegex(name)}$`, 'i') };
  const existing = await Barangay.findOne(query);
  if (existing) return existing;

  try {
    return await Barangay.create({
      name,
      district: district?.trim() || 'Unassigned',
      teams: 0,
      status: 'Active'
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrentlyCreated = await Barangay.findOne(query);
    if (!concurrentlyCreated) throw error;
    return concurrentlyCreated;
  }
}

module.exports = { ensureBarangayForReport, normalizeBarangayName };
