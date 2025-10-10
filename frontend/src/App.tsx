/**
 * @file Main application component.
 * This component serves as the root layout and renders the matched child routes
 * using React Router's Outlet component.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * The main application component.
 * It acts as a container for the routed pages.
 * @returns {React.ReactElement} The rendered component with the current route's content.
 */
function App() {
  return <Outlet />;
}

export default App;
