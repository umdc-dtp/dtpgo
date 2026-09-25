import { namesMatch } from './student-name-matching';

describe('namesMatch', () => {
  const registeredName = 'Jamil Patrick M. Jamila';

  test.each([
    'Jamil Patrick M. Jamila',
    'jamil patrick m jamila',
    'Jamil Patrick Jamila',
    'JAMIL PATRICK M. JAMILA',
    '  Jamil   Patrick   Jamila  ',
  ])('matches tolerated variation: %s', (submittedName) => {
    expect(namesMatch(registeredName, submittedName)).toBe(true);
  });

  test.each([
    'Jamil Patrick Santos',
    'Jamil Patrick',
  ])('rejects unsafe variation: %s', (submittedName) => {
    expect(namesMatch(registeredName, submittedName)).toBe(false);
  });
});