import React from "react";
import { Helmet } from "react-helmet-async";

const PrivacyPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Helmet>
        <title>Trackersync Privacy Policy</title>
        <meta
          name="description"
          content="Trackersync processes files in the browser. We do not store, log, or share your files."
        />
        <link rel="canonical" href="https://trackersync.app/privacy" />
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">Privacy policy</h1>
        <p className="text-lg text-slate-600">
          Trackersync processes files in the browser. We do not store, log, or share your files. We do not sell data.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white/70 p-8 text-slate-600">
        <p>
          All conversions happen locally on your device. The tool never uploads your Fitbit JSON files or generated .fit files to a server.
        </p>
        <p className="mt-4">
          For support, you can contact us via the email listed on this site.
        </p>
      </section>
    </div>
  );
};

export default PrivacyPage;
