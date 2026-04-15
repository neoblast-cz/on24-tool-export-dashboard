'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWebinarStore } from '@/store/webinar-store';

function getDatePresets(): { label: string; start: string; end: string }[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  const year = today.getFullYear();
  const month = today.getMonth();
  const qStart = new Date(year, Math.floor(month / 3) * 3, 1);
  const lastQStart = new Date(qStart); lastQStart.setMonth(lastQStart.getMonth() - 3);
  const lastQEnd = new Date(qStart); lastQEnd.setDate(lastQEnd.getDate() - 1);
  return [
    { label: 'Last 30 days',  start: fmt(daysAgo(30)),  end: fmt(today) },
    { label: 'Last 60 days',  start: fmt(daysAgo(60)),  end: fmt(today) },
    { label: 'Last 90 days',  start: fmt(daysAgo(90)),  end: fmt(today) },
    { label: 'This quarter',  start: fmt(qStart),        end: fmt(today) },
    { label: 'Last quarter',  start: fmt(lastQStart),    end: fmt(lastQEnd) },
    { label: 'This year',     start: fmt(new Date(year, 0, 1)),          end: fmt(today) },
    { label: 'Last year',     start: fmt(new Date(year - 1, 0, 1)),      end: fmt(new Date(year - 1, 11, 31)) },
    { label: 'This FY',       start: fmt(month >= 6 ? new Date(year, 6, 1) : new Date(year - 1, 6, 1)), end: fmt(today) },
    { label: 'Last FY',       start: fmt(month >= 6 ? new Date(year - 1, 6, 1) : new Date(year - 2, 6, 1)), end: fmt(month >= 6 ? new Date(year, 5, 30) : new Date(year - 1, 5, 30)) },
  ];
}

const DATE_PRESETS = getDatePresets();
const DEFAULT_PRESET = DATE_PRESETS[0];

const navigation = [
  { name: 'Insights', href: '/insights'  },
  { name: 'Export',   href: '/dashboard' },
];

// Ansell wordmark SVG (official)
function AnsellLogo() {
  return (
    <svg version="1.1" width="110" height="34" viewBox="0 0 446.028 137.747" xmlSpace="preserve">
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

export function Header() {
  const pathname = usePathname();
  const { filterStartDate, filterEndDate, filterActivePreset, setDateFilter, applyDateFilter } = useWebinarStore();

  const startDate    = filterStartDate    || DEFAULT_PRESET.start;
  const endDate      = filterEndDate      || DEFAULT_PRESET.end;
  const activePreset = filterActivePreset;

  return (
    <>
      {/* ── Brand header bar ──────────────────────────────────────────────────── */}
      <header className="bg-white" style={{ borderBottom: '4px solid #0063AC' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center gap-5">
          <Link href="/insights" className="flex-shrink-0 leading-none">
            <AnsellLogo />
          </Link>
          <div className="flex-1">
            <h1 className="text-[26px] font-extrabold uppercase leading-none tracking-wide text-ansell-dark">
              Webinar <span className="text-ansell-blue">Analytics</span>
            </h1>
            <p className="text-[11px] text-ansell-gray mt-1">Ansell Healthcare · On24 Dashboard</p>
          </div>
        </div>
      </header>

      {/* ── Tab navigation bar ────────────────────────────────────────────────── */}
      <nav className="bg-[#f8f9fa]" style={{ borderBottom: '1px solid #BBBCBC' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex">
          {navigation.map(item => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`px-6 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors -mb-px ${
                  isActive
                    ? 'text-ansell-blue bg-white'
                    : 'text-ansell-gray hover:text-ansell-dark'
                }`}
                style={isActive
                  ? { borderBottom: '3px solid #0063AC' }
                  : { borderBottom: '3px solid transparent' }
                }
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Date filter strip ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-2 flex flex-wrap items-center gap-1.5">
          {/* Preset pills */}
          {DATE_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyDateFilter(preset.start, preset.end, preset.label)}
              className={`px-2.5 py-1 text-xs border transition-colors ${
                activePreset === preset.label
                  ? 'bg-ansell-teal text-white border-ansell-teal'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              {preset.label}
            </button>
          ))}

          {/* Divider */}
          <span className="mx-1 text-gray-300 select-none">|</span>

          {/* Custom date inputs + Apply */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setDateFilter(e.target.value, endDate, '')}
              className="px-2 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-ansell-teal"
            />
            <label className="text-xs text-gray-500">to</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setDateFilter(startDate, e.target.value, '')}
              className="px-2 py-1 border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-ansell-teal"
            />
            <button
              onClick={() => applyDateFilter(startDate, endDate, '')}
              className="px-3 py-1 text-xs font-medium bg-ansell-teal text-white hover:bg-teal-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
