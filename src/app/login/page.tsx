'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AnsellLogo() {
  return (
    <svg version="1.1" width="130" height="40" viewBox="0 0 446.028 137.747" xmlSpace="preserve">
      <g>
        <path fillRule="evenodd" clipRule="evenodd" fill="#0061AD" d="M313.973,83.691l9.064,11.105c-7.838,6.94-17.29,10.047-29.014,9.708c-10.473-0.302-18.345-3.009-23.277-8.931c-5.846-7.021-8.433-16.253-9.187-27.729c-0.791-11.999,2.876-21.513,8.614-28.46c5.757-6.947,13.624-10.889,23.59-10.411c9.251,0.445,17.296,1.575,22.724,10.25c4.286,6.849,6.837,16.55,6.837,29.175c0,1.409,0.032,4.314,0.032,4.314l-41.593-0.064c0.26,5.77,0.565,9.958,2.945,12.888c2.378,2.929,9.398,6.823,18.609,4.067C305.645,88.907,311.895,86.04,313.973,83.691z M282.647,58.423l20.682,0.222c-0.256-7.32,0.191-13.459-10.507-13.459c-4.005,0-7.341,1.469-8.628,3.399C282.27,51.474,282.521,54.637,282.647,58.423z"/>
        <path fillRule="evenodd" clipRule="evenodd" fill="#0061AD" d="M201.643,81.479c0.027,0.451,13.803,8.434,20.676,8.335c14.844-0.214,15.236-11.396,3.94-13.935c-3.005-0.676-5.845-1.304-7.619-1.786c-8.98-2.447-13.345-6.008-16.835-9.348c-7.606-7.28-3.681-23.062,3.554-29.316c5.091-4.4,10.84-6.565,19.539-6.601c16.939-0.07,27.239,6.368,27.239,6.368l-7.912,13.808c-0.07-0.805-15.992-5.433-19.889-4.734c-1.81,0.325-3.6,1.112-4.385,1.741c-0.644,0.515-1.674,2.115-1.674,4.377c0,2.932,0.254,3.881,9.435,6.116c2.094,0.51,3.763,0.915,5.001,1.224c9.172,2.299,14.527,5.523,17.888,8.771c3.347,3.236,4.121,7.571,4.121,13.479c0,8.357-3.898,14.253-8.27,18.397c-10.03,9.515-35.42,8.385-46.456,0.291c-1.931-1.416-5.021-2.832-4.718-3.47C195.995,93.693,197.035,90.685,201.643,81.479z"/>
        <path fillRule="evenodd" clipRule="evenodd" fill="#0061AD" d="M129.053,102.457V34.271l16.74-4.888l2.222,8.281c2.597-3.554,4.645-4.929,8.208-6.587c3.69-1.717,7.46-2.322,11.768-2.322c7.619,0,10.453,0.931,14.239,5.155c3.786,4.221,4.974,7.759,4.974,17.991v50.557h-19.35l0.444-44.433c-0.102-3.001-1.004-7.507-1.623-8.622c-1.363-2.455-4.373-3.922-8.137-3.838c-2.701,0.061-5.02,1.091-5.882,1.934c-2.581,2.521-3.808,6.358-3.808,11.333v43.626H129.053z"/>
        <path fillRule="evenodd" clipRule="evenodd" fill="#0061AD" d="M72.238,5.496h22.185l29.679,96.935l-21.505-0.443l-7.229-23.141H67.62l-6.591,23.584H40.793L72.238,5.496z M82.518,27.216l-9.833,35.293h18.819L82.518,27.216z"/>
        <path fillRule="evenodd" clipRule="evenodd" fill="#0061AD" d="M333.606,3.999c0.148,28.513,0.295,58.357,0.444,87.092c2.263,8.373,6.345,12.682,15.329,13.553l14.228-0.009l-1.786-14.21c-6.931,1.384-7.996-2.154-7.996-7.33L354.03,0L333.606,3.999z"/>
        <path fillRule="evenodd" clipRule="evenodd" fill="#0061AD" d="M370.071,3.999c0.148,28.513,0.295,58.357,0.444,87.092c2.264,8.373,6.345,12.682,15.331,13.553l13.996,0.223l-1.557-14.441c-6.93,1.384-7.996-2.154-7.996-7.33L390.956,0L370.071,3.999z"/>
        <path fillRule="evenodd" clipRule="evenodd" fill="#00A494" d="M59.885,117.309c40.828-5.293,80.378-8.487,120.143-7.019c28.077,1.035,58.089,3.309,87.814,4.795c22.219,1.038,49.768,2.964,74.651,3.11l30.218-0.444c25.442-1.676,51.674-5.894,71.539-9.774c0.592,1.036,1.185,2.073,1.778,3.109l-27.106,9.777c-29.96,10.718-61.096,13.329-94.647,14.662c-40.11,0.829-79.411-2.152-118.642-4.443c-60.116-2.983-132.096-12.43-191.517,3.11l-12.442,3.554C-10.292,126.896,45.331,119.566,59.885,117.309z"/>
      </g>
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        const json = await res.json();
        setError(json.error || 'Sign in failed');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ansell-light flex flex-col items-center justify-center px-4">

      {/* Card */}
      <div className="w-full max-w-sm bg-white shadow-lg overflow-hidden" style={{ borderTop: '5px solid #0063AC' }}>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
          <div className="flex justify-center mb-4">
            <AnsellLogo />
          </div>
          <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-ansell-dark mt-2">
            Webinar <span className="text-ansell-blue">Analytics</span>
          </h2>
          <p className="text-[11px] text-ansell-gray mt-1">Internal team access</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ansell-gray mb-1.5">
              Email
            </label>
            <input
              type="email"
              autoComplete="username"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="you@ansell.com"
              className="w-full px-3 py-2.5 border border-gray-300 text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ansell-teal focus:border-ansell-teal transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ansell-gray mb-1.5">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-gray-300 text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ansell-teal focus:border-ansell-teal transition-colors"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-[13px] font-bold uppercase tracking-wider text-white bg-ansell-blue hover:bg-ansell-teal transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in…
              </span>
            ) : 'Sign in'}
          </button>
        </form>

      </div>

      <p className="mt-6 text-[10px] text-ansell-gray">
        Ansell Healthcare · Internal use only
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
