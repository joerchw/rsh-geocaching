// Pure codeword logic — no browser APIs, importable by tests.

export function normalizeCodeword(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

export function checkCodeword(input, expected) {
  const normExpected = normalizeCodeword(expected);
  if (normExpected === '') return false;
  return normalizeCodeword(input) === normExpected;
}
