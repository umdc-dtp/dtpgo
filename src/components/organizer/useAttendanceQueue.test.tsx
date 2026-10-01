import { act, renderHook, waitFor } from '@testing-library/react';
import { useAttendanceQueue } from './useAttendanceQueue';

const session = {
  id: 'session-1', eventId: 'event-1',
  timeInStart: '2020-01-01T00:00:00.000Z',
  timeInEnd: '2099-01-01T00:00:00.000Z',
};

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}

function response(status: number, data: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('keeps scanning while limiting requests and suppressing a pending duplicate', async () => {
  const pending = [deferredResponse(), deferredResponse(), deferredResponse()];
  let requestIndex = 0;
  const fetchMock = jest.fn(() => pending[requestIndex++].promise);
  global.fetch = fetchMock;
  const recorded = jest.fn();
  const { result } = renderHook(() => useAttendanceQueue(recorded));

  act(() => {
    expect(result.current.enqueue('1001', 'manual', session)).toBe(true);
    expect(result.current.enqueue('1001', 'manual', session)).toBe(false);
    expect(result.current.enqueue('1002', 'manual', session)).toBe(true);
    expect(result.current.enqueue('1003', 'manual', session)).toBe(true);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.current.jobs.find(job => job.studentId === '1003')?.status).toBe('queued');

  pending[0].resolve(response(201, { success: true, student: { firstName: 'Ada', lastName: 'Lovelace' } }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(result.current.jobs.find(job => job.studentId === '1001')?.status).toBe('recorded');
  expect(recorded).toHaveBeenCalledTimes(1);

  pending[1].resolve(response(409, { message: 'Already recorded' }));
  pending[2].resolve(response(500, { message: 'Database unavailable' }));
  await waitFor(() => expect(result.current.jobs.find(job => job.studentId === '1003')?.status).toBe('failed'));
  expect(result.current.jobs.find(job => job.studentId === '1002')?.status).toBe('duplicate');
});

test('uses the public ID number from an enhanced QR and retries failed submissions', async () => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(response(500, { message: 'Temporary failure' }))
    .mockResolvedValueOnce(response(201, { success: true }));
  global.fetch = fetchMock;
  const { result } = renderHook(() => useAttendanceQueue(jest.fn()));

  act(() => { result.current.enqueue(JSON.stringify({ studentId: 'database-id', studentIdNumber: 'S123' }), 'qr', session); });
  await waitFor(() => expect(result.current.jobs[0].status).toBe('failed'));
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).studentId).toBe('S123');

  act(() => { result.current.retry(result.current.jobs[0].id); });
  await waitFor(() => expect(result.current.jobs[0].status).toBe('recorded'));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('shows a preloaded student immediately but waits for the server before saying recorded', async () => {
  const pending = deferredResponse();
  global.fetch = jest.fn(() => pending.promise);
  const { result } = renderHook(() => useAttendanceQueue(jest.fn()));

  act(() => {
    result.current.setStudentDirectory([{ studentIdNumber: 'S123', firstName: 'Ada', lastName: 'Lovelace' }]);
    result.current.enqueue('S123', 'manual', session);
  });

  expect(result.current.jobs[0]).toMatchObject({
    studentName: 'Ada Lovelace',
    status: 'processing',
    message: 'Student found · saving attendance…',
  });

  pending.resolve(response(500, { message: 'Could not save attendance' }));
  await waitFor(() => expect(result.current.jobs[0].status).toBe('failed'));
  expect(result.current.jobs[0].message).toBe('Could not save attendance');
});
