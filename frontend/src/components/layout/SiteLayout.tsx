import React from "react";
import { Outlet } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import "./SiteLayout.css";

export const SiteLayout: React.FC = () => {
  return (
    <div className="site-layout">
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
};
