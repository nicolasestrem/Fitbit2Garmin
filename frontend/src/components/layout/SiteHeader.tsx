import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import "./SiteHeader.css";

export const SiteHeader: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [convertersOpen, setConvertersOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    setProductOpen(false);
    setConvertersOpen(false);
  }, [location.pathname]);

  const toggleMenu = () => setMenuOpen(prev => !prev);
  const toggleProduct = () => setProductOpen(prev => !prev);
  const toggleConverters = () => setConvertersOpen(prev => !prev);

  const closeMenus = () => {
    setMenuOpen(false);
    setProductOpen(false);
    setConvertersOpen(false);
  };

  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    isActive ? "active" : undefined;

  return (
    <header className="nav">
      <Link className="brand" to="/">Trackersync</Link>
      <button
        type="button"
        className="burger"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={toggleMenu}
      >
        ☰
      </button>
      <nav className={menuOpen ? "open" : undefined}>
        <div
          className={`dd ${productOpen ? "open" : ""}`}
          onMouseLeave={() => setProductOpen(false)}
        >
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={productOpen}
            onClick={toggleProduct}
            onMouseEnter={() => setProductOpen(true)}
          >
            Product
          </button>
          <div className="menu">
            <NavLink
              to="/product"
              className={linkClassName}
              onClick={closeMenus}
            >
              Overview
            </NavLink>
            <NavLink
              to="/product/how-it-works"
              className={linkClassName}
              onClick={closeMenus}
            >
              How it works
            </NavLink>
          </div>
        </div>
        <div
          className={`dd ${convertersOpen ? "open" : ""}`}
          onMouseLeave={() => setConvertersOpen(false)}
        >
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={convertersOpen}
            onClick={toggleConverters}
            onMouseEnter={() => setConvertersOpen(true)}
          >
            Converters
          </button>
          <div className="menu">
            <NavLink
              to="/converters/weight"
              className={linkClassName}
              onClick={closeMenus}
            >
              Weight (.json → .fit)
            </NavLink>
            <NavLink
              to="/converters/body-fat"
              className={linkClassName}
              onClick={closeMenus}
            >
              Body fat (coming soon)
            </NavLink>
            <NavLink
              to="/converters/bmi"
              className={linkClassName}
              onClick={closeMenus}
            >
              BMI (coming soon)
            </NavLink>
            <NavLink
              to="/converters/resting-heart-rate"
              className={linkClassName}
              onClick={closeMenus}
            >
              Resting heart rate (coming soon)
            </NavLink>
            <NavLink
              to="/converters/sleep-score"
              className={linkClassName}
              onClick={closeMenus}
            >
              Sleep score (coming soon)
            </NavLink>
          </div>
        </div>
        <NavLink to="/docs" className={linkClassName} onClick={closeMenus}>
          Docs
        </NavLink>
        <NavLink to="/blog" className={linkClassName} onClick={closeMenus}>
          Blog
        </NavLink>
        <NavLink to="/pricing" className={linkClassName} onClick={closeMenus}>
          Pricing
        </NavLink>
        <NavLink
          to="/app"
          className={({ isActive }) => (isActive ? "cta active" : "cta")}
          onClick={closeMenus}
        >
          Convert files
        </NavLink>
      </nav>
    </header>
  );
};
