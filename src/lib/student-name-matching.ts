export const normalizeNameParts = (value: string): string[] => value
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, '')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

export function namesMatch(registeredName: string, submittedName: string): boolean {
  const registeredParts = normalizeNameParts(registeredName);
  const submittedParts = normalizeNameParts(submittedName);

  if (registeredParts.length === submittedParts.length) {
    return registeredParts.every((part, index) => part === submittedParts[index]);
  }

  const registeredWithoutInitials = registeredParts.filter((part, index) => (
    index === 0
    || index === registeredParts.length - 1
    || part.length !== 1
  ));

  return registeredWithoutInitials.length === submittedParts.length
    && registeredWithoutInitials.every((part, index) => part === submittedParts[index]);
}