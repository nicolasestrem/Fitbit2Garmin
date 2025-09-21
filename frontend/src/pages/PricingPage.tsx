import React from "react";
import { Helmet } from "react-helmet-async";

const PricingPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <Helmet>
        <title>Trackersync Pricing</title>
        <meta
          name="description"
          content="See Trackersync tiers. Free converts 2 files per day; Pro adds higher limits and batch conversion."
        />
        <link rel="canonical" href="https://trackersync.app/pricing" />
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">Pricing</h1>
        <p className="text-lg text-slate-600">
          Start with the free tier. Upgrade when you need more conversions.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8">
          <h2 className="text-2xl font-semibold text-blue-900">Free</h2>
          <p className="mt-3 text-sm text-blue-900">2 files per day</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Pro</h2>
          <p className="mt-3 text-sm text-slate-600">Higher limits and batch conversion (coming soon)</p>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
