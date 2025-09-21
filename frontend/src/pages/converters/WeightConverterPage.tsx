import React from "react";
import { Helmet } from "react-helmet-async";
import { WeightConverterApp } from "../../components/converters/WeightConverterApp";

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need a Garmin device?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. You only need a Garmin account to import."
      },
    },
    {
      "@type": "Question",
      "name": "Can I delete a wrong import?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. You can remove entries from Garmin Connect later if needed."
      },
    },
  ],
};

const WeightConverterPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <Helmet>
        <title>Fitbit to Garmin weight converter (.json → .fit)</title>
        <meta
          name="description"
          content="Import your full weight history into Garmin Connect with clean .fit files. Local processing, no account required."
        />
        <link rel="canonical" href="https://trackersync.app/converters/weight" />
        <script type="application/ld+json">{JSON.stringify(faqStructuredData)}</script>
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">Fitbit Google Takeout → Garmin weight (.fit)</h1>
        <p className="text-lg text-slate-600">Move your full weight history into Garmin Connect in a few minutes.</p>
      </header>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Why this matters</h2>
        <p className="text-slate-600">
          If you are switching to Garmin, you probably want your past numbers in one place. This page gives you a simple path.
        </p>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">What you need</h2>
        <ul className="grid gap-2 text-slate-600">
          <li>Your Fitbit Google Takeout archive</li>
          <li>The <code className="rounded bg-slate-100 px-2 py-1">weight-YYYY-MM-DD.json</code> files</li>
        </ul>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Steps</h2>
        <ol className="space-y-4 text-slate-600">
          <li>Open Trackersync and choose <strong>Convert files</strong>.</li>
          <li>Drag your weight JSON files.</li>
          <li>Download the .fit files.</li>
          <li>Import them in Garmin Connect.</li>
        </ol>
      </section>

      <section id="convert" className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-slate-900">Convert your files</h2>
          <p className="text-slate-600">
            Processing happens locally in your browser. No account or upload required.
          </p>
        </div>
        <WeightConverterApp />
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">What the tool keeps</h2>
        <ul className="grid gap-2 text-slate-600">
          <li>Date and time for each entry</li>
          <li>Weight value</li>
          <li>Body fat percent when present</li>
        </ul>
      </section>

      <section className="grid gap-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-8">
        <h2 className="text-2xl font-semibold text-yellow-900">Notes</h2>
        <ul className="grid gap-2 text-yellow-900">
          <li>Use batches for large archives</li>
          <li>Check a small range first</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/70 p-8 text-center">
        <a
          href="#convert"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700"
        >
          Convert your files
        </a>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Mini-FAQ</h2>
        <div className="space-y-6 text-left text-slate-600">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Do I need a Garmin device?</h3>
            <p className="mt-2">No. You only need a Garmin account to import.</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Can I delete a wrong import?</h3>
            <p className="mt-2">Yes. You can remove entries from Garmin Connect later if needed.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WeightConverterPage;






