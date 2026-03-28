function passwordValidation(password) {
  if (!password || password.length < 8) {
    return ['Password must be at least 8 characters long.'];
  }
  return [];
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseIdList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean);
    }
  } catch (error) {
    // ignore
  }
  if (value.includes(',')) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
}

module.exports = {
  passwordValidation,
  asNumber,
  parseIdList,
};
