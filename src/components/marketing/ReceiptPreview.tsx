"use client";

import { useEffect, useState } from "react";

type PreviewRecord = {
  useCase: string;
  document: string;
  versionHash: string;
  status: string;
  recipientName: string;
  recipientEmail: string;
  acknowledgedAt: string;
  firstOpened: string;
  scrollDepth: string;
  timeOnPage: string;
  timeline: { at: string; label: string }[];
};

const SAMPLE_RECORDS: PreviewRecord[] = [
  {
    useCase: "Residential Conveyancing",
    document: "Client Care Letter - Residential Conveyancing",
    versionHash: "9f2c...a81d",
    status: "Acknowledged",
    recipientName: "Alex Smith",
    recipientEmail: "alex@client.com",
    acknowledgedAt: "12 Feb 2026, 09:22",
    firstOpened: "09:17",
    scrollDepth: "100%",
    timeOnPage: "4m 32s",
    timeline: [
      { at: "09:17", label: "Opened" },
      { at: "09:19", label: "Reached 50% scroll" },
      { at: "09:22", label: "Acknowledged" },
    ],
  },
  {
    useCase: "HR Policy Updates",
    document: "Employee Handbook Update - Remote Work Policy",
    versionHash: "4bc1...77f9",
    status: "Acknowledged",
    recipientName: "Taylor Johnson",
    recipientEmail: "taylor@company.com",
    acknowledgedAt: "08 Feb 2026, 14:08",
    firstOpened: "13:56",
    scrollDepth: "98%",
    timeOnPage: "6m 11s",
    timeline: [
      { at: "13:56", label: "Opened" },
      { at: "14:01", label: "Reached 75% scroll" },
      { at: "14:08", label: "Acknowledged" },
    ],
  },
  {
    useCase: "Vendor Onboarding",
    document: "Supplier Security Requirements - 2026",
    versionHash: "2ad8...c312",
    status: "Acknowledged",
    recipientName: "Jordan Lee",
    recipientEmail: "jordan@vendor.io",
    acknowledgedAt: "04 Feb 2026, 11:39",
    firstOpened: "11:27",
    scrollDepth: "100%",
    timeOnPage: "5m 03s",
    timeline: [
      { at: "11:27", label: "Opened" },
      { at: "11:31", label: "Reached 100% scroll" },
      { at: "11:39", label: "Acknowledged" },
    ],
  },
];

const ROTATE_MS = 4500;
const TRANSITION_MS = 320;

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

export function ReceiptPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    let swapTimeoutId: number | undefined;

    const intervalId = window.setInterval(() => {
      setIsTransitioning(true);
      swapTimeoutId = window.setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % SAMPLE_RECORDS.length);
        setIsTransitioning(false);
      }, TRANSITION_MS);
    }, ROTATE_MS);

    return () => {
      window.clearInterval(intervalId);
      if (swapTimeoutId !== undefined) {
        window.clearTimeout(swapTimeoutId);
      }
    };
  }, []);

  const activeRecord = SAMPLE_RECORDS[activeIndex];

  return (
    <div className="relative">
      {/* soft glow */}
      <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-linear-to-br from-zinc-200/60 via-transparent to-zinc-200/60 blur-2xl dark:from-zinc-800/40 dark:to-zinc-800/40" />
      <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div
          className={`transition-[opacity,transform,filter] duration-300 ease-out motion-reduce:transition-none ${
            isTransitioning
              ? "translate-y-1 opacity-0 blur-[1px]"
              : "translate-y-0 opacity-100 blur-0"
          }`}
        >
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <div className="flex items-baseline gap-3">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Receipt Record
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                {activeRecord.useCase}
              </div>
            </div>
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {activeRecord.status}
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
                Document
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {activeRecord.document}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                Version hash: {activeRecord.versionHash}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
                  Recipient
                </div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeRecord.recipientName}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  {activeRecord.recipientEmail}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
                  Acknowledged
                </div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Yes
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                  {activeRecord.acknowledgedAt}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatPill label="First opened" value={activeRecord.firstOpened} />
              <StatPill label="Scroll depth" value={activeRecord.scrollDepth} />
              <StatPill label="Time on page" value={activeRecord.timeOnPage} />
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-500">
                Timeline
              </div>
              <div className="mt-3 space-y-2">
                {activeRecord.timeline.map((event) => (
                  <div key={`${event.at}-${event.label}`} className="flex items-center gap-3">
                    <div className="w-11 shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-500">
                      {event.at}
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                    <div className="text-xs text-zinc-700 dark:text-zinc-300">{event.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              Receipt records observable events (delivery, access, review activity, acknowledgement).
            </div>

            <div className="flex justify-end">
              <span className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                Export PDF record
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
