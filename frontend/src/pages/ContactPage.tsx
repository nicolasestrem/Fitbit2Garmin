import React from "react";
import { Helmet } from "react-helmet-async";

const ContactPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Helmet>
        <title>Contact Trackersync</title>
        <meta
          name="description"
          content="Get in touch with the Trackersync team for support."
        />
        <link rel="canonical" href="https://trackersync.app/contact" />
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">Contact</h1>
        <p className="text-lg text-slate-600">Need help or have feedback? Reach out by email.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white/70 p-8 text-slate-600">
        For support, contact us at <a href="mailto:hello@trackersync.app" className="text-blue-600 underline">hello@trackersync.app</a>.
      </section>
    </div>
  );
};

export default ContactPage;
