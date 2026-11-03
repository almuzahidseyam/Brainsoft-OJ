export async function api(path, { token, signal, body } = {}) {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}

export async function waitForVerdict(id, options, { request = api, delay = ms => new Promise(r => setTimeout(r, ms)), attempts = 420 } = {}) {
  for (let i = 0; i < attempts; i++) {
    options.signal?.throwIfAborted();
    const result = await request(`/submissions/${id}`, options);
    if (!['Pending', 'Running'].includes(result.verdict)) return result;
    await delay(1000);
  }
  throw new Error('Result is taking longer than expected. Contact the owner before submitting again.');
}
