"use client";

import { useEffect, useState } from "react";

type PreviewRecord = {
  useCase: string;
  document: string;
  versionHash: string;
  recipientName: string;
  recipientEmail: string;
  acknowledgedAt: string;
  firstOpened: string;
  scrollDepth: string;
  timeOnPage: string;
};

const SAMPLE_RECORDS: PreviewRecord[] = [
  {
    useCase: "Residential Conveyancing",
    document: "Client Care Letter - Residential Conveyancing",
    versionHash: "9f2c...a81d",
    recipientName: "Alex Smith",
    recipientEmail: "alex@client.com",
    acknowledgedAt: "12 Feb 2026, 09:22",
    firstOpened: "09:17",
    scrollDepth: "100%",
    timeOnPage: "4m 32s",
  },
  {
    useCase: "HR Policy Updates",
    document: "Employee Handbook Update - Remote Work Policy",
    versionHash: "4bc1...77f9",
    recipientName: "Taylor Johnson",
    recipientEmail: "taylor@company.com",
    acknowledgedAt: "08 Feb 2026, 14:08",
    firstOpened: "13:56",
    scrollDepth: "98%",
    timeOnPage: "6m 11s",
  },
  {
    useCase: "Vendor Onboarding",
    document: "Supplier Security Requirements - 2026",
    versionHash: "2ad8...c312",
    recipientName: "Jordan Lee",
    recipientEmail: "jordan@vendor.io",
    acknowledgedAt: "04 Feb 2026, 11:39",
    firstOpened: "11:27",
    scrollDepth: "100%",
    timeOnPage: "5m 03s",
  },
];

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % SAMPLE_RECORDS.length);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, []);

  const activeRecord = SAMPLE_RECORDS[activeIndex];

  return (
    <div className="relative">
      {/* soft glow */}
      <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-linear-to-br from-zinc-200/60 via-transparent to-zinc-200/60 blur-2xl dark:from-zinc-800/40 dark:to-zinc-800/40" />
      <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-baseline gap-3">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Receipt Record
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              {activeRecord.useCase}
            </div>
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

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            Receipt records observable events (delivery, access, review activity, acknowledgement).
          </div>
        </div>
      </div>
    </div>
  );
}
