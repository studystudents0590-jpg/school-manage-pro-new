// Shared class master for every School Manager Pro module.
// Keep stored values compatible with existing Firestore records (1, 2, 3...)
// while showing ordinal labels (1st, 2nd, 3rd...) consistently in the UI.
export const CLASS_OPTIONS = [
  { value: 'Nursery', label: 'Nursery' },
  { value: 'LKG', label: 'LKG' },
  { value: 'UKG', label: 'UKG' },
  ...Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const suffix = number % 100 >= 11 && number % 100 <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th');
    return { value: String(number), label: `${number}${suffix}` };
  }),
];

export const CLASS_LIST = CLASS_OPTIONS.map(item => item.value);

export const getClassLabel = value => {
  const raw = String(value ?? '').trim();
  const found = CLASS_OPTIONS.find(item => item.value.toLowerCase() === raw.toLowerCase());
  if (found) return found.label;
  // Preserve visibility of legacy/custom class names not in the standard list.
  return raw;
};

export const compareClasses = (a, b) => {
  const aValue = typeof a === 'object' ? a?.className : a;
  const bValue = typeof b === 'object' ? b?.className : b;
  const aIndex = CLASS_LIST.findIndex(x => x.toLowerCase() === String(aValue ?? '').trim().toLowerCase());
  const bIndex = CLASS_LIST.findIndex(x => x.toLowerCase() === String(bValue ?? '').trim().toLowerCase());
  if (aIndex !== -1 || bIndex !== -1) {
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    if (aIndex !== bIndex) return aIndex - bIndex;
  }
  return String(aValue ?? '').localeCompare(String(bValue ?? ''), undefined, { numeric: true, sensitivity: 'base' });
};

export const getClassOptionsWithLegacy = values => {
  const extras = [...new Set((values || []).map(value => String(value ?? '').trim()).filter(Boolean))]
    .filter(value => !CLASS_LIST.some(item => item.toLowerCase() === value.toLowerCase()))
    .sort(compareClasses);
  return [...CLASS_OPTIONS, ...extras.map(value => ({ value, label: value }))];
};
