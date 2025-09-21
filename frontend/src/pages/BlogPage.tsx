import React from "react";
import { Helmet } from "react-helmet-async";

const BlogPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <Helmet>
        <title>Trackersync Blog - Guides and tips for moving your data</title>
        <meta
          name="description"
          content="Short guides that help you keep your history intact when switching platforms."
        />
        <link rel="canonical" href="https://trackersync.app/blog" />
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">Blog</h1>
        <p className="text-lg text-slate-600">
          Guides and notes to keep your health data portable.
        </p>
      </header>

      <section className="grid gap-6">
        {[{
          title: "Why Garmin does not allow direct writes from most apps",
          description: "Quick explainer and the import route with .fit files.",
        }, {
          title: "Step-by-step: export Fitbit data and import it to Garmin",
          description: "Screenshots and paths.",
        }, {
          title: "What is a .fit file and why it is safe for your history",
          description: "Plain language guide.",
        }].map(post => (
          <article key={post.title} className="rounded-2xl border border-slate-200 bg-white/70 p-6">
            <h2 className="text-xl font-semibold text-slate-900">{post.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{post.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default BlogPage;
